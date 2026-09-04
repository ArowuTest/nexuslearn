const sha256Pattern = /^[a-f0-9]{64}$/;
const audioReleaseIDPattern = /^narration-release-v2-[a-f0-9]{24}$/;
const audioCatalogueIDPattern = /^variant-audio-catalog-v1-[a-f0-9]{24}$/;
const audioAssetIDPattern = /^narration-v1-[a-f0-9]{24}$/;
const sensitiveFieldPattern = /api[^a-z0-9]*key|token|secret|password|credential|transcript/i;
const evidenceKeys = [
  "ai_review_identities",
  "human_review_batch_id",
  "human_review_batch_sha256",
  "audio_release_id",
  "audio_release_sha256",
  "audio_catalogue_id",
  "audio_catalogue_sha256",
  "audio_licence_id",
  "required_audio_assets",
];
const aiIdentityKeys = ["content_id", "content_hash", "rubric_revision", "source_set_revision", "reviewer_implementation"];
const audioIdentityKeys = ["asset_id", "text_sha256", "audio_sha256", "production_identity_sha256", "production_profile_sha256"];

export function releaseMetadataForBundle({ channel, packs, evidenceDocument, baseMetadata = {} }) {
  assertChannel(channel);
  assertRecord(baseMetadata, "base release metadata");
  rejectSensitiveFields(baseMetadata, "base release metadata");
  if (evidenceDocument === undefined || evidenceDocument === null) {
    validateReleaseMetadata({ channel, packs, metadata: baseMetadata });
    return { ...baseMetadata };
  }

  assertRecord(evidenceDocument, "release evidence document");
  assertExactFields(evidenceDocument, ["schema", "version", "metadata"], "release evidence document");
  if (evidenceDocument.schema !== "nexuslearn.content-release-evidence.v1" || evidenceDocument.version !== 1) {
    throw new Error("release evidence document must use nexuslearn.content-release-evidence.v1 version 1");
  }
  const normalized = validateEvidenceMetadata(evidenceDocument.metadata, packs);
  const metadata = { ...baseMetadata, ...normalized };
  validateReleaseMetadata({ channel, packs, metadata });
  return metadata;
}

export function validateReleaseMetadata({ channel, packs, metadata }) {
  assertChannel(channel);
  assertRecord(metadata, "release metadata");
  rejectSensitiveFields(metadata, "release metadata");
  const present = evidenceKeys.filter((key) => Object.hasOwn(metadata, key));
  if (present.length === 0) {
    if (channel === "live") throw new Error("live release bundle requires --release-evidence");
    return null;
  }
  const missing = evidenceKeys.filter((key) => !Object.hasOwn(metadata, key));
  if (missing.length > 0) throw new Error(`release metadata is missing evidence field ${missing[0]}`);
  return validateEvidenceMetadata(Object.fromEntries(evidenceKeys.map((key) => [key, metadata[key]])), packs);
}

