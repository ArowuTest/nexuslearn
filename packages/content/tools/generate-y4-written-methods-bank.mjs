#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/ma-y4-written-methods.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y4-written-methods-bank-";
const reviewBatch = "y4-written-methods-pilot-a";
const allocation = {
  "align-by-place-value": 48,
  "addition-recorded-exchanges": 48,
  "subtraction-renaming-paths": 48,
  "diagnose-and-repair-written-methods": 48,
  "estimate-choose-check": 48,
};
const curatedBlueprint = new Map([
  ["ma-y4-written-methods-q-align", "align-by-place-value"],
  ["ma-y4-written-methods-q-add-exchanges", "addition-recorded-exchanges"],
  ["ma-y4-written-methods-q-subtract-zero", "subtraction-renaming-paths"],
  ["ma-y4-written-methods-q-first-error", "diagnose-and-repair-written-methods"],
]);
const places = ["ones", "tens", "hundreds", "thousands"];
const reviewDays = [1, 3, 7, 14, 30];

const alignPairs = [[3406, 782], [5072, 94], [681, 4205], [9008, 736], [2630, 405], [7091, 82], [1056, 907], [432, 3204], [8003, 68], [2745, 609], [390, 6107], [5402, 783]];
const additions = [[2786, 1457], [3402, 2165], [4728, 1536], [609, 4387], [3564, 2425], [1857, 2068], [4706, 1289], [2639, 3458], [7015, 984], [4267, 3516], [5088, 1707], [2395, 4608]];
const subtractions = [[4032, 1758], [6845, 2314], [5006, 2789], [7310, 945], [4624, 1803], [8000, 3657], [6205, 2876], [9541, 4328], [7004, 286], [5412, 2795], [4300, 1658], [9001, 4736]];
const multiplications = [[243, 3], [126, 4], [308, 3], [214, 4], [321, 3], [142, 5]];
const divisions = [[864, 4], [936, 3], [728, 7], [816, 8], [924, 7], [639, 3]];
const contexts = ["museum tickets", "tree-planting cards", "library labels", "wildlife survey points", "workshop parts", "festival programmes"];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y4-written-methods") throw new Error("This generator only supports ma-y4-written-methods.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated.map(removeWrittenContract));
if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
for (const variant of curated) if (!curatedBlueprint.has(variant.id)) throw new Error(`Unmapped curated variant ${variant.id}.`);
const curatedCounts = countBy(curated, (variant) => curatedBlueprint.get(variant.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));

const generated = [
  ...alignmentCandidates(targets["align-by-place-value"]),
  ...additionCandidates(targets["addition-recorded-exchanges"]),
  ...subtractionCandidates(targets["subtraction-renaming-paths"]),
  ...diagnosisCandidates(targets["diagnose-and-repair-written-methods"]),
  ...methodCandidates(targets["estimate-choose-check"]),
];
const enrichedCurated = curated.map(enrichVariant);
const enrichedGenerated = generated.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedGenerated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Deterministic Year 4 written-methods pilot bank with 240 variants: four curated variants remain unchanged and 236 review candidates deepen place-value alignment, meaningful addition exchanges, subtraction renaming, inverse checks, estimates, missing digits, first-error diagnosis, method choice and multistep transfer. Curriculum-aligned short multiplication and division appear only as representation and method-choice links using partial products or equal grouping. Every generated task provides concrete, visual, reduced-load and alternative-input SEND/dyscalculia routes, rich corrective feedback and pressure-free workshop missions. Selected narration uses ElevenLabs references requiring human listening review; browser TTS is prohibited. Independent mathematics, teacher, accessibility, safeguarding and renderer review remains required before promotion.";
validateBank(pack, enrichedCurated, curatedSnapshot, enrichedGenerated);

