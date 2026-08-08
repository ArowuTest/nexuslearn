#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { sha256Content } from "./lib/review-evidence.mjs";

const toolPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(toolPath), "../../..");
const defaultBatchPath = path.join(repoRoot, "packages/content/generated/coverage/ai-review-batch.json");
const defaultReportPath = path.join(repoRoot, "packages/content/generated/coverage/ai-review-evidence.json");
const retryStatuses = new Set([429, 502, 503, 504]);
const lanes = new Set(["ai_curriculum_lead", "ai_send_lead"]);

export function evidenceIdempotencyKey(evidence) {
  const fields = [
    evidence.content_id,
    evidence.content_hash,
    evidence.lane_id,
    evidence.rubric_revision,
    evidence.source_set_revision,
    evidence.reviewer_implementation,
  ];
  if (fields.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("immutable review identity is incomplete");
  }
  return createHash("sha256").update(fields.join("\u0000")).digest("hex");
}

export function verifyBatchIdentity(batch) {
  if (!batch || typeof batch !== "object" || !Array.isArray(batch.packs)) throw new Error("review batch is malformed");
  if (!batch.batch_hash) return batch;
  const { batch_id: _batchID, batch_hash: _batchHash, ...body } = batch;
  const actual = sha256Content(body);
  if (actual !== batch.batch_hash || batch.batch_id !== `ai-review-${actual.slice(0, 20)}`) {
    throw new Error("review batch hash does not match its material content");
  }
  return batch;
}

export async function importEvidence({ report, batch, api, dryRun = false, maxRetries = 4, sleep = defaultSleep, onProgress }) {
  verifyBatchIdentity(batch);
  const decisions = Array.isArray(report?.evidence) ? report.evidence : [];
  if (report?.batch_hash && report.batch_hash !== batch.batch_hash) throw new Error("evidence report does not match the current review batch");
  const current = reviewUnitIndex(batch);
  const ordered = [...decisions].sort(compareEvidence);
  const seen = new Set();

  for (const evidence of ordered) {
    const unit = current.get(evidence.content_id);
    if (!unit || !evidenceMatchesUnit(evidence, unit, batch)) throw new Error(`stale review unit ${evidence.content_id}`);
    if (!lanes.has(evidence.lane_id)) throw new Error(`unsupported review lane for ${evidence.content_id}`);
    const key = evidenceIdempotencyKey(evidence);
    if (seen.has(key)) throw new Error(`duplicate review identity ${evidence.content_id} ${evidence.lane_id}`);
    seen.add(key);
  }

  let imported = 0;
  for (const evidence of ordered) {
    if (!dryRun) await saveWithRetry(api, evidence, evidenceIdempotencyKey(evidence), { maxRetries, sleep });
    imported++;
    onProgress?.({ imported, total: ordered.length, dryRun });
  }
  return { total: ordered.length, imported, network_writes: dryRun ? 0 : imported, malformed_identities: 0 };
}

export function createReviewAPI({ baseURL, token, fetchImpl = fetch }) {
  const root = String(baseURL ?? "").replace(/\/$/, "");
  if (!root) throw new Error("AI review API URL is required");
  if (!token) throw new Error("a named admin account session is required");
  return {
    async save(evidence, idempotencyKey) {
      const response = await fetchImpl(`${root}/v1/admin/ai-reviews`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(evidence),
      });
      if (!response.ok) {
        const error = new Error(`AI review API rejected an evidence record with status ${response.status}`);
        error.status = response.status;
        const retryAfter = Number(response.headers.get("retry-after"));
        error.retryAfterMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 0;
        throw error;
      }
      return response.json();
    },
  };
}

async function saveWithRetry(api, evidence, key, { maxRetries, sleep }) {
  if (!api || typeof api.save !== "function") throw new Error("review evidence API is required");
  for (let attempt = 0; ; attempt++) {
    try {
      return await api.save(evidence, key);
    } catch (error) {
      if (!retryStatuses.has(error?.status) || attempt >= maxRetries) throw error;
      const delay = error.retryAfterMs || Math.min(8_000, 250 * 2 ** attempt);
      await sleep(delay);
    }
  }
}

function reviewUnitIndex(batch) {
  const result = new Map();
  for (const pack of batch.packs) {
    addUnit(result, pack.pack_review, pack, []);
    for (const family of pack.variant_families ?? []) addUnit(result, family, pack, family.member_ids ?? []);
    const variants = new Map((pack.variants ?? []).map((variant) => [variant.id ?? variant.content_id, variant]));
    for (const variantID of pack.direct_variant_ids ?? []) {
      const variant = variants.get(variantID);
      if (!variant) throw new Error(`review batch direct unit ${variantID} is missing`);
      addUnit(result, variant, pack, [variantID]);
    }
  }
  return result;
}