function validateEvidenceMetadata(metadata, packs) {
  assertRecord(metadata, "release evidence metadata");
  assertExactFields(metadata, evidenceKeys, "release evidence metadata");
  rejectSensitiveFields(metadata, "release evidence metadata");
  const packMap = validatePacks(packs);

  if (!Array.isArray(metadata.ai_review_identities) || metadata.ai_review_identities.length !== packMap.size) {
    throw new Error("AI review identities must cover every pack exactly once");
  }
  const identities = new Map();
  let reviewPolicy;
  for (const [index, identity] of metadata.ai_review_identities.entries()) {
    assertRecord(identity, `AI review identity ${index}`);
    assertExactFields(identity, aiIdentityKeys, `AI review identity ${index}`);
    const expectedHash = packMap.get(identity.content_id);
    if (identities.has(identity.content_id)) throw new Error(`AI review identities must be unique: ${identity.content_id}`);
    if (!expectedHash) throw new Error(`AI review identity does not match any release pack: ${identity.content_id}`);
    if (!validSHA(identity.content_hash) || identity.content_hash !== expectedHash) {
      throw new Error(`AI review pack hash does not match ${identity.content_id}`);
    }
    for (const key of ["rubric_revision", "source_set_revision", "reviewer_implementation"]) assertSafeLabel(identity[key], `AI review ${key}`);
    const policy = `${identity.rubric_revision}\u0000${identity.source_set_revision}\u0000${identity.reviewer_implementation}`;
    if (reviewPolicy !== undefined && reviewPolicy !== policy) throw new Error("AI review identities must use one consistent review policy");
    reviewPolicy = policy;
    identities.set(identity.content_id, { ...identity });
  }

  assertSafeLabel(metadata.human_review_batch_id, "human review batch ID");
  if (!validSHA(metadata.human_review_batch_sha256)) throw new Error("human review batch SHA-256 is invalid");
  requireSignedID(metadata.audio_release_id, metadata.audio_release_sha256, audioReleaseIDPattern, "narration-release-v2-", "audio release");
  requireSignedID(metadata.audio_catalogue_id, metadata.audio_catalogue_sha256, audioCatalogueIDPattern, "variant-audio-catalog-v1-", "audio catalogue");
  if (metadata.audio_licence_id !== "provider_terms") throw new Error("audio licence must be provider_terms");
  if (!Array.isArray(metadata.required_audio_assets) || metadata.required_audio_assets.length === 0 || metadata.required_audio_assets.length > 25000) {
    throw new Error("required audio assets must contain between 1 and 25000 identities");
  }
  const assets = new Map();
  for (const [index, asset] of metadata.required_audio_assets.entries()) {
    assertRecord(asset, `required audio identity ${index}`);
    assertExactFields(asset, audioIdentityKeys, `required audio identity ${index}`);
    if (!audioAssetIDPattern.test(asset.asset_id)) throw new Error(`required audio asset ID is invalid at index ${index}`);
    for (const key of audioIdentityKeys.slice(1)) {
      if (!validSHA(asset[key])) throw new Error(`required audio ${key} is invalid for ${asset.asset_id}`);
    }
    if (!asset.asset_id.endsWith(asset.production_identity_sha256.slice(0, 24))) {
      throw new Error(`required audio asset ID does not bind its production identity: ${asset.asset_id}`);
    }
    if (assets.has(asset.asset_id)) throw new Error(`required audio identities must be unique: ${asset.asset_id}`);
    assets.set(asset.asset_id, { ...asset });
  }

  return {
    ai_review_identities: [...identities.values()].sort((left, right) => left.content_id.localeCompare(right.content_id)),
    human_review_batch_id: metadata.human_review_batch_id,
    human_review_batch_sha256: metadata.human_review_batch_sha256,
    audio_release_id: metadata.audio_release_id,
    audio_release_sha256: metadata.audio_release_sha256,
    audio_catalogue_id: metadata.audio_catalogue_id,
    audio_catalogue_sha256: metadata.audio_catalogue_sha256,
    audio_licence_id: metadata.audio_licence_id,
    required_audio_assets: [...assets.values()].sort((left, right) => left.asset_id.localeCompare(right.asset_id)),
  };
}

function validatePacks(packs) {
  if (!Array.isArray(packs) || packs.length === 0) throw new Error("release evidence requires at least one pack descriptor");
  const out = new Map();
  for (const pack of packs) {
    if (!pack || typeof pack.pack_id !== "string" || !validSHA(pack.payload_sha256)) throw new Error("release pack descriptor identity is invalid");
    if (out.has(pack.pack_id)) throw new Error(`release pack descriptors must be unique: ${pack.pack_id}`);
    out.set(pack.pack_id, pack.payload_sha256);
  }
  return out;
}

function requireSignedID(id, digest, pattern, prefix, label) {
  if (!pattern.test(id) || !validSHA(digest) || id !== `${prefix}${digest.slice(0, 24)}`) {
    throw new Error(`${label} ID and SHA-256 do not match`);
  }
}

function assertExactFields(value, allowed, label) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`${label} contains unknown field ${unknown}`);
  const missing = allowed.find((key) => !Object.hasOwn(value, key));
  if (missing) throw new Error(`${label} is missing field ${missing}`);
}

function rejectSensitiveFields(value, context) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveFields(item, `${context}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveFieldPattern.test(key)) throw new Error(`${context} contains forbidden credential or transcript field ${key}`);
    rejectSensitiveFields(child, `${context}.${key}`);
  }
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertSafeLabel(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > 200) throw new Error(`${label} is invalid`);
}

function assertChannel(channel) {
  if (!["review", "pilot", "live"].includes(channel)) throw new Error("release channel must be review, pilot or live");
}

function validSHA(value) {
  return sha256Pattern.test(String(value ?? ""));
}