console.log(`y4-written-methods-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y4-written-methods-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y4-written-methods-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y4-written-methods-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
console.log(`y4-written-methods-bank audio=${summary(generated, (v) => v.body.audio_required ? "reviewed_reference" : "not_needed")}`);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-written-methods-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 written-methods bank is out of date; run generate-y4-written-methods-bank.mjs --write.");
  console.log("y4-written-methods-bank deterministic check passed");
} else console.log("y4-written-methods-bank dry-run; pass --write to update the pack");

function alignmentCandidates(count) {
  const modes = ["align_place_values", "zero_placeholder", "digit_value", "compare_layouts", "operation_layout", "repair_edge_alignment", "alignment_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const [a, b] = alignPairs[i % alignPairs.length], mode = modes[i % modes.length];
    const grid = [placeDigits(a), placeDigits(b)], operation = i % 2 ? "subtraction" : "addition";
    let prompt, answer, body, explanation, tag = "edge_alignment";
    if (mode === "zero_placeholder") {
      const number = [a, b].find((n) => String(n).includes("0")) ?? a;
      const zeroPlace = places[String(number).split("").reverse().findIndex((d) => d === "0")];
      prompt = `Workbench ${i + 1}: in ${format(number)}, what place does the zero hold?`;
      answer = zeroPlace; body = { number, choices: [zeroPlace, ...places.filter((p) => p !== zeroPlace).slice(0, 2)], place_value_chart: placeDigits(number) };
      explanation = `The zero is a placeholder in the ${zeroPlace} column; it keeps every other digit at its correct value.`;
    } else if (mode === "digit_value") {
      const digits = placeDigits(a), occupied = digits.map((digit, index) => digit.trim() ? index : -1).filter((index) => index >= 0), index = occupied[i % occupied.length], digit = digits[index], place = ["thousands", "hundreds", "tens", "ones"][index], value = Number(digit) * 10 ** (3 - index);
      prompt = `Value lens ${i + 1}: what value does the ${digit} represent in ${format(a)}?`;
      answer = value; body = { number: a, target_digit: digit, target_place: place, choices: unique([value, Number(digit), Number(digit) * 10, Number(digit) * 100]) };
      explanation = `The ${digit} is in the ${place} column, so its value is ${format(value)}.`;
    } else if (mode === "compare_layouts" || mode === "repair_edge_alignment") {
      prompt = `Layout inspector ${i + 1}: choose the layout that preserves every place value for ${format(a)} and ${format(b)}.`;
      answer = grid; body = { numbers: [a, b], correct_grid: grid, tempting_edge_aligned_grid: [placeDigits(a), [...String(b).padEnd(4, "")]], columns: ["thousands", "hundreds", "tens", "ones"] };
      explanation = `Align ones beneath ones, then tens, hundreds and thousands. The numeral edges may differ because ${format(b)} has fewer digits.`;
    } else {
      prompt = `Alignment bay ${i + 1}: place ${format(a)} and ${format(b)} for ${operation} before calculating.`;
      answer = grid; body = { numbers: [a, b], operation, columns: ["thousands", "hundreds", "tens", "ones"], expected_grid: grid };
      explanation = `The grid represents values, not printed edges: ${JSON.stringify(grid[0])} and ${JSON.stringify(grid[1])}.`;
    }
    return maths({ id: `align-${mode}-${a}-${b}-${i + 1}`, format: "place-value-layout", blueprint: "align-by-place-value", band: i < 10 ? "intro" : "developing", concept: mode, prompt, body, answer, explanation, tag, hook: "digits-align-by-place", audioScript: i % 11 === 0 ? `Place ${format(a)} and ${format(b)} into thousands, hundreds, tens and ones.` : undefined });
  });
}

function additionCandidates(count) {
  const modes = ["column_addition", "explain_exchange", "consecutive_exchanges", "partial_sums_link", "missing_addend_digit", "estimate_addition", "inverse_addition_check", "addition_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], minimumExchanges = mode === "consecutive_exchanges" ? 2 : mode === "explain_exchange" ? 1 : 0;
    const [a, b] = minimumExchanges ? additions.find((pair, offset) => offset >= i % additions.length && additionTrace(...pair).filter((s) => s.exchange_out).length >= minimumExchanges) ?? additions.find((pair) => additionTrace(...pair).filter((s) => s.exchange_out).length >= minimumExchanges) : additions[i % additions.length];
    const total = a + b, trace = additionTrace(a, b), exchangeSteps = trace.filter((s) => s.exchange_out);
    let prompt = `Addition bench ${i + 1}: calculate ${format(a)} + ${format(b)} and record each exchange.`, answer = total;
    let body = { operation: "addition", operands: [a, b], place_value_grid: [placeDigits(a), placeDigits(b)], exchange_trace: trace, estimate: round100(a) + round100(b), inverse_check: `${format(total)} - ${format(b)} = ${format(a)}` };
    let explanation = `${format(a)} + ${format(b)} = ${format(total)}. Each exchange renames 10 units as 1 unit in the next place without changing the total.`, tag = "exchange_not_recorded";
    if (mode === "explain_exchange" || mode === "consecutive_exchanges") {
      const step = exchangeSteps.length ? exchangeSteps[i % exchangeSteps.length] : trace[0]; answer = step.meaning;
      prompt = `Exchange explainer ${i + 1}: what does the recorded exchange in the ${step.place} step mean?`;
      body = { ...body, focus_step: step, choices: [step.meaning, `The extra ${step.exchange_out} is added twice.`, "The digits swap place values."] };
      explanation = `${step.meaning} The quantity is regrouped, not increased.`;
    } else if (mode === "partial_sums_link") {
      const partials = expandedAddends(a, b); answer = partials.reduce((x, y) => x + y, 0);
      prompt = `Representation bridge ${i + 1}: recombine the place-value partial sums for ${format(a)} + ${format(b)}.`;
      body = { ...body, partial_sums: partials, column_method_total: total };
      explanation = `${partials.map(format).join(" + ")} = ${format(total)}. The partial sums and column method record the same place-value addition.`;
    } else if (mode === "missing_addend_digit") {
      const masked = placeDigits(b), occupied = masked.map((digit, index) => digit.trim() ? index : -1).filter((index) => index >= 0), placeIndex = occupied[i % occupied.length], digit = masked[placeIndex]; masked[placeIndex] = "?"; answer = Number(digit);
      prompt = `Missing-digit panel ${i + 1}: ${format(a)} + ${masked.join("")} = ${format(total)}. Find the missing digit using the column evidence.`;
      body = { ...body, masked_addend_grid: masked, missing_place: ["thousands", "hundreds", "tens", "ones"][placeIndex] };
      explanation = `Working through the aligned columns and exchanges shows the missing ${["thousands", "hundreds", "tens", "ones"][placeIndex]} digit is ${digit}.`;
    } else if (mode === "estimate_addition") {
      answer = round100(a) + round100(b); prompt = `Estimate station ${i + 1}: round both addends to the nearest hundred before calculating exactly.`;
      body = { ...body, choices: unique([answer, total, answer + 100, Math.max(0, answer - 100)]) };
      explanation = `${format(a)} rounds to ${format(round100(a))} and ${format(b)} rounds to ${format(round100(b))}, giving an estimate of ${format(answer)}; the exact ${format(total)} is close.`;
    } else if (mode === "inverse_addition_check") {
      answer = `${total} - ${b} = ${a}`; prompt = `Inverse lock ${i + 1}: choose the subtraction that checks ${format(a)} + ${format(b)} = ${format(total)}.`;
      body = { ...body, choices: [answer, `${total} + ${b} = ${a}`, `${a} - ${b} = ${total}`] };
      explanation = `Subtracting one addend from the sum returns the other: ${answer}.`;
    } else if (mode === "addition_transfer") {
      prompt = `${contexts[i % contexts.length]} mission ${i + 1}: two batches contain ${format(a)} and ${format(b)} items. Find and check the combined total.`;
      body = { ...body, context: contexts[i % contexts.length], step_planner: ["estimate", "align", "calculate and exchange", "inverse-check"] };
    }
    return maths({ id: `add-${mode}-${a}-${b}-${i + 1}`, format: "column-calculate", blueprint: "addition-recorded-exchanges", band: i < 8 ? "developing" : "expected", concept: mode, prompt, body, answer, explanation, tag, hook: "exchange-and-record", audioScript: i % 13 === 0 ? prompt : undefined });
  });
}

function subtractionCandidates(count) {
  const modes = ["column_subtraction", "explain_rename", "rename_across_zero", "expanded_difference_link", "missing_subtrahend_digit", "estimate_subtraction", "inverse_subtraction_check", "subtraction_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], needsRename = mode === "explain_rename", needsAcrossZero = mode === "rename_across_zero";
    const selected = needsAcrossZero ? subtractions.find((pair) => subtractionTrace(...pair).some((s) => s.crosses_zero)) : needsRename ? subtractions.find((pair, offset) => offset >= i % subtractions.length && subtractionTrace(...pair).some((s) => s.renamed)) ?? subtractions.find((pair) => subtractionTrace(...pair).some((s) => s.renamed)) : subtractions[i % subtractions.length];
    const [a, b] = selected, difference = a - b, trace = subtractionTrace(a, b), renameSteps = trace.filter((s) => s.renamed);
    let prompt = `Subtraction bench ${i + 1}: calculate ${format(a)} - ${format(b)} and record each rename.`, answer = difference;
    let body = { operation: "subtraction", operands: [a, b], place_value_grid: [placeDigits(a), placeDigits(b)], rename_trace: trace, estimate: round100(a) - round100(b), inverse_check: `${format(difference)} + ${format(b)} = ${format(a)}` };
    let explanation = `${format(a)} - ${format(b)} = ${format(difference)}. Renaming exchanges one larger unit for ten equal smaller units while preserving the minuend's value.`, tag = "larger_minus_smaller_digit";
    if (mode === "explain_rename" || mode === "rename_across_zero") {
      const relevantSteps = mode === "rename_across_zero" ? renameSteps.filter((step) => step.crosses_zero) : renameSteps;
      const step = relevantSteps.length ? relevantSteps[i % relevantSteps.length] : trace[0]; answer = step.meaning;
      prompt = `Rename modeller ${i + 1}: explain the exchange used before subtracting in the ${step.place} column.`;
      body = { ...body, focus_step: step, base_ten_before_after: step.model, choices: [step.meaning, "Reverse the two digits in this column.", "Remove a unit without replacing its value."] };
      explanation = `${step.meaning} The before-and-after base-ten models have equal total value.`;
    } else if (mode === "expanded_difference_link") {
      answer = difference; prompt = `Representation bridge ${i + 1}: connect the renamed base-ten model to ${format(a)} - ${format(b)}.`;
      body = { ...body, partitioned_minuend_after_renaming: trace.map((s) => ({ place: s.place, available_units: s.available })) };
      explanation = `The renamed model still totals ${format(a)}; subtracting the aligned parts gives ${format(difference)}, matching the column method.`;
    } else if (mode === "missing_subtrahend_digit") {
      const masked = placeDigits(b), occupied = masked.map((digit, index) => digit.trim() ? index : -1).filter((index) => index >= 0), placeIndex = occupied[i % occupied.length], digit = masked[placeIndex]; masked[placeIndex] = "?"; answer = Number(digit);
      prompt = `Missing-digit panel ${i + 1}: ${format(a)} - ${masked.join("")} = ${format(difference)}. Find the missing digit.`;
      body = { ...body, masked_subtrahend_grid: masked, missing_place: ["thousands", "hundreds", "tens", "ones"][placeIndex] };
      explanation = `Aligned subtraction and its inverse check show that the missing digit is ${digit}.`;
    } else if (mode === "estimate_subtraction") {
      answer = round100(a) - round100(b); prompt = `Estimate station ${i + 1}: round to the nearest hundred to predict ${format(a)} - ${format(b)}.`;
      body = { ...body, choices: unique([answer, difference, answer + 100, Math.max(0, answer - 100)]) };
      explanation = `${format(round100(a))} - ${format(round100(b))} = ${format(answer)}; the exact difference ${format(difference)} is reasonable.`;
    } else if (mode === "inverse_subtraction_check") {
      answer = `${difference} + ${b} = ${a}`; prompt = `Inverse lock ${i + 1}: choose the addition that checks ${format(a)} - ${format(b)} = ${format(difference)}.`;
      body = { ...body, choices: [answer, `${a} + ${b} = ${difference}`, `${difference} - ${b} = ${a}`] };
      explanation = `Difference plus subtrahend returns the minuend: ${answer}.`;
    } else if (mode === "subtraction_transfer") {
      prompt = `${contexts[i % contexts.length]} mission ${i + 1}: ${format(a)} were prepared and ${format(b)} were used. Find and check how many remain.`;
      body = { ...body, context: contexts[i % contexts.length], step_planner: ["estimate", "align", "rename if needed", "add to inverse-check"] };
    }
    return maths({ id: `subtract-${mode}-${a}-${b}-${i + 1}`, format: "column-calculate", blueprint: "subtraction-renaming-paths", band: i < 8 ? "developing" : "expected", concept: mode, prompt, body, answer, explanation, tag, hook: "rename-through-zero", audioScript: i % 14 === 0 ? prompt : undefined });
  });
}

