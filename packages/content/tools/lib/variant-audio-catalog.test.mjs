import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVariantAudioCatalog,
  canonicalJSONStringify,
  extractVariantAudioReferences,
  productionIdentity,
} from "./variant-audio-catalog.mjs";

const productionProfile = {
  provider: "ElevenLabs",
  voice_id: "alice-british",
  model_id: "eleven_multilingual_v2",
  output_format: "mp3_44100_128",
  voice_settings: {
    stability: 0.55,
    similarity_boost: 0.75,
    style: 0.15,
    use_speaker_boost: true,
    speed: 0.94,
  },
};

function pack(packID, variants, year = 3) {
  return {
    pack_id: packID,
    source_alignment: { year },
    question_variants: variants,
  };
}

function spokenVariant(variantID, referenceID, text, extraBody = {}) {
  return {
    variant_id: variantID,
    body: {
      audio_asset_id: referenceID,
      narration_script: text,
      ...extraBody,
    },
  };
}

test("canonical JSON and production identity are stable under object-key reordering", () => {
  assert.equal(
    canonicalJSONStringify({ z: 1, nested: { b: 2, a: 1 }, a: [3, 2] }),
    '{"a":[3,2],"nested":{"a":1,"b":2},"z":1}',
  );
  const first = productionIdentity({ text_sha256: "a".repeat(64), production_profile: productionProfile });
  const reorderedProfile = {
    voice_settings: { speed: 0.94, use_speaker_boost: true, style: 0.15, similarity_boost: 0.75, stability: 0.55 },
    output_format: "mp3_44100_128",
    model_id: "eleven_multilingual_v2",
    voice_id: "alice-british",
    provider: "ElevenLabs",
  };
  const second = productionIdentity({ text_sha256: "a".repeat(64), production_profile: reorderedProfile });
  assert.deepEqual(second, first);
  assert.match(first.production_asset_id, /^narration-v1-[a-f0-9]{24}$/);
});

test("catalogue is deterministic and deduplicates identical transcript/profile assets", () => {
  const packs = [
    pack("ma-y3-fractions", [spokenVariant("v-2", "fraction-second", "Choose one half.")]),
    pack("en-y3-reading", [spokenVariant("v-1", "reading-first", "Choose one half.")]),
  ];
  const first = buildVariantAudioCatalog(packs, productionProfile);
  const second = buildVariantAudioCatalog([...packs].reverse(), {
    ...productionProfile,
    voice_settings: { ...productionProfile.voice_settings },
  });

  assert.equal(first.catalogue_id, second.catalogue_id);
  assert.deepEqual(first.assets, second.assets);
  assert.deepEqual(first.references, second.references);
  assert.equal(first.totals.reference_ids, 2);
  assert.equal(first.totals.production_assets, 1);
  assert.equal(first.totals.deduplicated_recordings, 1);
  assert.deepEqual(first.assets[0].reference_ids, ["fraction-second", "reading-first"]);
});

test("year pacing becomes part of the exact production identity", () => {
  const pacedProfile = {
    ...productionProfile,
    speed_by_year: { 1: 0.92, 2: 0.94, 3: 0.94, 4: 0.94, 5: 0.94, 6: 0.94, 7: 0.94 },
  };
  const catalog = buildVariantAudioCatalog([
    pack("en-y1-listening", [spokenVariant("early", "early-ref", "Listen carefully.")], 1),
    pack("en-y3-listening", [spokenVariant("later", "later-ref", "Listen carefully.")], 3),
  ], pacedProfile);

  assert.equal(catalog.assets.length, 2);
  assert.deepEqual(
    catalog.assets.map((asset) => asset.production_profile.voice_settings.speed).sort(),
    [0.92, 0.94],
  );
  assert.notEqual(catalog.assets[0].production_profile_sha256, catalog.assets[1].production_profile_sha256);
});

test("a reference shared across years uses the slowest required accessible pace", () => {
  const pacedProfile = {
    ...productionProfile,
    speed_by_year: { 1: 0.92, 2: 0.94, 3: 0.94, 4: 0.94, 5: 0.94, 6: 0.94, 7: 0.94 },
  };
  const catalog = buildVariantAudioCatalog([
    pack("en-y1-words", [spokenVariant("early", "word-cup", "cup")], 1),
    pack("en-y3-words", [spokenVariant("later", "word-cup", "cup")], 3),
  ], pacedProfile);

  assert.equal(catalog.references.length, 1);
  assert.equal(catalog.assets.length, 1);
  assert.equal(catalog.assets[0].production_profile.voice_settings.speed, 0.92);
});

