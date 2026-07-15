#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packRoot = path.join(repoRoot, "packages/content/packs");
const shouldWrite = process.argv.includes("--write");
let packsScanned = 0;
let variantsScanned = 0;
let missingPolicy = 0;
let changedVariants = 0;
let changedPacks = 0;

for (const file of await findPackFiles(packRoot)) {
  const pack = JSON.parse(await readFile(file, "utf8"));
  let packChanged = false;
  packsScanned += 1;
  for (const variant of pack.question_variants ?? []) {
    variantsScanned += 1;
    if (variant.status !== "review" || !audioIsExpected(variant.body ?? {})) continue;
    if (variant.body?.browser_tts_allowed === false) continue;
    missingPolicy += 1;
    if (shouldWrite) {
      variant.body = { ...(variant.body ?? {}), browser_tts_allowed: false };
      changedVariants += 1;
      packChanged = true;
    }
  }
  if (shouldWrite && packChanged) {
    await writeFile(file, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    changedPacks += 1;
  }
}

console.log(`variant-audio-policy packs=${packsScanned} variants=${variantsScanned} missing=${missingPolicy} changed=${changedVariants} changed_packs=${changedPacks} mode=${shouldWrite ? "write" : "check"}`);
if (!shouldWrite && missingPolicy > 0) process.exit(1);

function audioIsExpected(body) {
  return body.audio_asset_id !== undefined || body.audio_asset_ids !== undefined || body.audio_ref !== undefined || body.audio_route !== undefined || body.audio_provider !== undefined || body.audio_required === true || body.audio_asset_status === "required" || body.audio_asset_status === "required_before_pilot";
}

async function findPackFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findPackFiles(full));
    else if ((entry.name.endsWith(".pack.json") || entry.name.endsWith(".pack.sample.json")) && (await stat(full)).isFile()) files.push(full);
  }
  return files;
}
