import crypto from "node:crypto";

const CATALOG_VERSION = 1;
const AUDIO_REFERENCE_FIELDS = new Set([
  "audio_asset_id",
  "audio_ref",
  "whole_audio_asset_id",
  "whole_word_audio_asset_id",
]);
const AUDIO_REFERENCE_ARRAY_FIELDS = new Set([
  "audio_asset_ids",
  "whole_word_audio_asset_ids",
  "phoneme_audio_asset_ids",
]);
const PROFILE_FIELDS = new Set(["provider", "voice_id", "model_id", "output_format", "voice_settings", "speed_by_year"]);
const SECRET_FIELD = /(api[_-]?key|token|password|secret|credential|private[_-]?key)/i;

export function canonicalJSONStringify(value) {
  return JSON.stringify(sortForCanonicalJSON(value));
}

function sortForCanonicalJSON(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJSON);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortForCanonicalJSON(value[key])]),
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function validateProductionProfile(profile, allowSpeedPolicy) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("production profile must be an object");
  }
  for (const key of Object.keys(profile)) {
    if (!PROFILE_FIELDS.has(key)) throw new Error(`production profile field ${key} is not allowed`);
  }
  if (profile.speed_by_year !== undefined && !allowSpeedPolicy) {
    throw new Error("production identity requires resolved voice settings, not speed_by_year policy");
  }
  for (const field of ["provider", "voice_id", "model_id", "output_format"]) {
    if (typeof profile[field] !== "string" || !profile[field].trim()) {
      throw new Error(`production profile ${field} is required`);
    }
  }
  if (!profile.voice_settings || typeof profile.voice_settings !== "object" || Array.isArray(profile.voice_settings)) {
    throw new Error("production profile voice_settings must be an object");
  }
  rejectSecretFields(profile.voice_settings, "production profile voice_settings");
  if (profile.speed_by_year !== undefined) {
    if (!profile.speed_by_year || typeof profile.speed_by_year !== "object" || Array.isArray(profile.speed_by_year)) {
      throw new Error("production profile speed_by_year must be an object");
    }
    for (let year = 1; year <= 7; year += 1) {
      const speed = profile.speed_by_year[year];
      if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0.5 || speed > 1.2) {
        throw new Error(`production profile speed_by_year.${year} must be from 0.5 to 1.2`);
      }
    }
    const unexpected = Object.keys(profile.speed_by_year).filter((year) => !/^[1-7]$/.test(year));
    if (unexpected.length) throw new Error(`production profile speed_by_year field ${unexpected[0]} is not allowed`);
  }
}

function rejectSecretFields(value, location) {
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_FIELD.test(key)) throw new Error(`${location} field ${key} is not allowed`);
    rejectSecretFields(entry, `${location}.${key}`);
  }
}

function normaliseProductionProfile(profile, { allowSpeedPolicy = false } = {}) {
  validateProductionProfile(profile, allowSpeedPolicy);
  const normalised = {
    provider: profile.provider.trim(),
    voice_id: profile.voice_id.trim(),
    model_id: profile.model_id.trim(),
    output_format: profile.output_format.trim(),
    voice_settings: sortForCanonicalJSON(profile.voice_settings),
  };
  if (profile.speed_by_year !== undefined) {
    normalised.speed_by_year = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => String(index + 1))
        .map((year) => [year, profile.speed_by_year[year]]),
    );
  }
  return normalised;
}

export function productionIdentity({ text_sha256: textSHA256, production_profile: profile }) {
  if (!/^[a-f0-9]{64}$/.test(String(textSHA256 ?? ""))) {
    throw new Error("production identity requires a lowercase transcript sha256");
  }
  const productionProfile = normaliseProductionProfile(profile);
  const productionProfileSHA256 = sha256(canonicalJSONStringify(productionProfile));
  const identitySHA256 = sha256(canonicalJSONStringify({
    version: CATALOG_VERSION,
    text_sha256: textSHA256,
    production_profile_sha256: productionProfileSHA256,
  }));
  return {
    production_asset_id: `narration-v${CATALOG_VERSION}-${identitySHA256.slice(0, 24)}`,
    production_identity_sha256: identitySHA256,
    production_profile_sha256: productionProfileSHA256,
  };
}

export function extractVariantAudioReferences(pack) {
  const packID = String(pack?.pack_id ?? "").trim();
  const year = Number(pack?.source_alignment?.year);
  if (!packID) throw new Error("variant audio catalogue requires pack_id");
  if (!Number.isInteger(year) || year < 1 || year > 7) {
    throw new Error(`${packID}: variant audio catalogue requires source_alignment.year from 1 to 7`);
  }
  const subject = subjectForPack(packID);
  const references = [];
  for (const [variantIndex, variant] of (pack.question_variants ?? []).entries()) {
    const sourceVariantID = String(
      variant?.variant_id ?? variant?.id ?? variant?.question_variant_id ?? `index-${variantIndex}`,
    ).trim();
    walkAudioReferenceFields(
      variant,
      (referenceField, value, owner, referenceLocation) => {
        const referenceID = typeof value === "string" ? value.trim() : "";
        if (!referenceID) return;
        const narration = variantNarration(variant, owner, referenceField, referenceID);
        references.push({
          reference_id: referenceID,
          pack_id: packID,
          year,
          subject,
          source_variant_id: sourceVariantID,
          reference_field: referenceField,
          reference_location: `question_variants[${variantIndex}].${referenceLocation}`,
          text: narration.text,
          text_source: narration.text_source,
          status: narration.status,
        });
      },
      "",
    );
  }
  return references.sort(compareOccurrences);
}

