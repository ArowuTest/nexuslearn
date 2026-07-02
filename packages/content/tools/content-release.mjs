#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const [command, directory, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") return printHelp();
  if (!["validate", "publish"].includes(command) || !directory) throw new Error("Use validate or publish with a release bundle directory");
  const options = parseArgs(rest);
  const bundle = await readBundle(path.resolve(directory));
  console.log(`release valid id=${bundle.manifest.id} packs=${bundle.manifest.expected_pack_count} questions=${bundle.manifest.expected_question_count}`);
  if (command === "validate") return;
  const api = options.api ?? process.env.NEXUSLEARN_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const auth = adminAuth(options);
  if (!api || !auth) throw new Error("publish requires --api and --token or --admin-key");
  await request(api, "/v1/admin/content/releases", "POST", auth, bundle.manifest);
  console.log(`release staged ${bundle.manifest.id}`);
  for (const chunk of bundle.chunks) {
    await request(api, `/v1/admin/content/releases/${encodeURIComponent(bundle.manifest.id)}/packs/${encodeURIComponent(chunk.pack_id)}`, "PUT", auth, chunk);
    console.log(`release uploaded ${chunk.pack_id}`);
  }
  if (options.activate) {
    await request(api, `/v1/admin/content/releases/${encodeURIComponent(bundle.manifest.id)}/activate`, "POST", auth);
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

async function request(api, route, method, auth, body) {
  const url = `${api.replace(/\/$/, "")}${route}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...auth },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.ok) return response.json();
    const detail = await response.text();
    if (attempt === 3 || (response.status < 500 && response.status !== 429)) throw new Error(`${method} ${route} failed ${response.status}: ${detail}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
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
  node packages/content/tools/content-release.mjs publish <bundle-directory> --api <url> --token <session> [--activate]

Publishing is staged and idempotent. Activation is a separate, explicit operation.`);
}
