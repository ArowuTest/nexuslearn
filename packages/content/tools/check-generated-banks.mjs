#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const generators = (await readdir(toolDir))
  .filter((name) => /^generate-.*-bank\.mjs$/.test(name))
  .sort();

if (generators.length === 0) {
  throw new Error("No deterministic content-bank generators were found.");
}

for (const generator of generators) {
  const result = spawnSync(process.execPath, [path.join(toolDir, generator), "--check"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`generated-bank checks passed generators=${generators.length}`);
