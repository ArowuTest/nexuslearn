#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { validateReleaseMetadata } from "./lib/content-release-evidence.mjs";
import { createAdminJSONTransport } from "./lib/admin-json-transport.mjs";

const retryStatuses = new Set([429, 500, 502, 503, 504]);

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const [command, directory, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") return printHelp();
  if (!["validate", "preflight", "publish"].includes(command) || !directory) throw new Error("Use validate, preflight or publish with a release bundle directory");
  const options = parseArgs(rest);
  if (options.activate && command !== "publish") throw new Error("--activate is only available for publish");
  const bundle = await readBundle(path.resolve(directory));
  console.log(`release valid id=${bundle.manifest.id} packs=${bundle.manifest.expected_pack_count} questions=${bundle.manifest.expected_question_count}`);
  if (command === "validate") return;
  const api = options.api ?? process.env.NEXUSLEARN_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const auth = adminAuth(options);
  if (!api || !auth) throw new Error(`${command} requires --api and --token or --admin-key`);
  const transport = createAdminJSONTransport({ baseURL: api });
  if (command === "preflight") {
    if (bundle.manifest.channel !== "live") throw new Error("preflight requires a live bundle");
    const report = await request(transport, "/v1/admin/content/releases/preflight", "POST", auth, bundle.manifest);
    if (report?.release_id !== bundle.manifest.id || report?.manifest_sha256 !== bundle.manifest.manifest_sha256) {
      throw new Error("preflight response does not match the requested release");
    }
    if (!Array.isArray(report.checks) || report.checks.length === 0) throw new Error("preflight response is missing evidence checks");
    const requiredChecks = ["ai_review", "safeguarding", "audio_release", "audio_listening", "child_pilot"];
    if (report.checks.some(check => !check || !requiredChecks.includes(check.code) || typeof check.passed !== "boolean")) {
      throw new Error("preflight response contains invalid evidence checks");
    }
    // Only emit allowlisted codes and local labels, never server-supplied messages.
    for (const check of report.checks) console.log(`${check.passed ? "PASS" : "BLOCKED"} ${check.code}`);
    if (report.checks.length !== requiredChecks.length || requiredChecks.some(code => report.checks.filter(check => check.code === code).length !== 1)) {
      throw new Error("preflight response does not contain every required evidence check exactly once");
    }
    if (report.evidence_ready !== true || report.checks.some(check => check.passed !== true)) throw new Error("release evidence is blocked");
    console.log("Release evidence is current. Activation will recheck evidence and uploaded content.");
    return;
  }
  const staged = await request(transport, "/v1/admin/content/releases", "POST", auth, bundle.manifest);
  verifyReleaseResponse(staged, bundle.manifest);
  console.log(`release staged ${bundle.manifest.id}`);
  for (const chunk of bundle.chunks) {
    const uploaded = await request(transport, `/v1/admin/content/releases/${encodeURIComponent(bundle.manifest.id)}/packs/${encodeURIComponent(chunk.pack_id)}`, "PUT", auth, chunk);
    verifyReleaseResponse(uploaded, bundle.manifest, { packID: chunk.pack_id });
    console.log(`release uploaded ${chunk.pack_id}`);
  }
  if (options.activate) {
    const activated = await request(transport, `/v1/admin/content/releases/${encodeURIComponent(bundle.manifest.id)}/activate`, "POST", auth);
    verifyReleaseResponse(activated, bundle.manifest, { activated: true });
    console.log(`release activated ${bundle.manifest.id}`);
  } else {
    console.log("release upload complete; activation intentionally not requested");
  }
}

async function readBundle(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  if (manifest.schema_version !== "1.0" || !Array.isArray(manifest.packs) || manifest.packs.length === 0) throw new Error("invalid release manifest");
  if (manifest.packs.length !== manifest.expected_pack_count) throw new Error("manifest pack count mismatch");
  const manifestDigest = sha256(stableStringify(manifest.packs));
  if (manifestDigest !== manifest.manifest_sha256) throw new Error("manifest digest mismatch");
  validateReleaseMetadata({ channel: manifest.channel, packs: manifest.packs, metadata: manifest.metadata ?? {} });
  const chunks = [];
  const totals = { objective_count: 0, activity_count: 0, question_count: 0, reward_rule_count: 0 };
  for (const descriptor of manifest.packs) {
    const chunk = JSON.parse(await readFile(path.join(directory, "packs", `${descriptor.pack_id}.json`), "utf8"));
    if (chunk.pack_id !== descriptor.pack_id || chunk.pack_version !== descriptor.pack_version) throw new Error(`chunk identity mismatch ${descriptor.pack_id}`);
    if (sha256(stableStringify(chunk.payload)) !== descriptor.payload_sha256 || chunk.payload_sha256 !== descriptor.payload_sha256) throw new Error(`chunk digest mismatch ${descriptor.pack_id}`);
    for (const key of Object.keys(totals)) {
      if (chunk[key] !== descriptor[key]) throw new Error(`chunk count mismatch ${descriptor.pack_id} ${key}`);
      totals[key] += chunk[key];
    }
    chunks.push(chunk);
  }
  if (totals.objective_count !== manifest.expected_objective_count || totals.activity_count !== manifest.expected_activity_count || totals.question_count !== manifest.expected_question_count || totals.reward_rule_count !== manifest.expected_reward_rule_count) throw new Error("release aggregate count mismatch");
  return { manifest, chunks };
}

function verifyReleaseResponse(result, manifest, { packID, activated = false } = {}) {
  const release = result?.content_release;
  const fields = ["id", "schema_version", "channel", "manifest_sha256", "expected_pack_count", "expected_objective_count", "expected_activity_count", "expected_question_count", "expected_reward_rule_count"];
  if (!release || fields.some(field => release[field] !== manifest[field]) ||
      !Array.isArray(release.packs) || !["staged", "applied", "superseded"].includes(release.status) ||
      (packID !== undefined && result.pack_id !== packID) ||
      (activated && (result.activated !== true || release.status !== "applied"))) {
    throw new Error("release API returned an invalid acknowledgement");
  }
}

async function request(transport, route, method, auth, body) {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  // Backend replay contract: manifest digest, exact signed chunk, or already-applied release.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await transport(route, { method, headers: { "Content-Type": "application/json", ...auth }, body: serialized });
    } catch (error) {
      if (attempt === 3 || (!retryStatuses.has(error.status) && error.kind !== "network" && error.kind !== "timeout")) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

function adminAuth(options) {
  const token = options.token ?? process.env.NEXUSLEARN_ADMIN_TOKEN;
  if (token) return { Authorization: `Bearer ${token}` };
  const key = options.adminKey ?? process.env.ADMIN_API_KEY;
  return key ? { "X-Admin-Key": key } : null;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--api") options.api = args[++index];
    else if (args[index] === "--token") options.token = args[++index];
    else if (args[index] === "--admin-key") options.adminKey = args[++index];
    else if (args[index] === "--activate") options.activate = true;
    else throw new Error(`unknown option ${args[index]}`);
  }
  return options;
}

function stableStringify(value) { return JSON.stringify(sortValue(value)); }
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

function printHelp() {
  console.log(`Usage:
  node packages/content/tools/content-release.mjs validate <bundle-directory>
  node packages/content/tools/content-release.mjs preflight <bundle-directory> --api <url>
  node packages/content/tools/content-release.mjs publish <bundle-directory> --api <url> --token <session> [--activate]

Publishing is staged and idempotent. Activation is a separate, explicit operation.`);
}
