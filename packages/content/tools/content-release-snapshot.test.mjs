import assert from "node:assert/strict";
import test from "node:test";
import { reconcileReleaseGate, reconcileReviewGate } from "./content-release-snapshot.mjs";
import { evaluateExactAudioReleaseGate } from "./narration-readiness.mjs";

const source = {
  controlled_pilot_allowed: true,
  rubric_revision: "rubric-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  packs: 87,
  variants: 20210,
  review_units: 6614,
};

const backend = {
  available: true,
  controlled_pilot_allowed: true,
  rubric_revision: "rubric-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  packs: 87,
  variants: 20210,
  current_ai_curriculum_lead: 6614,
  current_ai_send_lead: 6614,
  stale: 0,
  revision_required: 0,
  escalation_required: 0,
  blocking_findings: 0,
  escalation_findings: 0,
};

test("promotion remains false when backend state is unavailable", () => {
  const result = reconcileReviewGate(source, { available: false });
  assert.equal(result.promotion_allowed, false);
  assert.match(result.reason, /unavailable/);
});

test("promotion requires matching revisions and complete dual-lane coverage", () => {
  assert.equal(reconcileReviewGate(source, backend).promotion_allowed, true);
  assert.equal(reconcileReviewGate(source, { ...backend, reviewer_implementation: "reviewer-v2" }).promotion_allowed, false);
  assert.equal(reconcileReviewGate(source, { ...backend, current_ai_send_lead: 6613 }).promotion_allowed, false);
});

const hash = (character) => character.repeat(64);

function exactAudioFixture() {
  const asset = {
    id: "narration-v1-111111111111111111111111",
    pack_id: "ma-y3-fractions",
    pack_ids: ["ma-y3-fractions"],
    year: 3,
    years: [3],
    kind: "variant",
    text_sha256: hash("a"),
    sha256: hash("b"),
    production_identity_sha256: hash("c"),
    production_profile_sha256: hash("d"),
    production_status: "human_listening_approved",
    technical_pass: true,
  };
  return {
    manifest: {
      schema: "nexuslearn.narration-manifest.v2",
      version: 2,
      release_id: "narration-release-v2-111111111111111111111111",
      release_sha256: hash("1"),
      catalogue_id: "variant-audio-catalog-v1-222222222222222222222222",
      catalogue_sha256: hash("2"),
      provenance: { licence: "provider_terms" },
      totals: { expected_assets: 1, produced_assets: 1, reference_ids: 1, specialist_required: 0, unresolved: 0 },
      blockers: [],
      assets: [asset],
      references: [{
        reference_id: "fraction-second",
        status: "production_required",
        production_asset_id: asset.id,
        text_sha256: asset.text_sha256,
        production_identity_sha256: asset.production_identity_sha256,
        production_profile_sha256: asset.production_profile_sha256,
        occurrences: [{ pack_id: asset.pack_id, year: 3, subject: "Mathematics" }],
      }],
    },
    reviews: [{
      asset_id: asset.id,
      text_sha256: asset.text_sha256,
      audio_sha256: asset.sha256,
      production_profile_sha256: asset.production_profile_sha256,
      decision: "approved",
      criteria: { natural: true, clear: true, pronunciation: true, age_suitable: true },
    }],
  };
}

test("exact audio release gate accepts only a complete current fixture", () => {
  const fixture = exactAudioFixture();
  const result = evaluateExactAudioReleaseGate({ ...fixture, supportedLicences: ["provider_terms"] });

  assert.equal(result.release_ready, true);
  assert.equal(result.release_id, fixture.manifest.release_id);
  assert.equal(result.catalogue_id, fixture.manifest.catalogue_id);
  assert.equal(result.totals.required_assets, 1);
  assert.equal(result.totals.current_approvals, 1);
  assert.deepEqual(result.required_audio_assets, [{
    asset_id: fixture.manifest.assets[0].id,
    text_sha256: fixture.manifest.assets[0].text_sha256,
    audio_sha256: fixture.manifest.assets[0].sha256,
    production_identity_sha256: fixture.manifest.assets[0].production_identity_sha256,
    production_profile_sha256: fixture.manifest.assets[0].production_profile_sha256,
  }]);
  assert.deepEqual(result.blockers_by_cause, {});
});

test("exact audio release gate fails closed for every production blocker class", () => {
  const cases = [
    ["invalid_manifest", ({ manifest }) => { manifest.release_sha256 = hash("9"); }],
    ["missing", ({ manifest }) => { manifest.assets = []; manifest.totals.produced_assets = 0; }],
    ["unresolved", ({ manifest }) => { manifest.references[0].status = "unresolved"; manifest.references[0].production_asset_id = ""; manifest.totals.unresolved = 1; }],
    ["specialist_required", ({ manifest }) => { manifest.blockers = [{ code: "specialist_phoneme_required", reference_id: "fraction-second" }]; manifest.totals.specialist_required = 1; }],
    ["technical_invalid", ({ manifest }) => { manifest.assets[0].technical_pass = false; }],
    ["unapproved", ({ reviews }) => { reviews[0].decision = "rejected"; }],
    ["stale", ({ reviews }) => { reviews[0].production_profile_sha256 = hash("e"); }],
    ["unsupported_licence", ({ manifest }) => { manifest.provenance.licence = "unknown_terms"; }],
  ];

  for (const [cause, mutate] of cases) {
    const fixture = exactAudioFixture();
    mutate(fixture);
    const result = evaluateExactAudioReleaseGate({ ...fixture, supportedLicences: ["provider_terms"] });
    assert.equal(result.release_ready, false, cause);
    assert.ok(result.blockers_by_cause[cause] > 0, `${cause} blocker must be reported`);
  }
});

test("release promotion requires both reconciled AI evidence and exact audio readiness", () => {
  const readyAudio = evaluateExactAudioReleaseGate({ ...exactAudioFixture(), supportedLicences: ["provider_terms"] });
  const ready = reconcileReleaseGate(source, backend, readyAudio);
  assert.equal(ready.promotion_allowed, true);
  assert.equal(ready.production_release_allowed, false);
  assert.match(ready.production_reason, /independent human/i);

  const blocked = reconcileReleaseGate(source, backend, { ...readyAudio, release_ready: false, blockers_by_cause: { stale: 1 } });
  assert.equal(blocked.promotion_allowed, false);
  assert.match(blocked.promotion_reason, /audio/i);
});
