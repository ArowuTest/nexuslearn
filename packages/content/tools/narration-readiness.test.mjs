import test from "node:test";
import assert from "node:assert/strict";
import { collectVariantReferences } from "./narration-readiness.mjs";

test("collectVariantReferences expands every authored plural audio field", () => {
  const refs = collectVariantReferences([{
    pack_id: "en-y1-audio-contract",
    source_alignment: { year: 1 },
    question_variants: [{
      variant_id: "phonics-cat",
      body: {
        audio_asset_ids: ["phoneme-k", "phoneme-a", "word-cat"],
        whole_word_audio_asset_ids: ["word-cat"],
        phoneme_audio_asset_ids: ["phoneme-k", "phoneme-a"],
      },
    }],
  }]);

  assert.deepEqual(refs.map((entry) => entry.asset_id), [
    "phoneme-k", "phoneme-a", "word-cat", "phoneme-k", "phoneme-a", "word-cat",
  ]);
  assert.match(refs[5].location, /whole_word_audio_asset_ids\[0\]$/);
  assert.equal(refs[0].variant_id, "phonics-cat");
});
