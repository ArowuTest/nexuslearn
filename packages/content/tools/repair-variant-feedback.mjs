#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packRoot = path.join(repoRoot, "packages/content/packs");
const shouldWrite = process.argv.includes("--write");
let packsScanned = 0;
let variantsScanned = 0;
let missingCorrect = 0;
let missingRetryOrRepair = 0;
let changedVariants = 0;
let changedPacks = 0;

for (const file of await findPackFiles(packRoot)) {
  const pack = JSON.parse(await readFile(file, "utf8"));
  let packChanged = false;
  packsScanned += 1;
  for (const variant of pack.question_variants ?? []) {
    variantsScanned += 1;
    if (variant.status !== "review") continue;
    const feedback = variant.feedback && typeof variant.feedback === "object" ? { ...variant.feedback } : {};
    const hints = Array.isArray(variant.hints) ? variant.hints.filter(Boolean).map(String) : [];
    const explanation = String(variant.explanation ?? "").trim();
    const misconception = readable(String(variant.misconception_tag ?? "the target idea"));
    const hintOne = hints[0] ?? "Look carefully at the model and the evidence in the task.";
    const hintTwo = hints[1] ?? "Explain why your choice fits the learning goal.";
    if (!feedback.correct) {
      missingCorrect += 1;
      if (shouldWrite) feedback.correct = `Correct. ${explanation || hintTwo}`;
    }
    if (!feedback.retry && !feedback.repair) {
      missingRetryOrRepair += 1;
      if (shouldWrite) feedback.retry = `Try again calmly: ${hintOne} ${hintTwo} No progress is lost for checking or changing your answer.`;
    }
    if (!feedback.repair) {
      if (shouldWrite) feedback.repair = `Repair the ${misconception} route: ${hintOne} Then use the evidence to explain your choice.`;
    }
    if (!feedback.misconception_check && shouldWrite) feedback.misconception_check = `Check the ${misconception} idea against the task evidence.`;
    if (!feedback.support_message && shouldWrite) feedback.support_message = "Touch, keyboard, switch, eye-gaze, AAC, pointing and adult-supported routes are valid; speed, speech and fine-motor precision are not scored.";
    if (shouldWrite && JSON.stringify(feedback) !== JSON.stringify(variant.feedback ?? {})) {
      variant.feedback = feedback;
      changedVariants += 1;
      packChanged = true;
    }
  }
  if (shouldWrite && packChanged) {
    await writeFile(file, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    changedPacks += 1;
  }
}

console.log(`variant-feedback packs=${packsScanned} variants=${variantsScanned} missing_correct=${missingCorrect} missing_retry_or_repair=${missingRetryOrRepair} changed=${changedVariants} changed_packs=${changedPacks} mode=${shouldWrite ? "write" : "check"}`);
if (!shouldWrite && (missingCorrect > 0 || missingRetryOrRepair > 0)) process.exit(1);

function readable(value) { return value.replaceAll("_", " "); }

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
