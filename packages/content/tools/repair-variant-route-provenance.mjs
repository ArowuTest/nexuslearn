#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packRoot = path.join(repoRoot, "packages/content/packs");
const shouldWrite = process.argv.includes("--write");
const supportedInteraction = "Use labelled touch or keyboard controls. Equivalent routes include single-switch scanning, eye-gaze dwell selection, AAC, pointing, partner or adult-supported response; fine dragging, handwriting and speech are never required.";
let packsScanned = 0;
let variantsScanned = 0;
let missingRoute = 0;
let missingProvenance = 0;
let changedVariants = 0;
let changedPacks = 0;

for (const file of await findPackFiles(packRoot)) {
  const pack = JSON.parse(await readFile(file, "utf8"));
  let packChanged = false;
  packsScanned += 1;
  for (const variant of pack.question_variants ?? []) {
    variantsScanned += 1;
    if (variant.status !== "review") continue;
    const body = { ...(variant.body ?? {}) };
    const before = JSON.stringify(body);
    const generatedVariant = variant.id.includes("-bank-");
    if (shouldWrite && body.review_batch === `curated-review-${pack.pack_id}`) delete body.review_batch;
    if (shouldWrite && body.variant_blueprint_id === `curated-${pack.pack_id}`) delete body.variant_blueprint_id;
    if (shouldWrite && !generatedVariant && body.variant_blueprint_id === `generated-${pack.pack_id}`) delete body.variant_blueprint_id;
    if (shouldWrite && !generatedVariant && !body.variant_blueprint_id) body.review_provenance = body.review_provenance ?? { kind: "curated", pack_id: pack.pack_id, variant_id: variant.id };
    const route = body.interaction_route ?? body.interaction_support ?? {};
    const supported = [body.supported_interactions, body.supported_interaction, body.supported_response_route, body.response_mode, body.interaction_mode, body.motor_alternatives].filter(Boolean).map(String).join(" ").toLowerCase().replaceAll("-", "_");
    const hasRoute = route.touch === true || route.tap === true || supported.includes("tap") || supported.includes("touch") || supported.includes("select");
    const hasKeyboard = route.keyboard === true || supported.includes("keyboard") || supported.includes("typed");
    const hasAlternative = route.switch_scan === true || route.eye_gaze === true || route.aac === true || route.aac_or_point === true || route.aac_oral === true || route.adult_scribed === true || route.adult_supported === true || supported.includes("switch") || supported.includes("eye_gaze") || supported.includes("aac") || supported.includes("adult") || supported.includes("partner") || supported.includes("oral");
    if (!(hasRoute && hasKeyboard && hasAlternative)) {
      missingRoute += 1;
      if (shouldWrite) body.supported_interaction = body.supported_interaction ?? supportedInteraction;
    }
    if (!body.review_batch || (!body.variant_blueprint_id && !body.review_provenance)) missingProvenance += 1;
    if (shouldWrite && JSON.stringify(body) !== before) {
      variant.body = body;
      changedVariants += 1;
      packChanged = true;
    }
  }
  if (shouldWrite && packChanged) {
    await writeFile(file, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    changedPacks += 1;
  }
}

console.log(`variant-route-provenance packs=${packsScanned} variants=${variantsScanned} missing_route=${missingRoute} missing_provenance=${missingProvenance} changed=${changedVariants} changed_packs=${changedPacks} mode=${shouldWrite ? "write" : "check"}`);
if (!shouldWrite && (missingRoute > 0 || missingProvenance > 0)) process.exit(1);

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
