import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNarrationManifestV2,
  catalogAssetsToProductionItems,
  projectPublicNarrationManifest,
  selectProductionItems,
} from "./narration-manifest-v2.mjs";

const hash = (character) => character.repeat(64);

function catalog() {
  return {
    version: 1,
    catalogue_id: "variant-audio-catalog-v1-1234567890abcdef12345678",
    catalogue_sha256: hash("a"),
    production_profile: {
      provider: "ElevenLabs",
      voice_id: "alice",
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
      voice_settings: { stability: 0.55 },
      speed_by_year: { 1: 0.92, 2: 0.94, 3: 0.94, 4: 0.94, 5: 0.94, 6: 0.94, 7: 0.94 },
    },
    totals: { reference_ids: 2, production_assets: 1, specialist_required: 1, unresolved: 0 },
    assets: [{
      production_asset_id: "narration-v1-111111111111111111111111",
      production_identity_sha256: hash("1"),
      production_profile_sha256: hash("2"),
      text: "Choose one half.",
      text_sha256: hash("3"),
      production_profile: {
        provider: "ElevenLabs",
        voice_id: "alice",
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
        voice_settings: { stability: 0.55, speed: 0.94 },
      },
      reference_ids: ["fraction-second"],
      reuse_count: 3,
    }],
    references: [
      {
        reference_id: "fraction-second",
        status: "production_required",
        text: "Choose one half.",
        text_sha256: hash("3"),
        production_asset_id: "narration-v1-111111111111111111111111",
        production_identity_sha256: hash("1"),
        production_profile_sha256: hash("2"),
        occurrences: [{ pack_id: "ma-y3-fractions", year: 3, subject: "Mathematics", source_variant_id: "v-1" }],
      },
      {
        reference_id: "phoneme-sh",
        status: "specialist_required",
        text: "",
        text_sha256: "",
        occurrences: [{ pack_id: "en-y1-phonics", year: 1, subject: "English", source_variant_id: "v-2" }],
      },
    ],
    blockers: [{ code: "specialist_phoneme_required", reference_id: "phoneme-sh" }],
  };
}

test("catalogue assets become canonical producer items with exact profile identity", () => {
  const [item] = catalogAssetsToProductionItems(catalog());

  assert.equal(item.id, "narration-v1-111111111111111111111111");
  assert.equal(item.kind, "variant");
  assert.equal(item.relative_file, "canonical/variant/narration-v1-111111111111111111111111.mp3");
  assert.equal(item.file, "/audio/narration/alice/canonical/variant/narration-v1-111111111111111111111111.mp3");
  assert.deepEqual(item.reference_ids, ["fraction-second"]);
  assert.equal(item.voice_settings.speed, 0.94);
  assert.equal(item.production_profile_sha256, hash("2"));
});

test("manifest release identity is stable across generated time and input ordering", () => {
  const expected = catalogAssetsToProductionItems(catalog())[0];
  const produced = {
    ...expected,
    sha256: hash("4"),
    bytes: 4096,
    technical_pass: true,
    production_status: "generated_pending_human_listening",
  };
  const first = buildNarrationManifestV2({
    catalog: catalog(),
    produced_assets: [produced],
    generated_at: "2026-08-29T01:00:00.000Z",
    provenance: { licence: "provider_terms", produced_by: "governed_batch" },
  });
  const second = buildNarrationManifestV2({
    catalog: { ...catalog(), references: [...catalog().references].reverse() },
    produced_assets: [produced],
    generated_at: "2026-08-29T02:00:00.000Z",
    provenance: { produced_by: "governed_batch", licence: "provider_terms" },
  });

  assert.equal(first.release_id, second.release_id);
  assert.equal(first.version, 2);
  assert.equal(first.catalogue_id, catalog().catalogue_id);
  assert.equal(first.licence_id, "provider_terms");
  assert.equal(first.assets[0].reuse_count, 3);
  assert.equal(first.references[0].reference_id, "fraction-second");
  assert.equal(first.blockers[0].reference_id, "phoneme-sh");
});

test("manifest rejects produced bytes bound to a stale production profile", () => {
  const expected = catalogAssetsToProductionItems(catalog())[0];
  assert.throws(
    () => buildNarrationManifestV2({
      catalog: catalog(),
      produced_assets: [{
        ...expected,
        production_profile_sha256: hash("9"),
        sha256: hash("4"),
        bytes: 4096,
        technical_pass: true,
      }],
      provenance: { licence: "provider_terms" },
    }),
    /production profile.*does not match/i,
  );
});

test("public projection strips transcript, hashes, occurrences and provenance", () => {
  const expected = catalogAssetsToProductionItems(catalog())[0];
  const manifest = buildNarrationManifestV2({
    catalog: catalog(),
    produced_assets: [{
      ...expected,
      sha256: hash("4"),
      bytes: 4096,
      technical_pass: true,
      production_status: "human_listening_approved",
    }],
    provenance: { licence: "provider_terms", internal_batch_id: "batch-secret-shaped-but-not-a-key" },
  });
  const publicManifest = projectPublicNarrationManifest(manifest);
  const rendered = JSON.stringify(publicManifest);

  assert.equal(publicManifest.references[0].reference_id, "fraction-second");
  assert.equal(publicManifest.references[0].file, manifest.assets[0].file);
  for (const forbidden of ["Choose one half", "text_sha256", "sha256", "occurrences", "provenance", "internal_batch_id"]) {
    assert.equal(rendered.includes(forbidden), false, forbidden);
  }
});

test("production selection retains shared assets for every bound year and pack", () => {
  const shared = {
    id: "shared",
    pack_id: "en-y1-words",
    pack_ids: ["en-y1-words", "en-y3-words"],
    year: 1,
    years: [1, 3],
  };

  assert.deepEqual(selectProductionItems([shared], { year: 3 }), [shared]);
  assert.deepEqual(selectProductionItems([shared], { pack: "en-y3-words" }), [shared]);
  assert.deepEqual(selectProductionItems([shared], { year: 2 }), []);
});
