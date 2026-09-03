import crypto from "node:crypto";
import { canonicalJSONStringify } from "./variant-audio-catalog.mjs";

const SHA256 = /^[a-f0-9]{64}$/;
const PUBLIC_STATUSES = new Set(["human_listening_approved", "approved", "production_approved", "released"]);
const SECRET_FIELD = /(api[_-]?key|token|password|secret|credential|private[_-]?key)/i;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function catalogAssetsToProductionItems(catalog) {
  validateCatalog(catalog);
  const referencesByAsset = new Map();
  for (const reference of catalog.references ?? []) {
    if (!reference.production_asset_id) continue;
    const references = referencesByAsset.get(reference.production_asset_id) ?? [];
    references.push(reference);
    referencesByAsset.set(reference.production_asset_id, references);
  }
  return [...catalog.assets]
    .sort((left, right) => left.production_asset_id.localeCompare(right.production_asset_id))
    .map((asset) => {
      const references = referencesByAsset.get(asset.production_asset_id) ?? [];
      const occurrences = references.flatMap((reference) => reference.occurrences ?? []);
      const years = [...new Set(occurrences.map((item) => item.year).filter(Number.isInteger))]
        .sort((left, right) => left - right);
      const packIDs = [...new Set(occurrences.map((item) => item.pack_id).filter(Boolean))].sort();
      const relativeFile = `canonical/variant/${asset.production_asset_id}.mp3`;
      return {
        id: asset.production_asset_id,
        production_asset_id: asset.production_asset_id,
        production_identity_sha256: asset.production_identity_sha256,
        production_profile_sha256: asset.production_profile_sha256,
        kind: "variant",
        source_id: asset.production_asset_id,
        pack_id: packIDs[0] ?? "shared-variant-audio",
        pack_ids: packIDs,
        year: years[0] ?? 0,
        years,
        text: asset.text,
        text_sha256: asset.text_sha256,
        provider: asset.production_profile.provider,
        voice_id: asset.production_profile.voice_id,
        model_id: asset.production_profile.model_id,
        output_format: asset.production_profile.output_format,
        voice_settings: asset.production_profile.voice_settings,
        reference_ids: [...asset.reference_ids].sort(),
        reuse_count: asset.reuse_count,
        relative_file: relativeFile,
        file: `/audio/narration/alice/${relativeFile}`,
        production_status: "required_human_listening_review",
      };
    });
}

export function selectProductionItems(items, { pack, year } = {}) {
  return items.filter((item) => {
    const packIDs = Array.isArray(item.pack_ids) && item.pack_ids.length ? item.pack_ids : [item.pack_id];
    const years = Array.isArray(item.years) && item.years.length ? item.years : [item.year];
    if (pack && !packIDs.includes(pack)) return false;
    if (year !== undefined && !years.includes(year)) return false;
    return true;
  });
}

export function buildNarrationManifestV2({
  catalog,
  produced_assets: producedAssets = [],
  generated_at: generatedAt = new Date().toISOString(),
  provenance = {},
}) {
  validateCatalog(catalog);
  rejectSecretFields(provenance, "manifest provenance");
  const licenceID = typeof provenance.licence === "string" ? provenance.licence : provenance.licence?.id;
  if (licenceID !== "provider_terms") throw new Error("supported provider licence evidence is required");
  const expectedItems = catalogAssetsToProductionItems(catalog);
  const expectedByID = new Map(expectedItems.map((item) => [item.id, item]));
  const assets = [...producedAssets]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((produced) => validateProducedAsset(produced, expectedByID));
  const references = [...(catalog.references ?? [])]
    .map((reference) => canonicalCopy(reference))
    .sort((left, right) => left.reference_id.localeCompare(right.reference_id));
  const blockers = [...(catalog.blockers ?? [])]
    .map((blocker) => canonicalCopy(blocker))
    .sort((left, right) => left.reference_id.localeCompare(right.reference_id));
  const canonicalProvenance = canonicalCopy(provenance);
  const identityPayload = {
    schema: "nexuslearn.narration-manifest.v2",
    version: 2,
    catalogue_id: catalog.catalogue_id,
    catalogue_sha256: catalog.catalogue_sha256,
    provenance: canonicalProvenance,
    assets,
    references,
    blockers,
  };
  const releaseSHA256 = sha256(canonicalJSONStringify(identityPayload));
  return {
    ...identityPayload,
    licence_id: licenceID,
    release_id: `narration-release-v2-${releaseSHA256.slice(0, 24)}`,
    release_sha256: releaseSHA256,
    generated_at: generatedAt,
    status: blockers.length || assets.length < catalog.totals.production_assets
      ? "incomplete_review_inventory"
      : "generated_pending_human_listening",
    provider: catalog.production_profile.provider,
    totals: {
      expected_assets: catalog.totals.production_assets,
      produced_assets: assets.length,
      reference_ids: catalog.totals.reference_ids,
      specialist_required: catalog.totals.specialist_required,
      unresolved: catalog.totals.unresolved,
    },
  };
}