function subjectForPack(packID) {
  if (packID.startsWith("en-")) return "English";
  if (packID.startsWith("ma-")) return "Mathematics";
  if (packID.startsWith("sc-")) return "Science";
  return "Other";
}

function walkAudioReferenceFields(value, visit, location, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const next = location ? `${location}[${index}]` : `[${index}]`;
      walkAudioReferenceFields(entry, visit, next, seen);
    });
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const next = location ? `${location}.${key}` : key;
    if (AUDIO_REFERENCE_FIELDS.has(key)) visit(key, entry, value, next);
    if (AUDIO_REFERENCE_ARRAY_FIELDS.has(key) && Array.isArray(entry)) {
      entry.forEach((reference, index) => visit(key, reference, value, `${next}[${index}]`));
    }
    if (entry && typeof entry === "object") walkAudioReferenceFields(entry, visit, next, seen);
  }
}

function variantNarration(variant, owner, referenceField, referenceID) {
  const candidates = [owner, variant, variant?.body]
    .filter((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate));
  if (
    referenceField === "phoneme_audio_asset_ids"
    || referenceID.startsWith("phoneme-")
    || candidates.some((candidate) => candidate.pure_phoneme_audio_referenced === true)
  ) {
    return { text: "", text_source: "specialist_pure_phoneme", status: "specialist_required" };
  }
  const spokenWord = candidates
    .map((candidate) => {
      if (typeof candidate.target_word === "string") return candidate.target_word.trim();
      if (typeof candidate.word === "string") return candidate.word.trim();
      return "";
    })
    .find(Boolean);
  if (referenceID.startsWith("word-")) {
    const isPluralReference = AUDIO_REFERENCE_ARRAY_FIELDS.has(referenceField);
    return {
      text: !isPluralReference && spokenWord
        ? spokenWord
        : referenceID.slice("word-".length).replaceAll("-", " ").trim(),
      text_source: !isPluralReference && spokenWord
        ? "authored_spoken_word_fallback"
        : "governed_word_asset_id",
      status: "production_required",
    };
  }
  const authoredScript = candidates
    .map((candidate) => {
      if (typeof candidate.narration_script === "string") return candidate.narration_script.trim();
      if (typeof candidate.audio_script === "string") return candidate.audio_script.trim();
      return "";
    })
    .find(Boolean);
  if (authoredScript) {
    return { text: authoredScript, text_source: "authored_narration_script", status: "production_required" };
  }
  if (referenceField !== "whole_audio_asset_id") {
    if (spokenWord) {
      return { text: spokenWord, text_source: "authored_spoken_word_fallback", status: "production_required" };
    }
  }
  const prompt = candidates
    .map((candidate) => {
      if (typeof candidate.prompt === "string") return candidate.prompt.trim();
      if (typeof candidate.verbal_route === "string") return candidate.verbal_route.trim();
      return "";
    })
    .find(Boolean);
  if (prompt) {
    return {
      text: canonicaliseVariantPrompt(prompt),
      text_source: "authored_variant_prompt_fallback",
      status: "production_required",
    };
  }
  return { text: "", text_source: "", status: "unresolved" };
}

