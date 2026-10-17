import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isReleasedNarration, narrationByFile, narrationPathApproved, releasedNarrationPaths, resolveNarrationCandidate } from "../src/lib/narration-policy.mjs";
import { narrationAccessSecret, narrationSignatureValid, signNarrationPath } from "../src/lib/narration-access.mjs";
import { canonicalNarrationPath, privateAudioFile } from "../src/lib/private-audio.mjs";

test("children only receive human-approved narration paths", () => {
  const released = new Map([["clip", "/audio/narration/alice/clip.mp3"]]);
  assert.equal(isReleasedNarration({ technical_pass: true, production_status: "human_listening_approved" }), true);
  assert.equal(isReleasedNarration({ technical_pass: true, production_status: "generated_pending_human_listening" }), false);
  assert.equal(resolveNarrationCandidate("/qa-cat.mp3", released), "/qa-cat.mp3");
  assert.equal(resolveNarrationCandidate("/audio/narration/alice/clip.mp3", released), "/audio/narration/alice/clip.mp3");
  assert.equal(resolveNarrationCandidate("/audio/narration/alice/other.mp3", released), "");
  assert.equal(resolveNarrationCandidate("https://example.test/secret.mp3", released), "");
});

test("a recorded approval unlocks that narration file only", () => {
  const items = [
    { id: "clip-a", file: "/audio/narration/alice/a.mp3", technical_pass: true, production_status: "generated_pending_human_listening" },
    { id: "clip-b", file: "/audio/narration/alice/b.mp3", technical_pass: true, production_status: "generated_pending_human_listening" },
  ];
  const byFile = narrationByFile(items);
  const approved = new Set(["clip-a"]);
  assert.equal(narrationPathApproved("/audio/narration/alice/a.mp3", byFile, approved), true);
  assert.equal(narrationPathApproved("/audio/narration/alice/b.mp3", byFile, approved), false);
  assert.equal(narrationPathApproved("/audio/narration/alice/missing.mp3", byFile, approved), false);
});

test("the published catalogue is waiting for human listening", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/content/narration-manifest.json", import.meta.url), "utf8"));
  const released = releasedNarrationPaths(manifest.items);
  assert.equal(manifest.items.length, 874);
  assert.equal(released.size, 0);
});

test("node and webcrypto sign the same narration URL", async () => {
  const pathname = "/audio/narration/alice/clip.mp3";
  const exp = "2000000000";
  const secret = "local-narration-access-only";
  const nodeSignature = signNarrationPath(pathname, exp, secret);
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${Math.trunc(Number(exp))}.${pathname}`));
  const webSignature = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  assert.equal(webSignature, nodeSignature);
  assert.equal(narrationSignatureValid(pathname, exp, nodeSignature, 1_999_999_000, secret), true);
  assert.equal(narrationSignatureValid(pathname, exp, nodeSignature, 2_000_000_001, secret), false);
});

test("private narration paths reject encoded, case and traversal variants", () => {
  const previous = process.env.NARRATION_AUDIO_ROOT;
  delete process.env.NARRATION_AUDIO_ROOT;
  try {
    assert.equal(privateAudioFile("/app", "/audio/narration/alice/clip.mp3"), "/app/private/audio/narration/alice/clip.mp3");
    assert.equal(canonicalNarrationPath("/%61udio/narration/alice/clip.mp3"), "");
    assert.equal(canonicalNarrationPath("/audio%2Fnarration/alice/clip.mp3"), "");
    assert.equal(canonicalNarrationPath("/Audio/narration/alice/clip.mp3"), "");
    assert.equal(canonicalNarrationPath("//audio/narration/alice/clip.mp3"), "");
    assert.equal(canonicalNarrationPath("/audio/narration/../../etc/passwd"), "");
    assert.equal(privateAudioFile("/app", "/private/secret.mp3"), "");
  } finally {
    if (previous === undefined) delete process.env.NARRATION_AUDIO_ROOT;
    else process.env.NARRATION_AUDIO_ROOT = previous;
  }
});

test("narration signing fails closed when the secret is unset", () => {
  const saved = process.env.NARRATION_ACCESS_SECRET;
  delete process.env.NARRATION_ACCESS_SECRET;
  process.env.VERCEL_ENV = "preview";
  process.env.NEXUSLEARN_ENV = "";
  try {
    assert.equal(narrationAccessSecret(), "");
    assert.equal(narrationSignatureValid("/audio/narration/alice/clip.mp3", "2000000000", "ab".repeat(32), 1_999_999_000), false);
  } finally {
    if (saved === undefined) delete process.env.NARRATION_ACCESS_SECRET;
    else process.env.NARRATION_ACCESS_SECRET = saved;
  }
});
