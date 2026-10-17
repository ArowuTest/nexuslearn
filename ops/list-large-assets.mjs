#!/usr/bin/env node
// Lists tracked files larger than 1 MB. Optional copy of narration audio
// for an object-storage upload. This script never deletes or rewrites git history.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const copyFlag = process.argv.indexOf("--copy-audio");
const copyTo = copyFlag >= 0 ? process.argv[copyFlag + 1] : "";
if (copyFlag >= 0 && !copyTo) {
  console.error("Usage: node ops/list-large-assets.mjs [--copy-audio <destination>]");
  process.exit(1);
}

const tracked = execFileSync("git", ["-c", "safe.directory=*", "ls-files", "-z"], { cwd: repo }).toString("utf8").split("\0").filter(Boolean);
const rows = [];
for (const relative of tracked) {
  const absolute = path.join(repo, relative);
  let size = 0;
  try {
    size = statSync(absolute).size;
  } catch {
    continue;
  }
  if (size >= 1_000_000) rows.push({ relative, size });
}
rows.sort((a, b) => b.size - a.size);
let total = 0;
for (const row of rows) {
  total += row.size;
  console.log(`${String(row.size).padStart(10)}  ${row.relative}`);
}
console.log(`${rows.length} tracked files over 1 MB, ${total} bytes`);

if (!copyTo) process.exit(0);
const destination = path.resolve(copyTo);
let copied = 0;
for (const relative of tracked) {
  if (!relative.endsWith(".mp3")) continue;
  if (!relative.startsWith("apps/web/public/audio/") && !relative.startsWith("packages/content/audio/")) continue;
  const target = path.join(destination, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(path.join(repo, relative), target);
  copied += 1;
}
console.log(`copied ${copied} mp3 files to ${destination}`);