function canonicaliseVariantPrompt(value) {
  return value
    .replace(/\bmission\s+\d+\s*:?/gi, "Mission:")
    .replace(/\bquestion\s+\d+\s*:?/gi, "Question:")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildVariantAudioCatalog(packs, productionProfileInput) {
  const productionPolicy = normaliseProductionProfile(productionProfileInput, { allowSpeedPolicy: true });
  const occurrences = (packs ?? [])
    .flatMap(extractVariantAudioReferences)
    .sort(compareOccurrences);
  const referencesByID = new Map();

  for (const occurrence of occurrences) {
    const textSHA256 = occurrence.text ? sha256(occurrence.text) : "";
    const existing = referencesByID.get(occurrence.reference_id);
    if (existing && (existing.text_sha256 !== textSHA256 || existing.status !== occurrence.status)) {
      const first = existing.occurrences[0];
      throw new Error(
        `variant audio reference ${occurrence.reference_id} has conflicting spoken text at `
        + `${first.pack_id}/${first.source_variant_id}/${first.reference_location} and `
        + `${occurrence.pack_id}/${occurrence.source_variant_id}/${occurrence.reference_location}`,
      );
    }
    const provenance = occurrenceProvenance(occurrence);
    if (existing) {
      existing.occurrences.push(provenance);
      existing.text_sources.add(occurrence.text_source);
      continue;
    }
    referencesByID.set(occurrence.reference_id, {
      reference_id: occurrence.reference_id,
      status: occurrence.status,
      text: occurrence.text,
      text_sha256: textSHA256,
      text_sources: new Set([occurrence.text_source]),
      occurrences: [provenance],
    });
  }

  const assetsByID = new Map();
  const references = [];
  const blockers = [];
  for (const reference of [...referencesByID.values()].sort((left, right) => left.reference_id.localeCompare(right.reference_id))) {
    reference.occurrences.sort(compareOccurrences);
    if (reference.status !== "production_required") {
      const code = reference.status === "specialist_required" ? "specialist_phoneme_required" : "spoken_text_unresolved";
      blockers.push({
        code,
        reference_id: reference.reference_id,
        occurrences: reference.occurrences,
      });
      references.push(renderReference(reference));
      continue;
    }
    const productionProfile = resolveProductionProfile(productionPolicy, reference);
    const identity = productionIdentity({
      text_sha256: reference.text_sha256,
      production_profile: productionProfile,
    });
    const asset = assetsByID.get(identity.production_asset_id) ?? {
      ...identity,
      text: reference.text,
      text_sha256: reference.text_sha256,
      production_profile: productionProfile,
      reference_ids: [],
      reuse_count: 0,
    };
    asset.reference_ids.push(reference.reference_id);
    asset.reuse_count += reference.occurrences.length;
    assetsByID.set(identity.production_asset_id, asset);
    references.push(renderReference({ ...reference, ...identity }));
  }

  const assets = [...assetsByID.values()]
    .map((asset) => ({ ...asset, reference_ids: [...asset.reference_ids].sort() }))
    .sort((left, right) => left.production_asset_id.localeCompare(right.production_asset_id));
  blockers.sort((left, right) => left.reference_id.localeCompare(right.reference_id));
  const specialistRequired = references.filter((item) => item.status === "specialist_required").length;
  const unresolved = references.filter((item) => item.status === "unresolved").length;
  const productionOccurrences = references
    .filter((item) => item.status === "production_required")
    .reduce((sum, item) => sum + item.occurrences.length, 0);
  const totals = {
    reference_occurrences: occurrences.length,
    reference_ids: references.length,
    production_required_reference_ids: references.length - specialistRequired - unresolved,
    production_assets: assets.length,
    deduplicated_recordings: Math.max(0, productionOccurrences - assets.length),
    specialist_required: specialistRequired,
    unresolved,
  };
  const identityPayload = {
    version: CATALOG_VERSION,
    production_profile: productionPolicy,
    totals,
    assets,
    references,
    blockers,
  };
  const catalogueHash = sha256(canonicalJSONStringify(identityPayload));
  return {
    ...identityPayload,
    catalogue_id: `variant-audio-catalog-v${CATALOG_VERSION}-${catalogueHash.slice(0, 24)}`,
    catalogue_sha256: catalogueHash,
  };
}

function resolveProductionProfile(productionPolicy, reference) {
  const base = {
    provider: productionPolicy.provider,
    voice_id: productionPolicy.voice_id,
    model_id: productionPolicy.model_id,
    output_format: productionPolicy.output_format,
    voice_settings: productionPolicy.voice_settings,
  };
  if (!productionPolicy.speed_by_year) return base;
  const requiredSpeed = Math.min(
    ...reference.occurrences.map((occurrence) => productionPolicy.speed_by_year[occurrence.year]),
  );
  return {
    ...base,
    voice_settings: {
      ...base.voice_settings,
      speed: requiredSpeed,
    },
  };
}

function occurrenceProvenance(occurrence) {
  return {
    pack_id: occurrence.pack_id,
    year: occurrence.year,
    subject: occurrence.subject,
    source_variant_id: occurrence.source_variant_id,
    reference_field: occurrence.reference_field,
    reference_location: occurrence.reference_location,
    text_source: occurrence.text_source,
  };
}

function renderReference(reference) {
  const result = {
    reference_id: reference.reference_id,
    status: reference.status,
    text: reference.text,
    text_sha256: reference.text_sha256,
    text_sources: [...reference.text_sources].filter(Boolean).sort(),
    occurrences: reference.occurrences,
  };
  if (reference.production_asset_id) {
    result.production_asset_id = reference.production_asset_id;
    result.production_identity_sha256 = reference.production_identity_sha256;
    result.production_profile_sha256 = reference.production_profile_sha256;
  }
  return result;
}

function compareOccurrences(left, right) {
  return left.pack_id.localeCompare(right.pack_id)
    || left.source_variant_id.localeCompare(right.source_variant_id)
    || left.reference_location.localeCompare(right.reference_location)
    || String(left.reference_id ?? "").localeCompare(String(right.reference_id ?? ""));
}
