#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packsDir = path.join(repoRoot, "packages/content/packs");
const registryPath = path.join(repoRoot, "packages/content/roadmaps/interaction-renderer-registry.json");
const overlayPath = path.join(repoRoot, "packages/content/generated/coverage/runtime-spine-overlays.json");
const outArg = argValue("--out");
const outDir = outArg ? path.resolve(process.cwd(), outArg) : path.join(repoRoot, "packages/content/generated/coverage");
const runtimeStatuses = new Set(["approved", "published", "live"]);
const readyModes = new Set(["choice_ready", "choice_or_numeric_ready", "numeric_ready", "trace_ready", "model_sort_ready", "word_build_ready", "sequence_ready"]);
const runtimeSpineOverlays = fs.existsSync(overlayPath) ? readJSON(overlayPath).overlays ?? {} : {};

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function packFiles() {
  return fs.readdirSync(packsDir).filter((file) => file.endsWith(".json")).sort();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isScalar(value) {
  return typeof value === "string" || typeof value === "number";
}

function numberLike(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function runtimeContract(question, mode) {
  const body = question.body ?? {};
  const expected = question.expected_answer ?? {};
  const choices = asArray(body.choices).filter(isScalar);
  const hasPrompt = typeof body.prompt === "string" && body.prompt.trim() !== "";
  const hasChoiceAnswer = hasPrompt && choices.length >= 2 && isScalar(expected.value);
  const hasNumericAnswer = numberLike(body.a) && numberLike(body.b) && numberLike(expected.value);
  const hasExplicitNumericInput = hasPrompt && numberLike(expected.value) && (body.input === "number" || body.response === "number");
  const hasTraceAnswer = hasPrompt && typeof body.letter === "string" && body.letter.trim() !== "" && (isScalar(expected.value) || asArray(expected.rubric).length > 0);
  const expectedLetters = Array.isArray(expected.value) ? expected.value.map(String) : String(expected.value ?? "").split("");
  const tiles = asArray(body.tiles).map(String);
  const hasWordBuildAnswer = hasPrompt && expectedLetters.length > 0 && expectedLetters.every((letter) => tiles.includes(letter));
  const sequence = Array.isArray(expected.sequence) ? expected.sequence.map(String) : Array.isArray(expected.value) ? expected.value.map(String) : [];
  const cards = asArray(body.cards).map(String);
  const sequenceChoices = asArray(body.choices)
    .filter((choice) => Array.isArray(choice) && choice.every(isScalar))
    .map((choice) => choice.map(String));
  const hasOrderedCards = sequence.length >= 2 && cards.length >= 2 && sequence.every((card) => cards.includes(card));
  const hasSequenceChoice = sequence.length >= 2 && sequenceChoices.some((choice) => JSON.stringify(choice) === JSON.stringify(sequence));
  const hasSequenceAnswer = hasPrompt && (hasOrderedCards || hasSequenceChoice);

  switch (mode) {
    case "choice_ready":
      return hasChoiceAnswer;
    case "model_sort_ready":
      return hasChoiceAnswer;
    case "numeric_ready":
      return hasChoiceAnswer || hasNumericAnswer || hasExplicitNumericInput;
    case "trace_ready":
      return hasTraceAnswer;
    case "choice_or_numeric_ready":
      return hasChoiceAnswer || hasNumericAnswer || hasExplicitNumericInput;
    case "word_build_ready":
      return hasWordBuildAnswer;
    case "sequence_ready":
      return hasSequenceAnswer;
    default:
      return false;
  }
}

function collect() {
  const registry = readJSON(registryPath);
  const rows = [];
  const missingRegistry = [];
  const runtimeFailures = [];
  const formatUsage = new Map();

  for (const file of packFiles()) {
    const pack = readJSON(path.join(packsDir, file));
    const packFormats = new Set([
      ...asArray(pack.practice?.formats),
      ...asArray(pack.manipulatives).map((item) => item?.type).filter(Boolean),
      ...asArray(pack.question_variants).map((question) => question?.format).filter(Boolean),
      ...asArray(runtimeSpineOverlays[pack.pack_id]).map((question) => question?.format).filter(Boolean),
    ]);
    for (const format of packFormats) {
      if (!registry.formats[format]) {
        missingRegistry.push({ pack_id: pack.pack_id, format });
      }
      const current = formatUsage.get(format) ?? { format, packs: new Set(), questions: 0, runtime_questions: 0, runtime_failures: 0 };
      current.packs.add(pack.pack_id);
      formatUsage.set(format, current);
    }

    for (const question of [...asArray(pack.question_variants), ...asArray(runtimeSpineOverlays[pack.pack_id])]) {
      const format = question.format;
      const entry = registry.formats[format];
      const status = String(question.status ?? "draft");
      const isRuntime = runtimeStatuses.has(status);
      if (!entry) {
        missingRegistry.push({ pack_id: pack.pack_id, question_id: question.id, format });
        continue;
      }
      const usage = formatUsage.get(format) ?? { format, packs: new Set(), questions: 0, runtime_questions: 0, runtime_failures: 0 };
      usage.questions += 1;
      if (isRuntime) usage.runtime_questions += 1;
      const mode = entry.current_runtime;
      const readyMode = readyModes.has(mode);
      const contractReady = readyMode && runtimeContract(question, mode);
      const runtimeSafe = !isRuntime || contractReady;
      if (!runtimeSafe) {
        usage.runtime_failures += 1;
        runtimeFailures.push({
          pack_id: pack.pack_id,
          question_id: question.id,
          format,
          status,
          current_runtime: mode,
          reason: readyMode ? "runtime contract is incomplete for this question body/answer" : "format is preview-only or planned but question is runtime-approved",
        });
      }
      formatUsage.set(format, usage);
      rows.push({
        pack_id: pack.pack_id,
        question_id: question.id,
        format,
        status,
        current_runtime: mode,
        runtime_question: isRuntime,
        runtime_safe: runtimeSafe,
      });
    }
  }

  const formats = Array.from(formatUsage.values())
    .map((item) => ({
      format: item.format,
      packs: Array.from(item.packs).sort(),
      pack_count: item.packs.size,
      questions: item.questions,
      runtime_questions: item.runtime_questions,
      runtime_failures: item.runtime_failures,
      current_runtime: registry.formats[item.format]?.current_runtime ?? "missing",
      target_runtime: registry.formats[item.format]?.target_runtime ?? "",
    }))
    .sort((a, b) => a.format.localeCompare(b.format));

  return {
    version: registry.version,
    status: "phase-3-renderer-readiness",
    generated_by: "packages/content/tools/renderer-readiness.mjs",
    totals: {
      formats: formats.length,
      packs: packFiles().length,
      questions: rows.length,
      runtime_questions: rows.filter((row) => row.runtime_question).length,
      missing_registry: missingRegistry.length,
      runtime_failures: runtimeFailures.length,
      ready_formats: formats.filter((format) => readyModes.has(format.current_runtime)).length,
      preview_only_formats: formats.filter((format) => format.current_runtime === "preview_only").length,
    },
    missing_registry: missingRegistry,
    runtime_failures: runtimeFailures,
    formats,
  };
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function writeReports(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "interaction-renderer-readiness.json");
  const htmlPath = path.join(outDir, "interaction-renderer-readiness.html");
  const publicDir = path.join(repoRoot, "apps/web/public/content");
  const publicJsonPath = path.join(publicDir, "interaction-renderer-readiness.json");
  const publicHtmlPath = path.join(publicDir, "interaction-renderer-readiness.html");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const rows = report.formats.map((format) => `
    <tr>
      <td><code>${htmlEscape(format.format)}</code></td>
      <td>${htmlEscape(format.current_runtime)}</td>
      <td>${format.pack_count}</td>
      <td>${format.runtime_questions}</td>
      <td class="${format.runtime_failures ? "bad" : "ok"}">${format.runtime_failures}</td>
      <td>${htmlEscape(format.target_runtime)}</td>
    </tr>`).join("");
  fs.writeFileSync(htmlPath, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NexusLearn Renderer Readiness</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 32px; color: #17233f; background: #f7fbff; }
    h1 { margin-bottom: 4px; }
    .summary { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }
    .summary div { background: #fff; border: 1px solid #dbe7f2; border-radius: 12px; padding: 12px 16px; box-shadow: 0 10px 24px rgba(23,35,63,0.08); }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 14px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e7eef7; vertical-align: top; }
    th { background: #17233f; color: #fff; }
    .ok { color: #117a55; font-weight: 700; }
    .bad { color: #b42318; font-weight: 700; }
  </style>
</head>
<body>
  <h1>NexusLearn Renderer Readiness</h1>
  <p>Checks authored content formats against the child-runtime renderer registry.</p>
  <section class="summary">
    <div><strong>${report.totals.formats}</strong><br />formats</div>
    <div><strong>${report.totals.runtime_questions}</strong><br />runtime questions</div>
    <div><strong>${report.totals.runtime_failures}</strong><br />runtime failures</div>
    <div><strong>${report.totals.preview_only_formats}</strong><br />preview-only formats</div>
  </section>
  <table>
    <thead><tr><th>Format</th><th>Current runtime</th><th>Packs</th><th>Runtime questions</th><th>Failures</th><th>Target runtime</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`);
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(jsonPath, publicJsonPath);
  fs.copyFileSync(htmlPath, publicHtmlPath);
  return { jsonPath, htmlPath, publicJsonPath, publicHtmlPath };
}

const report = collect();
const paths = writeReports(report);
console.log(`renderer-readiness formats=${report.totals.formats} runtime_questions=${report.totals.runtime_questions} failures=${report.totals.runtime_failures}`);
console.log(`renderer-readiness written ${path.relative(process.cwd(), paths.jsonPath)}`);
console.log(`renderer-readiness written ${path.relative(process.cwd(), paths.htmlPath)}`);
console.log(`renderer-readiness web asset ${path.relative(process.cwd(), paths.publicJsonPath)}`);
if (report.totals.missing_registry || report.totals.runtime_failures) {
  for (const failure of report.runtime_failures.slice(0, 20)) {
    console.error(`runtime failure ${failure.pack_id} ${failure.question_id} ${failure.format}: ${failure.reason}`);
  }
  if (report.runtime_failures.length > 20) console.error(`... ${report.runtime_failures.length - 20} more runtime failures`);
  process.exit(1);
}