function diagnosisCandidates(count) {
  const modes = ["edge_alignment_error", "omitted_exchange", "double_counted_exchange", "digit_swap_subtraction", "rename_across_zero_error", "missing_digit_diagnosis", "inverse_check_error", "reasonableness_error"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], add = additions[i % additions.length], sub = subtractions[i % subtractions.length];
    let prompt, answer, body, explanation, tag;
    if (mode === "edge_alignment_error") {
      const [a, b] = alignPairs[i % alignPairs.length]; answer = "The ones digits are not aligned in the ones column."; tag = "edge_alignment";
      prompt = `Fault-finder ${i + 1}: a learner left-aligns ${format(a)} and ${format(b)}. Identify the first structural error.`;
      body = { shown_layout: [String(a).padEnd(4, " "), String(b).padEnd(4, " ")], choices: [answer, "The larger number must always go underneath.", "A comma needs its own calculation column."], repair_grid: [placeDigits(a), placeDigits(b)] };
      explanation = `${answer} Repair the layout before calculating so each column combines equal-value units.`;
    } else if (["omitted_exchange", "double_counted_exchange"].includes(mode)) {
      const [a, b] = add, correct = a + b, trace = additionTrace(a, b), step = trace.find((s) => s.exchange_out) ?? trace[0];
      answer = step.place; tag = "exchange_not_recorded"; const shown = mode === "omitted_exchange" ? correct - 10 ** (places.indexOf(step.place) + 1) : correct + 10 ** (places.indexOf(step.place) + 1);
      prompt = `Addition fault-finder ${i + 1}: ${format(a)} + ${format(b)} is shown as ${format(shown)}. Locate the first exchange error.`;
      body = { operation: "addition", operands: [a, b], shown_answer: shown, correct_answer: correct, first_error_column: step.place, step_strip: trace, choices: places };
      explanation = `Inspect from the ones. The first invalid record is the ${step.place} exchange; the repaired total is ${format(correct)}.`;
    } else if (["digit_swap_subtraction", "rename_across_zero_error"].includes(mode)) {
      const [a, b] = mode === "rename_across_zero_error" ? subtractions.find((pair) => subtractionTrace(...pair).some((step) => step.crosses_zero)) : sub;
      const correct = a - b, trace = subtractionTrace(a, b), step = mode === "rename_across_zero_error" ? trace.find((s) => s.crosses_zero) : trace.find((s) => s.renamed) ?? trace[0];
      answer = step.place; tag = "larger_minus_smaller_digit"; const shown = absoluteDigitDifference(a, b);
      prompt = `Subtraction fault-finder ${i + 1}: a learner reports ${format(a)} - ${format(b)} = ${format(shown)}. Find the first invalid column.`;
      body = { operation: "subtraction", operands: [a, b], shown_answer: shown, correct_answer: correct, first_error_column: step.place, step_strip: trace, choices: places };
      explanation = `The learner cannot reverse digits to make a positive difference. Rename place-value units at the ${step.place} step; the correct answer is ${format(correct)}.`;
    } else if (mode === "missing_digit_diagnosis") {
      const [a, b] = add, total = a + b, placeIndex = i % 4, digit = Number(placeDigits(a)[placeIndex]); answer = digit; tag = "missing_place_value_digit";
      const masked = placeDigits(a); masked[placeIndex] = "?"; prompt = `Diagnostic panel ${i + 1}: ${masked.join("")} + ${format(b)} = ${format(total)}. Which digit repairs the equation?`;
      body = { masked_addend: masked, second_addend: b, total, missing_place: ["thousands", "hundreds", "tens", "ones"][placeIndex], choices: unique([digit, (digit + 1) % 10, (digit + 9) % 10]) };
      explanation = `Use the inverse or work through aligned columns: the missing digit is ${digit}.`;
    } else if (mode === "inverse_check_error") {
      const [a, b] = sub, correct = a - b; answer = `${correct} + ${b} = ${a}`; tag = "inverse_used_incorrectly";
      prompt = `Check inspector ${i + 1}: choose the inverse equation that genuinely verifies ${format(a)} - ${format(b)} = ${format(correct)}.`;
      body = { choices: [answer, `${correct} - ${b} = ${a}`, `${a} + ${b} = ${correct}`], estimate_band: [round100(correct) - 100, round100(correct) + 100] };
      explanation = `Addition undoes the subtraction: ${answer}.`;
    } else {
      const [a, b] = add, correct = a + b, implausible = correct + 5000; answer = `Reject ${format(implausible)} because ${format(round100(a))} + ${format(round100(b))} is about ${format(round100(a) + round100(b))}.`; tag = "estimate_not_used";
      prompt = `Reasonableness gate ${i + 1}: a calculator display shows ${format(implausible)} for ${format(a)} + ${format(b)}. What should the learner conclude?`;
      body = { shown_answer: implausible, exact_answer: correct, estimate: round100(a) + round100(b), choices: [answer, "Accept it because every calculator display is correct.", "Ignore magnitude and inspect only the ones digit."] };
      explanation = `${answer} The exact calculation can then be repaired to ${format(correct)}.`;
    }
    return maths({ id: `diagnose-${mode}-${i + 1}`, format: "error-analysis", blueprint: "diagnose-and-repair-written-methods", band: "secure", concept: mode, prompt, body, answer, explanation, tag, hook: "first-error-freeze", audioScript: i % 15 === 0 ? prompt : undefined });
  });
}