function addUnit(result, value, pack, reviewedVariantIDs) {
  if (!value?.content_id) throw new Error(`review batch contains an unidentified unit in ${pack.pack_id}`);
  if (result.has(value.content_id)) throw new Error(`review batch contains duplicate unit ${value.content_id}`);
  result.set(value.content_id, {
    content_id: value.content_id,
    content_type: value.content_type,
    content_revision: value.content_revision ?? pack.content_revision,
    content_hash: value.content_hash,
    pack_id: pack.pack_id,
    year_group: pack.year_group,
    subject: pack.subject,
    risk_tier: value.risk_tier,
    reviewed_variant_ids: reviewedVariantIDs,
  });
}

function evidenceMatchesUnit(evidence, unit, batch) {
  const scalarFields = ["content_id", "content_type", "content_revision", "content_hash", "pack_id", "year_group", "subject", "risk_tier"];
  if (scalarFields.some((field) => evidence[field] !== unit[field])) return false;
  if (evidence.rubric_revision !== batch.rubric_revision || evidence.source_set_revision !== batch.source_set_revision ||
      evidence.reviewer_implementation !== batch.reviewer_implementation) return false;
  const reviewed = [...(evidence.reviewed_variant_ids ?? [])].sort();
  return JSON.stringify(reviewed) === JSON.stringify([...unit.reviewed_variant_ids].sort());
}

function compareEvidence(left, right) {
  return left.content_id.localeCompare(right.content_id) || left.lane_id.localeCompare(right.lane_id) ||
    left.content_hash.localeCompare(right.content_hash);
}

async function loadImportReport(reportPath, batch) {
  const artifact = await readJSON(reportPath);
  if (artifact.batch_hash !== batch.batch_hash) throw new Error("evidence report does not match the current review batch");
  const decisions = [];
  for (const relativePath of artifact.decision_files ?? []) {
    const cohort = await readJSON(path.resolve(repoRoot, relativePath));
    if (cohort.batch_hash !== artifact.batch_hash || cohort.rubric_revision !== artifact.rubric_revision ||
        cohort.source_set_revision !== artifact.source_set_revision || cohort.reviewer_implementation !== artifact.reviewer_implementation) {
      throw new Error(`decision cohort ${relativePath} does not match the evidence report`);
    }
    for (const decision of cohort.decisions ?? []) {
      decisions.push({
        ...decision,
        rubric_revision: cohort.rubric_revision,
        source_set_revision: cohort.source_set_revision,
        reviewer_implementation: cohort.reviewer_implementation,
        model_identifier: decision.model_identifier ?? cohort.model_identifier,
      });
    }
  }
  verifyEvidenceIndex(artifact.evidence_index ?? [], decisions);
  return { ...artifact, evidence: decisions };
}

function verifyEvidenceIndex(index, decisions) {
  if (index.length !== decisions.length) throw new Error("evidence index does not cover every full decision");
  const indexed = new Map(index.map((item) => [`${item.content_id}\u0000${item.lane_id}`, item]));
  for (const decision of decisions) {
    const item = indexed.get(`${decision.content_id}\u0000${decision.lane_id}`);
    if (!item || item.content_hash !== decision.content_hash || item.status !== decision.status || item.risk_tier !== decision.risk_tier) {
      throw new Error(`evidence index mismatch for ${decision.content_id} ${decision.lane_id}`);
    }
  }
}

async function main() {
  const batchPath = argument("--batch") ? path.resolve(argument("--batch")) : defaultBatchPath;
  const reportPath = argument("--report") ? path.resolve(argument("--report")) : defaultReportPath;
  const dryRun = process.argv.includes("--dry-run");
  const batch = verifyBatchIdentity(await readJSON(batchPath));
  const report = await loadImportReport(reportPath, batch);
  const api = dryRun ? undefined : createReviewAPI({
    baseURL: argument("--api-url") ?? process.env.NEXUSLEARN_API_URL,
    token: process.env.NEXUSLEARN_ACCOUNT_SESSION,
  });
  const result = await importEvidence({
    report,
    batch,
    api,
    dryRun,
    onProgress: ({ imported, total }) => {
      if (!dryRun && (imported % 500 === 0 || imported === total)) console.log(`ai-review-import progress=${imported}/${total}`);
    },
  });
  console.log(`ai-review-import records=${result.total} malformed=${result.malformed_identities} writes=${result.network_writes} mode=${dryRun ? "dry-run" : "apply"}`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readJSON(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(toolPath)) {
  await main().catch((error) => {
    console.error(`ai-review-import failed: ${error.message}`);
    process.exitCode = 1;
  });
}