function validateProducedAsset(produced, expectedByID) {
  const expected = expectedByID.get(produced.id);
  if (!expected) throw new Error(`produced narration asset ${produced.id} is not in the active catalogue`);
  if (produced.production_profile_sha256 !== expected.production_profile_sha256) {
    throw new Error(`${produced.id}: production profile does not match the active catalogue`);
  }
  if (produced.production_identity_sha256 !== expected.production_identity_sha256) {
    throw new Error(`${produced.id}: production identity does not match the active catalogue`);
  }
  if (produced.text_sha256 !== expected.text_sha256) {
    throw new Error(`${produced.id}: transcript does not match the active catalogue`);
  }
  if (!SHA256.test(String(produced.sha256 ?? ""))) {
    throw new Error(`${produced.id}: produced audio sha256 is required`);
  }
  if (!Number.isInteger(produced.bytes) || produced.bytes <= 0) {
    throw new Error(`${produced.id}: produced audio byte count is required`);
  }
  if (produced.technical_pass !== true) {
    throw new Error(`${produced.id}: produced audio must pass technical validation`);
  }
  return canonicalCopy({ ...expected, ...produced });
}

export function projectPublicNarrationManifest(manifest) {
  const assetsByID = new Map((manifest.assets ?? []).map((asset) => [asset.id, asset]));
  const references = (manifest.references ?? [])
    .map((reference) => {
      const asset = assetsByID.get(reference.production_asset_id);
      if (!asset || asset.technical_pass !== true || !PUBLIC_STATUSES.has(String(asset.production_status ?? ""))) return null;
      const years = [...new Set((reference.occurrences ?? []).map((item) => item.year).filter(Number.isInteger))]
        .sort((left, right) => left - right);
      return {
        reference_id: reference.reference_id,
        production_asset_id: reference.production_asset_id,
        file: asset.file,
        production_status: asset.production_status,
        technical_pass: true,
        years,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.reference_id.localeCompare(right.reference_id));
  return {
    schema: manifest.schema,
    version: manifest.version,
    catalogue_id: manifest.catalogue_id,
    release_id: manifest.release_id,
    status: manifest.status,
    provider: manifest.provider,
    references,
  };
}

function validateCatalog(catalog) {
  if (catalog?.version !== 1 || !String(catalog.catalogue_id ?? "").startsWith("variant-audio-catalog-v1-")) {
    throw new Error("variant audio catalogue version 1 is required");
  }
  if (!SHA256.test(String(catalog.catalogue_sha256 ?? ""))) {
    throw new Error("variant audio catalogue sha256 is required");
  }
  if (!Array.isArray(catalog.assets) || !Array.isArray(catalog.references) || !Array.isArray(catalog.blockers)) {
    throw new Error("variant audio catalogue arrays are required");
  }
}

function canonicalCopy(value) {
  return JSON.parse(canonicalJSONStringify(value));
}

function rejectSecretFields(value, location) {
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_FIELD.test(key)) throw new Error(`${location} field ${key} is not allowed`);
    rejectSecretFields(entry, `${location}.${key}`);
  }
}