function methodCandidates(count) {
  const modes = ["mental_adjustment", "mental_complement", "written_method_choice", "estimate_then_check", "short_multiplication_link", "short_division_link", "multistep_context", "representation_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], context = contexts[i % contexts.length];
    let prompt, answer, body, explanation, tag = "written_method_by_default";
    if (mode === "mental_adjustment") {
      const a = 2450 + i * 10, b = 199, total = a + b; answer = total;
      prompt = `Method chooser ${i + 1}: find ${format(a)} + 199 efficiently and explain your choice.`;
      body = { calculation: `${a} + 199`, choices: ["mental adjustment: add 200, then subtract 1", "four-column method is the only valid method", "estimate only and stop"], chosen_strategy: "mental adjustment", strategy_steps: [`${a} + 200 = ${a + 200}`, `${a + 200} - 1 = ${total}`] };
      explanation = `Adding 200 then compensating by subtracting 1 gives ${format(total)}. A written method could work, but this mental relationship is clearer.`;
    } else if (mode === "mental_complement") {
      const a = 5000 + (i % 5) * 100, b = a - (35 + i), difference = a - b; answer = difference;
      prompt = `Method chooser ${i + 1}: find the difference between ${format(b)} and ${format(a)} using an efficient route.`;
      body = { calculation: `${a} - ${b}`, chosen_strategy: "count up to the nearby multiple", number_line_jumps: complementJumps(b, a), alternatives_accepted: ["counting up", "column subtraction with valid explanation"] };
      explanation = `Counting up from ${format(b)} to ${format(a)} totals ${difference}; the close numbers make this efficient and easy to check.`;
    } else if (mode === "written_method_choice") {
      const [a, b] = i % 2 ? additions[i % additions.length] : subtractions[i % subtractions.length], op = i % 2 ? "+" : "-", result = op === "+" ? a + b : a - b; answer = "Use a place-value-aligned written method, after estimating.";
      prompt = `Strategy desk ${i + 1}: choose and justify a reliable method for ${format(a)} ${op} ${format(b)}.`;
      body = { calculation: `${a} ${op} ${b}`, result, choices: [answer, "Ignore place value and work from the left edge.", "Guess from the final digits only."], justification_stem: "This method is efficient here because..." };
      explanation = `Both numbers have several non-zero places, so an aligned written method organises the calculation. The exact result is ${format(result)}.`;
    } else if (mode === "estimate_then_check") {
      const [a, b] = additions[i % additions.length], exact = a + b, estimate = round100(a) + round100(b); answer = exact;
      prompt = `Estimate–do–check mission ${i + 1}: calculate ${format(a)} + ${format(b)}, then compare with the estimate ${format(estimate)}.`;
      body = { operands: [a, b], estimate, exact, reasonableness_statement: `${format(exact)} is close to ${format(estimate)}`, inverse_check: `${exact} - ${b} = ${a}` };
      explanation = `${format(a)} + ${format(b)} = ${format(exact)}; it is close to ${format(estimate)} and the inverse returns ${format(a)}.`;
    } else if (mode === "short_multiplication_link") {
      const [a, factor] = multiplications[i % multiplications.length], product = a * factor, parts = expanded(a).filter(Boolean).map((part) => part * factor); answer = product; tag = "multiplies_digits_without_place_value";
      prompt = `Partial-products bridge ${i + 1}: use place value to calculate ${format(a)} × ${factor}.`;
      body = { operation: "short multiplication", multiplicand: a, multiplier: factor, partition: expanded(a).filter(Boolean), partial_products: parts, recombine: parts.reduce((x, y) => x + y, 0), scope: "Year 4 one-digit multiplier representation link; no long multiplication" };
      explanation = `${expanded(a).filter(Boolean).map((p) => `${p} × ${factor}`).join(", ")} gives partial products ${parts.join(", ")}; recombining gives ${format(product)}. The written record represents these place-value products.`;
    } else if (mode === "short_division_link") {
      const [dividend, divisor] = divisions[i % divisions.length], quotient = dividend / divisor; answer = quotient; tag = "divides_digits_without_grouping_meaning";
      prompt = `Equal-grouping bridge ${i + 1}: share ${format(dividend)} equally into ${divisor} groups and connect the grouping to a short written record.`;
      body = { operation: "short division", dividend, divisor, quotient, place_value_partition: expanded(dividend).filter(Boolean), grouping_model: `${dividend} items shared equally into ${divisor} groups`, inverse_check: `${quotient} × ${divisor} = ${dividend}`, scope: "Year 4 exact division by one digit with grouping model; no long division" };
      explanation = `Each of ${divisor} equal groups contains ${quotient}. The grouping is checked because ${quotient} × ${divisor} = ${dividend}.`;
    } else if (mode === "multistep_context") {
      const [a, b] = additions[i % additions.length], used = 300 + (i * 37) % 900, total = a + b, remaining = total - used; answer = remaining; tag = "multistep_operation_order";
      prompt = `${context} workshop ${i + 1}: ${format(a)} arrive in one batch and ${format(b)} in another; ${format(used)} are used. How many remain?`;
      body = { context, quantities: [a, b, used], step_planner: [{ step: 1, operation: "addition", result: total }, { step: 2, operation: "subtraction", result: remaining }], estimate_each_step: true, inverse_check_final_step: `${remaining} + ${used} = ${total}` };
      explanation = `First combine the batches: ${format(a)} + ${format(b)} = ${format(total)}. Then subtract those used: ${format(total)} - ${format(used)} = ${format(remaining)}.`;
    } else {
      const [a, b] = i % 2 ? additions[i % additions.length] : subtractions[i % subtractions.length], operation = i % 2 ? "addition" : "subtraction", result = operation === "addition" ? a + b : a - b; answer = result; tag = "representation_not_linked_to_procedure";
      prompt = `Model-to-symbol return route ${i + 1}: connect the base-ten/exchange model to ${format(a)} ${operation === "addition" ? "+" : "-"} ${format(b)}.`;
      body = { operation, operands: [a, b], result, representations: ["place-value chart", "base-ten before/after exchange", "expanded parts", "column record"], equivalence_claim: "Every representation preserves the same quantities and place values.", review_interval_days: reviewDays[i % reviewDays.length] };
      explanation = `All four representations encode the same ${operation}, giving ${format(result)}; exchange marks explain regrouping rather than acting as unexplained digit tricks.`;
    }
    return maths({ id: `method-${mode}-${i + 1}`, format: "method-choice", blueprint: "estimate-choose-check", band: mode.includes("multistep") ? "stretch" : "mixed", concept: mode, prompt, body, answer, explanation, tag, hook: "strategy-check-loop", audioScript: i % 12 === 0 ? prompt : undefined });
  });
}

