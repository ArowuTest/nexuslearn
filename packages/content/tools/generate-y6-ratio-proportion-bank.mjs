#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y6-ratio-proportion-scale.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y6-ratio-proportion-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y6-ratio-proportion-scale") throw new Error("This generator only supports the Year 6 ratio, proportion and scale pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const missions = [
  { key: "atlas", place: "Atlas Survey Base", goal: "restore the scaled route map", reward: "map-coordinate tile" },
  { key: "kitchen", place: "Expedition Test Kitchen", goal: "prepare the field recipe", reward: "recipe-ratio seal" },
  { key: "habitat", place: "Habitat Design Lab", goal: "balance the planting plan", reward: "habitat module" },
  { key: "museum", place: "Miniature Museum Studio", goal: "complete the scale model", reward: "model-gallery piece" },
  { key: "signal", place: "Proportion Signal Station", goal: "decode the linked quantities", reward: "signal-pair marker" },
];

const candidates = [
  ...ratioLanguageCandidates(27),
  ...equivalentRatioCandidates(27),
  ...scalingCandidates(27),
  ...recipeMapCandidates(27),
  ...unitisingCandidates(26),
  ...proportionCandidates(26),
  ...missingValueCandidates(26),
  ...representationCandidates(26),
  ...misconceptionCandidates(25),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Depth-wave review bank reaches the 240-item pilot target with three preserved curated questions and 237 deterministic candidates covering ratio language, equivalent ratios, scaling, recipes and maps, unitising, proportion, missing values, representations and misconception repair. Generated candidates include concrete-to-visual ratio scaffolds, keyboard/switch/oral and non-drag interactions, rich scale-factor/unit/check feedback and strategic mission progress earned through reasoning rather than speed. Human curriculum, teacher, SEND, accessibility, safeguarding and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, enrichedCandidates);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`ratio-proportion-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`ratio-proportion-bank strands=${summary(candidates, (variant) => variant.body.ratio_strand)}`);
console.log(`ratio-proportion-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`ratio-proportion-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`ratio-proportion-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 ratio-proportion bank is out of date; run generate-y6-ratio-proportion-bank.mjs --write.");
  console.log("ratio-proportion-bank deterministic check passed");
} else {
  console.log("ratio-proportion-bank dry-run; pass --write to update the pack");
}

function ratioLanguageCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[index % missions.length];
    const a = 2 + (index % 6);
    const b = 3 + ((index * 2) % 7);
    const mode = index % 5;
    const cases = [
      { prompt: `A tray has ${a} blue counters and ${b} red counters. Which statement gives blue:red in the stated order?`, answer: `${a}:${b}`, wrong: [`${b}:${a}`, `${a}:${a + b}`, `${a + b}:${b}`] },
      { prompt: `For every ${a} fern cards there are ${b} flower cards. Which phrase matches the relationship?`, answer: `${a} fern cards for every ${b} flower cards`, wrong: [`${b} fern cards for every ${a} flower cards`, `${a + b} fern cards for every flower card`, `${a} cards altogether`] },
      { prompt: `The ratio of adults to children is ${a}:${b}. What does the first number represent?`, answer: `${a} equal ratio parts for adults`, wrong: [`${a} people altogether`, `${a} parts for children`, `${a} more adults than children`] },
      { prompt: `There are ${a} oak leaves and ${b} beech leaves. Which ratio compares oak leaves to all leaves?`, answer: `${a}:${a + b}`, wrong: [`${a}:${b}`, `${b}:${a + b}`, `${a + b}:${a}`] },
      { prompt: `A mix uses water:concentrate = ${a}:${b}. Which warning about order is correct?`, answer: `Reversing it to ${b}:${a} describes a different mix`, wrong: ["Ratio order never matters", "The colon means subtraction", "Both numbers mean the total"] },
    ];
    const item = cases[mode];
    return variant({ id: `language-${mode + 1}-${index + 1}`, format: "multiple_choice", blueprint: "ratio-language-representations", band: "intro", strand: "ratio_language", mission, prompt: `Ratio-language decoder ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, ratio: [a, b], concrete: `${a} counters of the first type and ${b} of the second`, visual: `two labelled bars partitioned ${a} and ${b} ratio parts`, hints: ["Read the labels on the left and right of the colon in order.", "Decide whether the question compares part:part or part:whole before writing numbers."], explanation: `${item.answer}. Ratio language preserves quantity labels and order; it does not automatically describe a difference or a total.`, tag: mode === 3 ? "part_part_vs_part_whole" : "ratio_order_reversal", repair: "Build the two labelled counter groups, point left-to-right while saying 'for every', then compare with a part-to-whole bar." });
  });
}

function equivalentRatioCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 1) % missions.length];
    const a = 2 + (index % 7);
    const b = 3 + ((index * 3) % 8);
    const factor = 2 + (index % 5);
    const answer = `${a * factor}:${b * factor}`;
    return variant({ id: `equivalent-${a}-${b}-x${factor}-${index + 1}`, format: "scale-build", blueprint: "scale-factor-builds", band: "developing", strand: "equivalent_ratios", mission, prompt: `Equivalent-ratio bridge ${index + 1}: scale ${a}:${b} by ${factor}. Which ratio keeps the relationship?`, choices: [answer, `${a * factor}:${b}`, `${a}:${b * factor}`, `${a + factor}:${b + factor}`], answer, ratio: [a, b], concrete: `${factor} identical groups, each containing ${a} and ${b} linked objects`, visual: `ratio strip ${a}:${b} duplicated ${factor} times`, hints: [`Make ${factor} identical copies of both parts.`, `Multiply ${a} and ${b} by the same factor ${factor}.`], explanation: `${a} × ${factor} = ${a * factor} and ${b} × ${factor} = ${b * factor}, so ${answer} is equivalent to ${a}:${b}.`, tag: "one_quantity_only", repair: "Duplicate the entire two-colour ratio tray, not one colour alone, and count corresponding parts after each copy." });
  });
}

function scalingCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 2) % missions.length];
    const a = 3 + (index % 6);
    const b = 4 + (index % 7);
    const factor = 2 + (index % 6);
    const mode = index % 3;
    let prompt;
    let answer;
    let choices;
    if (mode === 0) { prompt = `A design uses ${a} long rods for every ${b} short rods. Scale both quantities by ${factor}.`; answer = `${a * factor} long and ${b * factor} short`; choices = [answer, `${a * factor} long and ${b} short`, `${a + factor} long and ${b + factor} short`, `${a} long and ${b * factor} short`]; }
    else if (mode === 1) { prompt = `The ratio ${a * factor}:${b * factor} was made from ${a}:${b}. What scale factor was used?`; answer = factor; choices = [answer, factor + 1, a, b]; }
    else { prompt = `A ${a}:${b} model is reduced by dividing both parts by ${factor}. Start from ${a * factor}:${b * factor}.`; answer = `${a}:${b}`; choices = [answer, `${a * factor - factor}:${b * factor - factor}`, `${a}:${b * factor}`, `${a * factor}:${b}`]; }
    return variant({ id: `scaling-${mode + 1}-${index + 1}`, format: "scale-build", blueprint: "scale-factor-builds", band: "developing", strand: "scaling", mission, prompt: `Scale workshop ${index + 1}: ${prompt}`, choices, answer, ratio: [a, b], concrete: "linked bundles scaled together with one multiplier/divisor token", visual: `double number line marking factor ${factor}`, hints: ["Find the multiplicative change from one known value.", "Apply exactly the same multiplication or division to the paired quantity."], explanation: `${String(answer)} preserves the relationship because both linked quantities use scale factor ${factor}; an additive change would not preserve the ratio.`, tag: "one_quantity_only", repair: "Place one scale token across both rows of a ratio table, then reveal the two calculations together." });
  });
}

function recipeMapCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 3) % missions.length];
    const base = 2 + (index % 5);
    const paired = 3 + ((index * 2) % 7);
    const factor = 2 + (index % 6);
    const mode = index % 3;
    let prompt;
    let answer;
    let choices;
    if (mode === 0) { prompt = `A field recipe uses ${base} cups of oats for ${paired} portions. How many cups match ${paired * factor} portions?`; answer = `${base * factor} cups`; choices = [answer, `${base + factor} cups`, `${paired * factor} cups`, `${base * paired} cups`]; }
    else if (mode === 1) { prompt = `On a map, ${base} cm represents ${paired} km. What distance does ${base * factor} cm represent?`; answer = `${paired * factor} km`; choices = [answer, `${paired + factor} km`, `${base * factor} km`, `${paired * base} km`]; }
    else { prompt = `A model wall is ${base} cm high and represents ${paired} m. A second wall is ${base * factor} cm high. What real height matches it?`; answer = `${paired * factor} m`; choices = [answer, `${paired + factor} m`, `${base * factor} m`, `${paired - factor} m`]; }
    return variant({ id: `transfer-${mode + 1}-${index + 1}`, format: "ratio-table", blueprint: "map-and-recipe-transfer", band: "stretch", strand: "recipes_maps", mission, prompt: `Transfer mission ${index + 1}: ${prompt}`, choices, answer, ratio: [base, paired], concrete: "paired labelled measure cards repeated in equal bundles", visual: `context ratio table ${base} -> ${base * factor}; ${paired} -> ?`, hints: [`${base} becomes ${base * factor} by multiplying by ${factor}.`, `Use the same factor ${factor} on the paired quantity and keep its unit.`], explanation: `${paired} × ${factor} = ${paired * factor}, so ${String(answer)}. The context changes, but the paired quantities retain one multiplicative scale relationship.`, tag: "additive_change", repair: "Build equal recipe batches or align a map/model double number line; attach units to every value before scaling." });
  });
}

function unitisingCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 4) % missions.length];
    const units = 2 + (index % 7);
    const per = 3 + (index % 8);
    const target = 2 + ((index * 2) % 9);
    const total = units * per;
    const answer = target * per;
    return variant({ id: `unitise-${units}-${per}-${target}-${index + 1}`, format: "ratio-table", blueprint: "unitising-and-proportion", band: "secure", strand: "unitising", mission, prompt: `Unitising lab ${index + 1}: ${units} packs contain ${total} markers. At the same rate, how many markers are in ${target} packs?`, choices: [answer, total + target, units * target, total * target], answer, ratio: [units, total], concrete: `${total} counters split equally into ${units} pack hoops`, visual: `ratio table ${units} packs -> ${total}; 1 pack -> ${per}; ${target} packs -> ?`, hints: [`Find one pack: ${total} ÷ ${units} = ${per}.`, `Then scale one pack to ${target} packs: ${per} × ${target}.`], explanation: `One pack contains ${per} markers, so ${target} packs contain ${per} × ${target} = ${answer}. Unitising exposes the one-unit rate before rescaling.`, tag: "divides_wrong_quantity", repair: "Share counters equally into the known number of pack hoops, label ONE PACK, then duplicate that unit group." });
  });
}

function proportionCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[index % missions.length];
    const part = 2 + (index % 6);
    const whole = part + 3 + (index % 5);
    const factor = 2 + (index % 7);
    const mode = index % 2;
    const answer = mode === 0 ? part * factor : (whole - part) * factor;
    const prompt = mode === 0
      ? `${part} of every ${whole} habitat tiles are water tiles. In ${whole * factor} tiles, how many are water tiles?`
      : `${part} of every ${whole} cards are blue. In ${whole * factor} cards, how many are not blue?`;
    return variant({ id: `proportion-${mode + 1}-${index + 1}`, format: "ratio-table", blueprint: "integer-scale-ratio-tables", band: "expected", strand: "proportion", mission, prompt: `Proportion planner ${index + 1}: ${prompt}`, choices: [answer, part + factor, whole * factor - part, part * whole], answer, ratio: mode === 0 ? [part, whole] : [whole - part, whole], concrete: `${factor} identical whole trays, each with ${part} target and ${whole - part} other tiles`, visual: `stacked bar showing ${part}/${whole} repeated across whole ${whole * factor}`, hints: [`The whole ${whole} scales to ${whole * factor} by factor ${factor}.`, mode === 0 ? `Scale the target part ${part} by ${factor}.` : `First find ${whole - part} not-blue cards in each group, then scale by ${factor}.`], explanation: `${answer} is the proportional amount because every group of ${whole} keeps the same composition and the whole number of groups is multiplied by ${factor}.`, tag: mode === 1 ? "part_whole_complement_confusion" : "additive_change", repair: "Build one complete part-whole tray, duplicate the whole tray, and count the same category across all copies." });
  });
}

function missingValueCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 1) % missions.length];
    const a = 2 + (index % 7);
    const b = 3 + ((index * 3) % 8);
    const factor = 2 + (index % 6);
    const mode = index % 3;
    let prompt;
    let answer;
    let choices;
    if (mode === 0) { prompt = `${a}:${b} = ${a * factor}:?`; answer = b * factor; choices = [answer, b + factor, a * factor + b, a + b * factor]; }
    else if (mode === 1) { prompt = `${a}:${b} = ?:${b * factor}`; answer = a * factor; choices = [answer, a + factor, b * factor, a * b]; }
    else { prompt = `${a * factor}:${b * factor} simplifies to ${a}:?`; answer = b; choices = [answer, b * factor - factor, a, factor]; }
    return variant({ id: `missing-${mode + 1}-${index + 1}`, format: "ratio-table", blueprint: "integer-scale-ratio-tables", band: "expected", strand: "missing_values", mission, prompt: `Missing-value grid ${index + 1}: complete ${prompt}.`, choices, answer, ratio: [a, b], concrete: "paired bundles with one covered quantity", visual: `ratio table ${a}:${b} linked by factor ${factor}`, hints: ["Find the multiplicative factor using the complete pair of corresponding values.", "Use that same factor in the other row, preserving ratio order."], explanation: `${answer} completes ${prompt} because the corresponding quantities are linked by scale factor ${factor}.`, tag: "additive_change", repair: "Draw vertical correspondence arrows first, write × or ÷ on both rows, then uncover the missing-value card." });
  });
}

function representationCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 2) % missions.length];
    const a = 2 + (index % 6);
    const b = 3 + ((index * 2) % 7);
    const mode = index % 4;
    const cases = [
      { prompt: `Which bar model represents ${a}:${b}?`, answer: `two labelled bars split into ${a} and ${b} equal-sized ratio parts`, wrong: [`bars split into ${a} and ${a + b} parts`, "bars with unequal-sized ratio parts", "one unlabelled bar"] },
      { prompt: `Which table preserves the ratio ${a}:${b}?`, answer: `rows (${a}, ${b}), (${a * 2}, ${b * 2}), (${a * 3}, ${b * 3})`, wrong: [`rows (${a}, ${b}), (${a + 2}, ${b + 2})`, `rows (${a}, ${b}), (${a * 2}, ${b})`, "a table with swapped labels in every row"] },
      { prompt: `Which double number line represents ${a} first-units for every ${b} second-units?`, answer: `aligned ticks 0,${a},${a * 2} above 0,${b},${b * 2}`, wrong: [`unaligned ticks using +${a} on both lines`, "one line with no paired labels", `top and bottom labels reversed halfway`] },
      { prompt: `Which counters show two copies of ${a}:${b}?`, answer: `${a * 2} first-colour counters and ${b * 2} second-colour counters in two identical groups`, wrong: [`${a * 2} first and ${b} second`, `${a + 2} first and ${b + 2} second`, "counters grouped only by colour shade"] },
    ];
    const item = cases[mode];
    return variant({ id: `representation-${mode + 1}-${index + 1}`, format: "multiple_choice", blueprint: "ratio-language-representations", band: "intro", strand: "representations", mission, prompt: `Representation gallery ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, ratio: [a, b], concrete: `${a} and ${b} counters in labelled equal groups`, visual: `bar, table and double number-line forms for ${a}:${b}`, hints: ["Check labels, order and equal-sized ratio parts.", "Test a second equivalent row or group to see whether both quantities use one factor."], explanation: `${item.answer}. A valid representation preserves labels, order and multiplicative correspondence, even when its visual layout changes.`, tag: "unequal_ratio_parts", repair: "Move between counter groups, equal-part bars, a ratio table and aligned number lines while keeping labels fixed." });
  });
}

