#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildVariantAudioCatalog } from "./lib/variant-audio-catalog.mjs";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packDir = path.join(repoRoot, "packages/content/packs");
const defaultOutput = path.join(repoRoot, "packages/content/audio/variant-audio-catalog.json");
const allowedOptions = new Set(["--summary", "--write", "--output"]);
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (!allowedOptions.has(argument)) throw new Error(`unknown option: ${argument}`);
  if (argument === "--output") {
    const candidate = args[index + 1];
    if (!candidate || candidate.startsWith("--")) throw new Error("--output requires a path");
    index += 1;
  }
}

const outputArgumentIndex = args.indexOf("--output");
const outputPath = outputArgumentIndex >= 0
  ? path.resolve(repoRoot, args[outputArgumentIndex + 1])
  : defaultOutput;
const shouldWrite = args.includes("--write");
const shouldSummarise = args.includes("--summary") || !shouldWrite;

const productionProfile = {
  provider: "ElevenLabs",
  voice_id: "Xb7hH8MSUJpSbSDYk0k2",
  model_id: "eleven_multilingual_v2",
  output_format: "mp3_44100_128",
  voice_settings: {
    stability: 0.55,
    similarity_boost: 0.75,
    style: 0.15,
    use_speaker_boost: true,
  },
  speed_by_year: {
    1: 0.92,
    2: 0.94,
    3: 0.94,
    4: 0.94,
    5: 0.94,
    6: 0.94,
    7: 0.94,
  },
};

const packFiles = (await fs.readdir(packDir))
  .filter((file) => file.endsWith(".json"))
  .sort();
const packs = await Promise.all(
  packFiles.map(async (file) => JSON.parse(await fs.readFile(path.join(packDir, file), "utf8"))),
);
const catalog = buildVariantAudioCatalog(packs, productionProfile);

if (shouldWrite) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

if (shouldSummarise) {
  const totals = catalog.totals;
  console.log(
    `variant-audio-catalog id=${catalog.catalogue_id} packs=${packs.length} `
    + `occurrences=${totals.reference_occurrences} references=${totals.reference_ids} `
    + `production_assets=${totals.production_assets} deduplicated=${totals.deduplicated_recordings} `
    + `specialist_required=${totals.specialist_required} unresolved=${totals.unresolved}`,
  );
}

if (catalog.totals.unresolved > 0) {
  throw new Error(`${catalog.totals.unresolved} variant audio references have no recoverable spoken text`);
}