function maths({ id, format, blueprint, band, concept, prompt, body, answer, explanation, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_keep_text_numbers_models_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_numbers_models_and_text_are_complete" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      interaction_mode: "select_build_enter_step_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, move the learner's named counter or record an indicated digit/explanation without choosing the mathematical step.",
      place_value_chart_route: "Labelled thousands, hundreds, tens and ones cells accept digits by tap, keyboard, switch, eye gaze, pointing or adult scribing; commas never occupy a value column.",
      base_ten_exchange_route: "Static before/after counters show one larger unit renamed as ten equal smaller units with totals displayed as equal; physical counters are optional.",
      partial_products_grouping_route: "Multiplication uses labelled place-value partial products; division uses equal-group trays and an inverse multiplication check, with a linear text table alternative.",
      step_planner_route: "ESTIMATE–CHOOSE–MODEL–CALCULATE–CHECK reveals one stage at a time and preserves completed stages.",
      dyscalculia_support: { place_headings_persistent: true, zero_placeholders_explicit: true, quantity_before_symbol: true, one_column_or_step_at_a_time: true, estimate_do_check_strip: true, exchange_totals_preserved: true, inverse_fact_visible: true },
      concrete_route: "Use optional place-value counters, base-ten equipment, exchange mats or equal-group trays; no learner is required to touch shared materials.",
      visual_route: "Low-clutter labelled grid, large digits, generous spacing, pattern plus text rather than colour-only meaning and static before/after exchange frames.",
      reduced_load_route: "Show one operation and active column at a time, mask completed inactive columns only on request, and retain every correct digit during repair.",
      motor_alternative: "Tap, numeric entry, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed responses replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_instant_before_after_models_no_countdowns_or_particles", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "restore one calm calculation station in the Number Workshop", reward: "one blueprint stamp for a represented, estimated or checked idea", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct place-value evidence stays. Open one model or check clue and continue without penalty." },
      procedural_meaning_policy: "Every written mark must be linked to place value, equal-value exchange, partial products, equal grouping or an inverse check; unexplained digit tricks are not accepted.",
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: { value: answer },
    hints: ["Name the value of the active column or quantity before operating on its digit.", "Estimate, use a concrete/visual model if useful, then check with magnitude or the inverse."],
    explanation,
    feedback: {
      correct: `Workshop station restored through ${concept.replaceAll("_", " ")}. ${explanation}`,
      repair: repairFor(tag),
      mathematical_evidence: explanation,
      strategy_message: "Mental, written, concrete, visual, pointing, AAC and adult-scribed routes are equally valid when the mathematical reasoning is shown; speed and handwriting are never scored.",
      retry: "Keep correct columns and models, inspect the first uncertain place-value step, then retry without losing progress.",
    },
    difficulty: band === "intro" ? 3 : band === "developing" ? 4 : band === "expected" ? 6 : band === "secure" ? 7 : band === "stretch" ? 8 : 5,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function additionTrace(a, b) {
  const ad = [...String(a).padStart(4, "0")].map(Number), bd = [...String(b).padStart(4, "0")].map(Number), out = []; let carry = 0;
  for (let index = 3; index >= 0; index--) {
    const incoming = carry, columnTotal = ad[index] + bd[index] + incoming, record = columnTotal % 10; carry = Math.floor(columnTotal / 10);
    const place = places[3 - index];
    out.push({ place, first_units: ad[index], second_units: bd[index], exchange_in: incoming, column_total: columnTotal, record, exchange_out: carry, meaning: carry ? `${columnTotal} ${place} units are renamed as ${record} ${place} unit${record === 1 ? "" : "s"} and 1 unit in the next larger place.` : `${columnTotal} ${place} units remain in the ${place} column; no exchange is needed.` });
  }
  return out;
}

function subtractionTrace(a, b) {
  const top = [...String(a).padStart(4, "0")].map(Number), bottom = [...String(b).padStart(4, "0")].map(Number), out = [];
  for (let index = 3; index >= 0; index--) {
    const before = top[index]; let renamed = false, donor = null;
    if (top[index] < bottom[index]) {
      donor = index - 1; while (donor >= 0 && top[donor] === 0) donor--;
      if (donor < 0) throw new Error(`Invalid subtraction trace ${a} - ${b}.`);
      top[donor]--; for (let j = donor + 1; j < index; j++) top[j] += 9; top[index] += 10; renamed = true;
    }
    const place = places[3 - index], result = top[index] - bottom[index];
    out.push({ place, before_units: before, subtract_units: bottom[index], available: top[index], result, renamed, crosses_zero: renamed && donor < index - 1, donor_place: donor == null ? null : places[3 - donor], meaning: renamed ? `One ${places[3 - donor].replace(/s$/, "")} is exchanged through the place-value chart so ${top[index]} ${place} units are available; the total value is unchanged.` : `${top[index]} ${place} units can subtract ${bottom[index]} without renaming.`, model: { total_before: a, total_after: a, active_units_after: top[index] } });
  }
  return out;
}

function repairFor(tag) {
  const repairs = {
    edge_alignment: "Return both ones digits to the labelled ones column, rebuild leftwards and only then calculate.",
    exchange_not_recorded: "Show the equal-value before/after exchange, record it once in the next column and recalculate from the first uncertain step.",
    larger_minus_smaller_digit: "Keep the subtraction direction, rename a larger place-value unit into ten smaller units and verify the result with addition.",
    missing_place_value_digit: "Use the inverse and an aligned place-value grid to isolate the missing column without changing known digits.",
    inverse_used_incorrectly: "Name which operation must undo the original and check that it returns the starting quantity.",
    estimate_not_used: "Round to a useful place, predict an answer band, then compare the exact result with that magnitude.",
    written_method_by_default: "Inspect the number relationship first; compare one concise mental route with an aligned written route and justify the clearer choice.",
    multiplies_digits_without_place_value: "Partition the multiplicand, multiply each place-value part and recombine the labelled partial products.",
    divides_digits_without_grouping_meaning: "Build equal groups or use a grouping table, then multiply quotient by divisor to check the original total.",
    multistep_operation_order: "Mark what each step must find, estimate it, preserve that result and use it in the next operation.",
    representation_not_linked_to_procedure: "Match each written mark to the same quantity in the chart or base-ten model before continuing.",
  };
  return repairs[tag] ?? "Return to the place-value model, preserve correct evidence and repair only the first invalid step.";
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const responseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  const modeByFormat = {
    "place-value-layout": "place_value_alignment",
    "column-calculate": "written_calculation",
    "error-analysis": "first_error_diagnosis",
    "method-choice": "method_evidence_choice",
  };
  return {
    ...variant,
    body: {
      ...body,
      written_methods_contract: {
        kind: "place_value_written_method",
        mode: modeByFormat[variant.format] ?? "authored_choice",
        operation_key: body.operation !== undefined ? "operation" : null,
        operands_key: body.operands !== undefined ? "operands" : null,
        exchange_trace_key: body.exchange_trace !== undefined ? "exchange_trace" : null,
        rename_trace_key: body.rename_trace !== undefined ? "rename_trace" : null,
        choices_key: body.choices !== undefined ? "choices" : null,
        alternatives_key: body.alternatives_accepted !== undefined ? "alternatives_accepted" : null,
        chosen_strategy_key: body.chosen_strategy !== undefined ? "chosen_strategy" : null,
        estimate_key: body.estimate !== undefined ? "estimate" : null,
        reasonableness_key: body.reasonableness_statement !== undefined ? "reasonableness_statement" : null,
        response_modes: responseModes,
        drag_required: false,
        exchange_preserves_quantity: true,
        inverse_check_supported: true,
        pressure_policy: "no_timer_no_speed_score_no_lives_no_streak_loss",
      },
    },
  };
}

function validateBank(currentPack, preserved, snapshot, generatedVariants) {
  if (preserved.length !== 4 || JSON.stringify(preserved.map(removeWrittenContract)) !== snapshot) throw new Error("Curated preservation failed.");
  if (generatedVariants.length !== 236 || currentPack.question_variants.length !== 240 || currentPack.practice.variant_targets.pilot !== 240) throw new Error("Pilot must contain 4 curated and 236 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id); if (new Set(ids).size !== ids.length) throw new Error("Duplicate IDs found.");
  const signatures = new Set();
  for (const variant of [...preserved, ...generatedVariants]) validateWrittenContract(variant);
  for (const v of generatedVariants) { const sig = `${v.format}|${v.body.prompt}|${JSON.stringify(v.expected_answer.value)}`; if (signatures.has(sig)) throw new Error(`Duplicate generated signature ${v.id}.`); signatures.add(sig); }
  const counts = countBy(currentPack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, target] of Object.entries(allocation)) if (counts[id] !== target) throw new Error(`${id}: expected ${target}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generatedVariants.map((v) => v.body.concept_focus));
  for (const concept of ["align_place_values", "zero_placeholder", "explain_exchange", "consecutive_exchanges", "partial_sums_link", "missing_addend_digit", "inverse_addition_check", "explain_rename", "rename_across_zero", "missing_subtrahend_digit", "inverse_subtraction_check", "edge_alignment_error", "omitted_exchange", "digit_swap_subtraction", "inverse_check_error", "mental_adjustment", "mental_complement", "written_method_choice", "estimate_then_check", "short_multiplication_link", "short_division_link", "multistep_context", "representation_transfer"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
  for (const v of generatedVariants) {
    const b = v.body;
    if (!b.dyscalculia_support?.place_headings_persistent || !b.place_value_chart_route || !b.base_ten_exchange_route || !b.partial_products_grouping_route || !b.step_planner_route || !b.concrete_route || !b.visual_route || !b.reduced_load_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.mathematical_evidence || !v.feedback?.retry) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error || b.gamification?.speed_bonus) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (!b.procedural_meaning_policy.includes("unexplained digit tricks")) throw new Error(`Procedural meaning policy missing in ${v.id}.`);
    if (b.audio_required) { if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${v.id}.`); }
    else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unexpected audio reference in ${v.id}.`);
  }
}

function validateWrittenContract(variant) {
  const contract = variant.body?.written_methods_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (!contract || contract.drag_required !== false || contract.exchange_preserves_quantity !== true || contract.inverse_check_supported !== true || contract.pressure_policy !== "no_timer_no_speed_score_no_lives_no_streak_loss" || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible written-method contract.`);
  if (!["place_value_alignment", "written_calculation", "first_error_diagnosis", "method_evidence_choice", "authored_choice"].includes(contract.mode)) throw new Error(`${variant.id} has an unknown written-method mode.`);
  if (contract.mode === "written_calculation" && !contract.operation_key && !contract.exchange_trace_key && !contract.rename_trace_key) throw new Error(`${variant.id} lacks calculation or exchange semantics.`);
  if (contract.mode === "first_error_diagnosis" && !Array.isArray(variant.body?.choices)) throw new Error(`${variant.id} lacks accessible error choices.`);
  const hasMethodEvidence = ["choices", "alternatives_accepted", "chosen_strategy", "reasonableness_statement", "estimate", "partial_products", "recombine", "partition", "operands", "operation", "context", "quantities", "step_planner", "estimate_each_step", "inverse_check_final_step", "scope", "number_line_jumps"].some((key) => variant.body?.[key] !== undefined);
  if (contract.mode === "method_evidence_choice" && !hasMethodEvidence) throw new Error(`${variant.id} lacks an accessible method route.`);
}

