import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  releaseMetadataForBundle,
  validateReleaseMetadata,
} from "./content-release-evidence.mjs";

const hash = (character) => character.repeat(64);
const packs = [
  { pack_id: "en-y1-phonics", payload_sha256: hash("a") },
  { pack_id: "ma-y3-fractions", payload_sha256: hash("b") },
];

function evidenceDocument() {
  return {
    schema: "nexuslearn.content-release-evidence.v1",
    version: 1,
    metadata: {
      ai_review_identities: packs.map((pack) => ({
        content_id: pack.pack_id,
        content_hash: pack.payload_sha256,
        rubric_revision: "curriculum-send-v1",
        source_set_revision: "sources-v1",
        reviewer_implementation: "nexuslearn-ai-curriculum-send-review-v1",
      })),
      human_review_batch_id: "pilot-review-2026-09-03",
      human_review_batch_sha256: hash("c"),
      audio_release_id: `narration-release-v2-${hash("d").slice(0, 24)}`,
      audio_release_sha256: hash("d"),
      audio_catalogue_id: `variant-audio-catalog-v1-${hash("e").slice(0, 24)}`,
      audio_catalogue_sha256: hash("e"),
      audio_licence_id: "provider_terms",
      required_audio_assets: [{
        asset_id: `narration-v1-${hash("3").slice(0, 24)}`,
        text_sha256: hash("1"),
        audio_sha256: hash("2"),
        production_identity_sha256: hash("3"),
        production_profile_sha256: hash("4"),
      }],
    },
  };
}

test("live bundle metadata contains only validated, pack-bound release evidence", () => {
  const document = evidenceDocument();
  const metadata = releaseMetadataForBundle({
    channel: "live",
    packs,
    evidenceDocument: document,
    baseMetadata: { generator: "objective-pack", managed_by: "content-release" },
  });

  assert.equal(metadata.generator, "objective-pack");
  assert.equal(metadata.audio_release_id, document.metadata.audio_release_id);
  assert.deepEqual(metadata.ai_review_identities.map((item) => item.content_id), packs.map((pack) => pack.pack_id));
  assert.equal("schema" in metadata, false);
  assert.doesNotThrow(() => validateReleaseMetadata({ channel: "live", packs, metadata }));
});

test("live bundles require evidence while review and pilot may remain evidence-free", () => {
  assert.throws(
    () => releaseMetadataForBundle({ channel: "live", packs, baseMetadata: {} }),
    /live release bundle requires --release-evidence/i,
  );
  assert.deepEqual(releaseMetadataForBundle({ channel: "review", packs, baseMetadata: { generator: "test" } }), { generator: "test" });
  assert.deepEqual(releaseMetadataForBundle({ channel: "pilot", packs, baseMetadata: { generator: "test" } }), { generator: "test" });
});

test("release evidence fails closed for stale, partial, duplicate or unsupported identities", () => {
  const cases = [
    ["pack hash", (document) => { document.metadata.ai_review_identities[0].content_hash = hash("9"); }],
    ["every pack", (document) => { document.metadata.ai_review_identities.pop(); }],
    ["unique", (document) => { document.metadata.ai_review_identities[1].content_id = packs[0].pack_id; }],
    ["licence", (document) => { document.metadata.audio_licence_id = "unknown_terms"; }],
    ["audio release", (document) => { document.metadata.audio_release_sha256 = hash("9"); }],
    ["unique", (document) => { document.metadata.required_audio_assets.push({ ...document.metadata.required_audio_assets[0] }); }],
    ["unknown field", (document) => { document.metadata.provider_api_key = "must-not-enter-release-metadata"; }],
  ];

  for (const [expected, mutate] of cases) {
    const document = evidenceDocument();
    mutate(document);
    assert.throws(
      () => releaseMetadataForBundle({ channel: "live", packs, evidenceDocument: document, baseMetadata: {} }),
      new RegExp(expected, "i"),
      expected,
    );
  }
});

test("offline manifest validation repeats evidence checks and rejects secret-shaped fields", () => {
  const metadata = {
    generator: "objective-pack",
    managed_by: "content-release",
    ...evidenceDocument().metadata,
  };
  metadata.required_audio_assets[0].credential = "do-not-publish";

  assert.throws(
    () => validateReleaseMetadata({ channel: "live", packs, metadata }),
    /credential|unknown field/i,
  );

  assert.throws(
    () => releaseMetadataForBundle({
      channel: "review",
      packs,
      baseMetadata: { audit: { providerApiKey: "must-not-enter-release-metadata" } },
    }),
    /credential|forbidden/i,
  );
});

test("release audio evidence cannot exceed the backend manifest import bound", () => {
  const document = evidenceDocument();
  document.metadata.required_audio_assets = Array.from({ length: 5001 }, (_, index) => {
    const identity = createHash("sha256").update(`production-${index}`).digest("hex");
    return {
      asset_id: `narration-v1-${identity.slice(0, 24)}`,
      text_sha256: hash("1"),
      audio_sha256: hash("2"),
      production_identity_sha256: identity,
      production_profile_sha256: hash("4"),
    };
  });

  assert.throws(
    () => releaseMetadataForBundle({ channel: "live", packs, evidenceDocument: document, baseMetadata: {} }),
    /between 1 and 5000/i,
  );
});
