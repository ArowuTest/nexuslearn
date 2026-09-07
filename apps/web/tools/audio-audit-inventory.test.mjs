import test from "node:test";
import assert from "node:assert/strict";
import { reconcileAudioInventory, fatalAudioAudit } from "./audio-audit-inventory.mjs";

const item = { id: "clip", file: "/audio/clip.mp3" };
test("matching manifests and disk have no inventory issues", () => {
  assert.deepEqual(reconcileAudioInventory([item], [item], [item.file]), []);
});
test("empty catalogues cannot pass a whole-catalogue audit", () => {
  assert.ok(reconcileAudioInventory([], [], []).some(i => i.code === "empty_catalogue"));
});
test("duplicates cannot be silently discarded by a Map", () => {
  const issues = reconcileAudioInventory([item, item], [item, item], [item.file]);
  for (const code of ["duplicate_private_id", "duplicate_private_file", "duplicate_public_id", "duplicate_public_file"]) {
    assert.ok(issues.some(i => i.code === code), code);
  }
});
test("both directions of manifest and disk reconciliation are checked", () => {
  const issues = reconcileAudioInventory([item], [{ id: "extra", file: "/audio/extra.mp3" }], ["/audio/orphan.mp3"]);
  for (const code of ["missing_file", "public_manifest_mismatch", "public_manifest_orphan", "orphan_file"]) {
    assert.ok(issues.some(i => i.code === code), code);
  }
});
test("unsafe paths and malformed entries fail closed", () => {
  for (const file of ["/audio/../secret.mp3", "https://example.com/clip.mp3", "/audio/%2e%2e/secret.mp3", "/audio/clip.mp3?x=1", "/audio\\clip.mp3"]) {
    assert.ok(reconcileAudioInventory([{ ...item, file }], [], []).some(i => i.code === "invalid_private_entry"));
  }
  assert.ok(reconcileAudioInventory([null], [null], []).length);
});
test("integrity issues fail but pace and missing speed metadata are review only", () => {
  assert.equal(fatalAudioAudit([], [{ flags: ["pace_review_fast", "generation_speed_not_recorded"] }]), false);
  assert.equal(fatalAudioAudit([{ code: "orphan_file" }], []), true);
  for (const flag of ["decode_failed", "silent_audio", "audio_hash_mismatch", "script_hash_mismatch", "frame_inspection_failed", "invalid_pcm_samples"]) {
    assert.equal(fatalAudioAudit([], [{ flags: [flag] }]), true, flag);
  }
});
