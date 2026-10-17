import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isReleasedNarration, narrationByFile, narrationPathApproved, releasedNarrationPaths, resolveNarrationCandidate } from "../src/lib/narration-policy.mjs";
import { narrationSignatureValid, signNarrationPath } from "../src/lib/narration-access.mjs";
import { safePublicAudioPath } from "../src/lib/review-audio-path.mjs";

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

test("review audio stays inside the public narration directory", () => {
  assert.equal(safePublicAudioPath("/app", "/audio/narration/alice/clip.mp3"), "/app/public/audio/narration/alice/clip.mp3");
  assert.equal(safePublicAudioPath("/app", "/audio/narration/../../etc/passwd"), "");
  assert.equal(safePublicAudioPath("/app", "/private/secret.mp3"), "");
});