function misconceptionCandidates(count) {
  const claims = [
    { key: "additive", claim: "To scale 3:5 to a first part of 9, add 6 to both parts, giving 9:11.", answer: "Reject: 3 is multiplied by 3, so multiply 5 by 3 to get 9:15.", tag: "additive_change" },
    { key: "one-side", claim: "Scaling 4:7 by 2 gives 8:7 because only the first quantity changed.", answer: "Reject: apply the same factor to both linked quantities, giving 8:14.", tag: "one_quantity_only" },
    { key: "reverse", claim: "Red:blue = 2:5 means blue:red is also 2:5.", answer: "Reject: reversing quantity order reverses the ratio to 5:2.", tag: "ratio_order_reversal" },
    { key: "part-whole", claim: "If 2 red and 3 blue counters are shown, red:all is 2:3.", answer: "Reject: red:all is 2:5; 2:3 compares red to blue.", tag: "part_part_vs_part_whole" },
    { key: "unit", claim: "If 4 packs contain 20 cards, one pack contains 20 ÷ 5 because 5 is visible in the answer choices.", answer: "Reject: divide the total 20 by the known 4 packs, so one pack contains 5 cards.", tag: "divides_wrong_quantity" },
    { key: "difference", claim: "Equivalent ratios keep the same difference between their two parts.", answer: "Reject: equivalent ratios keep the same multiplicative relationship, not necessarily the same difference.", tag: "difference_defines_ratio" },
    { key: "units", claim: "A map table can swap centimetres and kilometres between rows without changing the scale.", answer: "Reject: keep quantity labels and units fixed so corresponding values remain comparable.", tag: "unit_label_swap" },
  ];
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 3) % missions.length];
    const item = claims[index % claims.length];
    const retrieval = index % 2 === 1;
    return variant({ id: `misconception-${item.key}-${index + 1}`, format: retrieval ? "scale-build" : "multiple_choice", blueprint: retrieval ? "ratio-review-queue" : "additive-trap-probes", band: retrieval ? "retrieval" : "secure", strand: "misconceptions", mission, prompt: `Mission debrief ${index + 1}: a learner says, '${item.claim}' Which response repairs the reasoning?`, choices: [item.answer, "Accept the claim because both numbers changed somehow.", "Say only that it is wrong without showing a model.", "Choose the largest answer without checking labels."], answer: item.answer, ratio: [2, 3], concrete: "counterexample built with linked counter bundles", visual: "before/after ratio table with multiplier arrows", hints: ["Identify whether the claim uses addition, reverses labels, changes one part or confuses part:part with part:whole.", "Test the corrected rule on one new equivalent pair."], explanation: `${item.answer} The repair restores a multiplicative relationship and keeps quantity order, units and the whole context visible.`, tag: item.tag, repair: "Build the claimed ratio and corrected ratio side by side with counters, then mark corresponding scale factors on both rows." });
  });
}