function removeWrittenContract(variant) {
  const { written_methods_contract: _writtenMethodsContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function placeDigits(n) { return [...String(n).padStart(4, " ")]; }
function expanded(n) { return [...String(n)].map((d, i, a) => Number(d) * 10 ** (a.length - i - 1)); }
function expandedAddends(a, b) { const ap = expanded(a), bp = expanded(b), width = Math.max(ap.length, bp.length), x = [...Array(width - ap.length).fill(0), ...ap], y = [...Array(width - bp.length).fill(0), ...bp]; return x.map((v, i) => v + y[i]).filter(Boolean); }
function absoluteDigitDifference(a, b) { const x = placeDigits(a).map((d) => Number(d || 0)), y = placeDigits(b).map((d) => Number(d || 0)); return Number(x.map((d, i) => Math.abs(d - y[i])).join("")); }
function complementJumps(from, to) { const jumps = []; let current = from; const nextTen = Math.ceil(current / 10) * 10; if (nextTen > current && nextTen < to) { jumps.push(nextTen - current); current = nextTen; } if (to > current) jumps.push(to - current); return jumps; }
function round100(n) { return Math.round(n / 100) * 100; }
function format(n) { return Number(n).toLocaleString("en-GB"); }
function unique(items) { return [...new Set(items.map((item) => JSON.stringify(item)))].map((item) => JSON.parse(item)); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
