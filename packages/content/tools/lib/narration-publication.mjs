import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { atomicWrite } from "./narration-production-cache.mjs";

const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const metadataFiles = new Set([
  "packages/content/audio/narration-manifest.json",
  "packages/content/audio/narration-manifest-v2.json",
  "packages/content/audio/narration-asset-history.json",
  "apps/web/public/content/narration-manifest.json",
  "packages/content/generated/audio/narration-review.html",
  "apps/web/private/content/narration-review.html",
]);
const journalDirectory = root => path.join(root, ".agent/narration-production/publication");

function targetFile(root, relative) {
  if (typeof relative !== "string" || relative.includes("\\") || relative.split("/").some(part => !part || part === "." || part === "..")
    || (!metadataFiles.has(relative) && !/^apps\/web\/public\/audio\/narration\/alice\/[a-zA-Z0-9_/-]+\.mp3$/.test(relative))) {
    throw new Error("Narration publication contains an out-of-scope path");
  }
  return path.join(root, relative);
}

async function clearJournal(directory) {
  const files = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of files) {
    if (!entry.isFile() || !/^(state\.json|\d+\.bin)(\.[a-f0-9-]+\.tmp)?$/.test(entry.name)) {
      throw new Error("Unexpected narration publication evidence; inspect before cleanup");
    }
  }
  for (const entry of files) await fs.unlink(path.join(directory, entry.name));
  await fs.rmdir(directory);
}

export async function recoverNarrationPublication(root, { readOnly = false } = {}) {
  const directory = journalDirectory(root);
  try { await fs.access(directory); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  if (readOnly) throw new Error("Narration publication requires recovery before a dry-run can inspect the inventory");
  let state;
  try { state = JSON.parse(await fs.readFile(path.join(directory, "state.json"), "utf8")); }
  catch {
    // Absence is not evidence that publication never began: state may have
    // been lost independently of the audio/manifests. Retain every backup.
    throw new Error("Missing or invalid narration publication journal; preserve backups and inspect recovery evidence");
  }
  if (state.version !== 1 || !["prepared", "committed"].includes(state.phase)
    || !Array.isArray(state.files) || state.files.length > 2000) throw new Error("Invalid narration publication journal");
  const backups = [];
  const seen = new Set();
  for (const [index, file] of state.files.entries()) {
    const absolute = targetFile(root, file.relative);
    if (typeof file.existed !== "boolean" || seen.has(absolute)) throw new Error("Invalid narration publication record");
    seen.add(absolute);
    let data;
    if (file.existed && state.phase === "prepared") {
      data = await fs.readFile(path.join(directory, `${index}.bin`));
      if (hash(data) !== file.sha256) throw new Error("Narration publication backup hash mismatch; recovery stopped");
    }
    backups.push({ absolute, existed: file.existed, data });
  }
  // Validate every backup before restoring any destination. A committed marker
  // means all replacements succeeded, so recovery only clears its journal.
  if (state.phase === "prepared") {
    for (const backup of backups.reverse()) {
      if (backup.existed) await atomicWrite(backup.absolute, backup.data);
      else await fs.unlink(backup.absolute).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
  }
  await clearJournal(directory);
}

export async function publishNarrationBatch(root, updates) {
  if (updates.length > 2000) throw new Error("Narration publication exceeds the bounded batch size");
  await recoverNarrationPublication(root);
  const files = updates.map(update => {
    const relative = path.relative(root, update.file).replaceAll("\\", "/");
    return { relative, absolute: targetFile(root, relative), data: update.data };
  });
  if (new Set(files.map(file => file.absolute)).size !== files.length) throw new Error("Duplicate narration publication destination");
  const directory = journalDirectory(root);
  await fs.mkdir(directory);
  const state = { version: 1, phase: "prepared", files: [] };
  try {
    for (const [index, file] of files.entries()) {
      let previous;
      try { previous = await fs.readFile(file.absolute); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      const existed = previous !== undefined;
      if (existed) await atomicWrite(path.join(directory, `${index}.bin`), previous);
      state.files.push({ relative: file.relative, existed, ...(existed ? { sha256: hash(previous) } : {}) });
    }
    await atomicWrite(path.join(directory, "state.json"), JSON.stringify(state));
    for (const file of files) await atomicWrite(file.absolute, file.data);
    await atomicWrite(path.join(directory, "state.json"), JSON.stringify({ ...state, phase: "committed" }));
  } catch (error) {
    await recoverNarrationPublication(root);
    throw new Error(`Narration publication rolled back: ${error.message}. Verified paid responses remain staged.`);
  }
  await recoverNarrationPublication(root);
}
