import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedCatalogueAudio } from "../src/lib/narration-safety.mjs";

test("unapproved catalogue narration is blocked and fixtures stay playable", () => {
  const approved = new Set(["/audio/narration/alice/ready.mp3"]);
  assert.equal(isBlockedCatalogueAudio("/audio/narration/alice/pending.mp3", approved), true);
  assert.equal(isBlockedCatalogueAudio("/audio/narration/alice/ready.mp3", approved), false);
  assert.equal(isBlockedCatalogueAudio("/qa-cat.mp3", approved), false);
  assert.equal(isBlockedCatalogueAudio("data:audio/wav;base64,AAA", approved), false);
  assert.equal(isBlockedCatalogueAudio("word-cat", approved), false);
});
