import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const runtime = new Set(["live", "published", "approved"]);
const releasedNarration = new Set(["human_listening_approved", "approved", "production_approved", "released"]);

export async function childSafetyReport() {
  const manifest = JSON.parse(await readFile(path.join(root, "apps/web/public/content/narration-manifest.json"), "utf8"));
  const clips = manifest.items ?? [];
  const servableNarration = clips.filter((item) => item.technical_pass === true && releasedNarration.has(item.production_status));
  const packs = [];
  let variants = 0;
  let servableVariants = 0;
  const packDir = path.join(root, "packages/content/packs");
  for (const name of (await readdir(packDir)).filter((file) => file.endsWith(".json")).sort()) {
    const pack = JSON.parse(await readFile(path.join(packDir, name), "utf8"));
    let packServable = 0;
    for (const question of pack.question_variants ?? []) {
      variants += 1;
      if (runtime.has(String(question.status ?? "").toLowerCase())) {
        servableVariants += 1;
        packServable += 1;
      }
    }
    packs.push({
      pack_id: pack.pack_id,
      pack_status: pack.status,
      variant_count: (pack.question_variants ?? []).length,
      runtime_variant_count: packServable,
    });
  }
  const clipsByPack = new Map();
  for (const clip of clips) {
    const bucket = clipsByPack.get(clip.pack_id) ?? [];
    bucket.push({ id: clip.id, file: clip.file, kind: clip.kind, status: clip.production_status });
    clipsByPack.set(clip.pack_id, bucket);
  }
  return {
    generated_on: "2026-10-17",
    narration: {
      total: clips.length,
      servable: servableNarration.length,
      blocked: clips.length - servableNarration.length,
      reason: "A clip can be played to a child only after technical_pass and a human listening status.",
    },
    variants: {
      total: variants,
      servable_status: servableVariants,
      blocked: variants - servableVariants,
      packs: packs.length,
      packs_in_review: packs.filter((pack) => pack.pack_status === "review").length,
      note: "These variants live in review packs. They are not the live catalogue. A live release still needs the existing human safeguarding evidence.",
    },
    packs: packs.map((pack) => ({ ...pack, clips: clipsByPack.get(pack.pack_id) ?? [] })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await childSafetyReport();
  const destination = path.join(root, "apps/web/public/review/safety-summary.json");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report)}\n`);
  console.log(`narration servable=${report.narration.servable} blocked=${report.narration.blocked}; variants servable_status=${report.variants.servable_status} blocked=${report.variants.blocked}`);
}