function variant({ id, format, blueprint, band, strand, mission, prompt, choices, answer, ratio, concrete, visual, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const choiceSet = [...new Set(choices)];
  for (let offset = 1; choiceSet.length < 4; offset += 1) {
    const fallback = typeof answer === "number" ? answer + offset * 10 : `No proportional match ${offset}`;
    if (!choiceSet.includes(fallback)) choiceSet.push(fallback);
  }
  const richExplanation = `${explanation} The result can be checked by simplifying, scaling back or comparing one-unit values.`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotate(choiceSet, fullId.length % choiceSet.length),
      base_ratio: ratio,
      ratio_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_represent_scale_check`,
      variant_blueprint_id: blueprint,
      review_batch: "depth-wave",
      concrete_visual: { concrete, visual, alternatives: ["counter bundles", "equal-part bar", "ratio table", "double number line"], quantity_labels_persistent: true },
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, add_remove_buttons: true, undo_available: true },
      scaffold_options: { one_ratio_row_at_a_time: true, scale_factor_shown_on_both_rows: true, units_attached_to_values: true, multiplication_grid_option: true, worked_unitising_row: true, reduced_symbol_density: true },
      colour_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      mission: { place: mission.place, objective: mission.goal, strategic_unlock: "name the linked quantities, choose a representation, then justify one shared scale factor", reward: `add one ${mission.reward} to the shared expedition plan`, loss_on_error: false, streak_pressure: false, retry_message: "That table revealed a useful ratio clue. Keep the labels, repair one scale step, and continue when ready." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: richExplanation,
    feedback: { correct: `Mission proportion verified. ${richExplanation}`, representation_feedback: "Credit a correct counter, bar, table or double-number-line representation separately from calculation accuracy.", scale_feedback: "Name the multiplicative factor and show it on both linked quantities.", unit_feedback: "Keep quantity labels and units attached through every row.", misconception_repair: repair },
    difficulty: { intro: 2, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "ratio-table" ? "ratio-table-scale" : format === "scale-build" ? "scale-token-duplicate" : "additive-trap-split",
  };
}

function ensureBlueprints(currentPack) {
  const additions = [
    { id: "ratio-language-representations", format: "multiple_choice", count: 300, difficulty_band: "intro", misconception_tag: "ratio_order_reversal", purpose: "Interpret ratio order, part-to-part and part-to-whole language across concrete and visual representations.", generation_pattern: "labelled groups + ratio statement + representation or language choice", review_notes: "Keep labels persistent and do not rely on colour alone.", source: "ai_drafted_teacher_reviewed" },
    { id: "unitising-and-proportion", format: "ratio-table", count: 300, difficulty_band: "secure", misconception_tag: "divides_wrong_quantity", purpose: "Find one-unit values and rescale proportional relationships efficiently.", generation_pattern: "known pair + one-unit row + target row + unit-aware explanation", review_notes: "Use whole-number unit rates in core items and show both divide and multiply stages.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  return {
    ...variant,
    body: {
      ...body,
      ratio_proportion_contract: {
        kind: "ratio_proportion_scale_reasoning",
        strand: body.ratio_strand ?? "ratio_reasoning",
        representation_routes: ["equal_groups", "ratio_table", "double_number_line", "symbolic"],
        response_modes: ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"],
        precision_drag_required: false,
        timed: false,
        preserve_correct_work: true,
        unit_labels_persistent: true,
        shared_scale_factor_check: true,
      },
    },
  };
}

function validateRatioContract(variant) {
  const contract = variant.body?.ratio_proportion_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  const requiredRoutes = ["equal_groups", "ratio_table", "double_number_line", "symbolic"];
  if (!contract || contract.kind !== "ratio_proportion_scale_reasoning" || !contract.strand || contract.precision_drag_required !== false || contract.timed !== false || contract.preserve_correct_work !== true || contract.unit_labels_persistent !== true || contract.shared_scale_factor_check !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode)) || requiredRoutes.some((route) => !contract.representation_routes?.includes(route))) throw new Error(`${variant.id} lacks an accessible ratio/proportion contract.`);
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected three curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  for (const item of currentPack.question_variants) {
    if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}.`);
    ids.add(item.id);
    const signature = `${item.format}|${normalise(item.body?.prompt)}|${normalise(item.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${item.id}.`);
    signatures.add(signature);
    validateRatioContract(item);
  }
  for (const item of generated) {
    const blueprint = blueprints.get(item.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== item.format || blueprint.difficulty_band !== item.body.difficulty_band) throw new Error(`${item.id} does not match its blueprint format and band.`);
    if (!formats.has(item.format) || item.status !== "review") throw new Error(`${item.id} has unsupported format or status.`);
    if (!item.body.concrete_visual?.concrete || !item.body.concrete_visual?.visual || !item.body.concrete_visual?.quantity_labels_persistent) throw new Error(`${item.id} lacks concrete/visual scaffolds.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.scaffold_options?.one_ratio_row_at_a_time || !item.body.scaffold_options?.scale_factor_shown_on_both_rows || !item.body.scaffold_options?.units_attached_to_values || !item.body.scaffold_options?.reduced_symbol_density) throw new Error(`${item.id} lacks SEND scaffolds.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.mission?.loss_on_error !== false || item.body.mission?.streak_pressure !== false || !item.body.mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable mission gamification.`);
    if (!item.feedback?.correct || !item.feedback?.representation_feedback || !item.feedback?.scale_feedback || !item.feedback?.unit_feedback || !item.feedback?.misconception_repair || item.hints.length < 2 || item.explanation.length < 100) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.ratio_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["ratio_language", "equivalent_ratios", "scaling", "recipes_maps", "unitising", "proportion", "missing_values", "representations", "misconceptions"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