test("one reference aggregates all source occurrences without duplicate recordings", () => {
  const sourcePack = pack("sc-y4-sound", [
    spokenVariant("sound-a", "shared-sound-prompt", "Which sound is louder?"),
    spokenVariant("sound-b", "shared-sound-prompt", "Which sound is louder?"),
  ], 4);
  const catalog = buildVariantAudioCatalog([sourcePack], productionProfile);
  const reference = catalog.references[0];

  assert.equal(reference.reference_id, "shared-sound-prompt");
  assert.equal(reference.occurrences.length, 2);
  assert.deepEqual(reference.occurrences.map((item) => item.source_variant_id), ["sound-a", "sound-b"]);
  assert.equal(catalog.assets[0].reuse_count, 2);
  assert.equal(catalog.totals.reference_occurrences, 2);
});

test("conflicting transcript use of a reference ID fails with both locations", () => {
  const sourcePack = pack("en-y2-reading", [
    spokenVariant("first", "conflicted-ref", "Read the first word."),
    spokenVariant("second", "conflicted-ref", "Read the second word."),
  ], 2);

  assert.throws(
    () => buildVariantAudioCatalog([sourcePack], productionProfile),
    /conflicted-ref.*first.*second/i,
  );
});

test("pure phoneme references become explicit specialist blockers", () => {
  const sourcePack = pack("en-y1-phonics", [{
    variant_id: "phoneme-sh",
    body: {
      audio_asset_id: "pure-sh",
      pure_phoneme_audio_referenced: true,
      prompt: "Say the pure phoneme.",
    },
  }], 1);
  const catalog = buildVariantAudioCatalog([sourcePack], productionProfile);

  assert.equal(catalog.assets.length, 0);
  assert.equal(catalog.references[0].status, "specialist_required");
  assert.equal(catalog.blockers[0].code, "specialist_phoneme_required");
  assert.equal(catalog.totals.specialist_required, 1);
});

test("extracts prompt fallback and exact source provenance", () => {
  const [reference] = extractVariantAudioReferences(pack("ma-y5-fractions", [{
    variant_id: "fraction-fallback",
    body: { audio_ref: "fallback-ref", prompt: "Mission 42: Select three quarters." },
  }], 5));

  assert.equal(reference.text, "Mission: Select three quarters.");
  assert.equal(reference.text_source, "authored_variant_prompt_fallback");
  assert.equal(reference.pack_id, "ma-y5-fractions");
  assert.equal(reference.year, 5);
  assert.equal(reference.subject, "Mathematics");
  assert.equal(reference.reference_field, "audio_ref");
  assert.match(reference.reference_location, /question_variants\[0\]\.body\.audio_ref$/);
});

test("whole-word references speak the authored target word rather than the instruction", () => {
  const [reference] = extractVariantAudioReferences(pack("en-y2-spelling", [{
    variant_id: "build-knock",
    body: {
      whole_word_audio_asset_id: "word-knock",
      target_word: "knock",
      prompt: "Listen to the approved recording and build the word.",
    },
  }], 2));

  assert.equal(reference.text, "knock");
  assert.equal(reference.text_source, "authored_spoken_word_fallback");
});

test("plural whole-word assets are individually catalogued from their governed IDs", () => {
  const references = extractVariantAudioReferences(pack("en-y2-spelling", [{
    variant_id: "sort-words",
    body: {
      whole_word_audio_asset_ids: ["word-badge", "word-ice-cream"],
      words: ["badge", "ice cream"],
      target_word: "different-single-word-field-must-not-leak",
    },
  }], 2));

  assert.deepEqual(references.map((item) => item.reference_id), ["word-badge", "word-ice-cream"]);
  assert.deepEqual(references.map((item) => item.text), ["badge", "ice cream"]);
  assert.ok(references.every((item) => item.text_source === "governed_word_asset_id"));
  assert.match(references[1].reference_location, /whole_word_audio_asset_ids\[1\]$/);
});

test("mixed plural audio assets separate whole words from specialist phonemes", () => {
  const catalog = buildVariantAudioCatalog([pack("en-y1-blending", [{
    variant_id: "blend-cat",
    body: { audio_asset_ids: ["phoneme-k", "phoneme-a", "phoneme-t", "word-cat"] },
  }], 1)], productionProfile);

  assert.equal(catalog.totals.reference_ids, 4);
  assert.equal(catalog.totals.specialist_required, 3);
  assert.equal(catalog.totals.production_assets, 1);
  assert.equal(catalog.assets[0].text, "cat");
});

test("secret-shaped production profile fields are rejected", () => {
  assert.throws(
    () => buildVariantAudioCatalog([], { ...productionProfile, api_key: "must-not-escape" }),
    /production profile.*api_key.*not allowed/i,
  );
});
