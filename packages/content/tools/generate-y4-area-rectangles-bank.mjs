#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y4-measure-area-rectangles.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y4-area-bank-";
const reviewBatch = "y4-area-rectangles-production-pilot-a";
const pilotAllocation = {
  "inside-vs-edge-prompts": 48,
  "square-unit-fills": 48,
  "rectangle-array-area": 48,
  "rectilinear-decompose": 48,
  "area-retrieval-mix": 48,
};

const cases = [
  areaCase("seed-tray", "seed tray", 2, 3, "square units", [1, 6], 1, 2),
  areaCase("reading-mat", "reading mat", 2, 4, "square units", [1, 8], 2, 1),
  areaCase("mosaic-panel", "mosaic panel", 3, 4, "cm²", [2, 6], 1, 3),
  areaCase("herb-bed", "herb bed", 3, 5, "m²", [1, 15], 2, 2),
  areaCase("display-board", "display board", 3, 6, "cm²", [2, 9], 1, 4),
  areaCase("robot-pad", "robot testing pad", 4, 4, "square units", [2, 8], 2, 2),
  areaCase("art-card", "art card", 4, 5, "cm²", [2, 10], 1, 3),
  areaCase("wildlife-plot", "wildlife survey plot", 4, 6, "m²", [3, 8], 2, 3),
  areaCase("game-board", "tabletop game board", 5, 5, "square units", [1, 25], 1, 4),
  areaCase("stage-floor", "small stage floor", 5, 6, "m²", [3, 10], 2, 2),
  areaCase("workshop-wall", "workshop wall panel", 6, 7, "m²", [3, 14], 1, 5),
  areaCase("festival-banner", "festival banner", 7, 8, "cm²", [4, 14], 2, 4),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y4-measure-area-rectangles") throw new Error("This generator only supports the Year 4 area of rectangles pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const generated = [
  ...insideCandidates(targets["inside-vs-edge-prompts"]),
  ...squareCandidates(targets["square-unit-fills"]),
  ...arrayCandidates(targets["rectangle-array-area"]),
  ...rectilinearCandidates(targets["rectilinear-decompose"]),
  ...retrievalCandidates(targets["area-retrieval-mix"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Audio is not required to understand these spatial models. Use visible dimensions, tactile tiles, concise text or adult/partner reading. Browser TTS is prohibited; any future narration must use a human-reviewed ElevenLabs asset and retain the complete non-audio route.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 4 area pack with a deterministic 240-variant pilot bank and three preserved curated variants. Coverage progresses from inside-versus-edge meaning and counting square units through rectangular arrays, length-times-width reasoning, missing dimensions, comparison and equivalence, simple rectilinear decomposition, units, misconception repair and transfer. Generated variants provide tile, grid, equation, concrete and reduced-load routes; keyboard, switch, touch and non-drag controls; rich feedback; and untimed workshop missions. Audio is unnecessary for generated items, browser TTS is prohibited, and any future ElevenLabs asset requires human review. Independent mathematics, teacher, accessibility, safeguarding and renderer review remain required before promotion.";
validateBank(pack, curated, generated);

console.log(`y4-area-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y4-area-bank blueprints=${allocationSummary(curated, generated)}`);
console.log(`y4-area-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-area-bank bands=${summary(generated, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-area-bank strands=${summary(generated, (variant) => variant.body.area_strand)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-area-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 area bank is out of date; run generate-y4-area-rectangles-bank.mjs --write.");
  console.log("y4-area-bank deterministic check passed");
} else {
  console.log("y4-area-bank dry-run; pass --write to update the pack");
}

function insideCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const area = item.rows * item.columns;
    const perimeter = 2 * (item.rows + item.columns);
    const modes = [
      { id: "meaning", strand: "area_perimeter", stage: "identify_inside_measure", prompt: `A designer wants to cover the inside of the ${item.context}. Which measurement is needed?`, answer: "area", choices: ["area", "perimeter", "length only", "mass"], hints: ["Imagine covering the surface with tiles.", "Area is inside; perimeter follows the boundary."], explanation: `Covering the ${item.context} concerns the flat space inside its boundary, so the required measurement is area rather than perimeter.`, purpose: "inside_area_meaning", misconception: "area_perimeter_confusion", body: { highlighted_region: "inside", boundary_visible: true } },
      { id: "tool", strand: "area_perimeter", stage: "choose_covering_tool", prompt: `The ${item.context} is ${item.rows} by ${item.columns}. Which tool would directly model its area?`, answer: "Equal square tiles covering the inside without gaps or overlaps", choices: ["Equal square tiles covering the inside without gaps or overlaps", "A string placed only around the outside edge", "A balance for measuring mass", "A clock for measuring time"], hints: ["Area is measured by covering a surface.", "Each equal square represents one square unit."], explanation: "Equal square tiles measure covered space directly. Boundary string models perimeter instead and does not account for every square inside.", purpose: "area_tool_selection", misconception: "area_perimeter_confusion", body: { highlighted_region: "inside", suggested_manipulative: "equal_square_tiles" } },
      { id: "unit", strand: "units", stage: "select_square_unit", prompt: `The ${item.context} covers ${area} ${item.unit}. Which unit type correctly reports area?`, answer: item.unit, choices: unitChoices(item.unit), hints: ["Area counts two-dimensional square regions.", "A plain length unit measures one direction only."], explanation: `${item.unit} is an area unit because it describes equal squares covering the ${item.context}; a plain length unit would not describe covered space.`, purpose: "area_unit_selection", misconception: "uses_linear_units_for_area", body: { area, unit: item.unit } },
      { id: "trap", strand: "misconceptions", stage: "repair_edge_count", prompt: `A learner says the ${item.rows}-by-${item.columns} ${item.context} has area ${perimeter} because they counted around its edge. What should they do?`, answer: `Count all ${area} square units inside, or calculate ${item.rows} × ${item.columns}`, choices: [`Count all ${area} square units inside, or calculate ${item.rows} × ${item.columns}`, `Keep ${perimeter} because every edge count is an area`, `Add only ${item.rows} + ${item.columns}`, "Count the grid lines instead of the spaces"], hints: ["The edge count answers a perimeter question.", "Area includes every square in every row."], explanation: `The learner measured the boundary. Area is the ${area} square units inside, found from ${item.rows} equal rows of ${item.columns}.`, purpose: "edge_count_misconception_repair", misconception: "area_perimeter_confusion", body: { rows: item.rows, columns: item.columns, area, perimeter } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `inside-${item.id}-${mode.id}`, item, format: "tap-choice", blueprint: "inside-vs-edge-prompts" }));
  }
  return variants.slice(0, count);
}

function squareCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const area = item.rows * item.columns;
    const modes = [
      { id: "count", strand: "counting_squares", stage: "count_complete_square_grid", prompt: `A ${item.context} grid has ${item.rows} rows and ${item.columns} columns of equal squares. How many square units cover it?`, answer: area, choices: numericChoices(area, [item.rows + item.columns, (item.rows + 1) * (item.columns + 1), 2 * (item.rows + item.columns)]), hints: ["Count square spaces, not the grid lines.", `Count ${item.columns} squares in each of ${item.rows} rows.`], explanation: `There are ${item.rows} complete rows with ${item.columns} square units in each row, so the grid covers ${area} square units.`, purpose: "complete_square_count", misconception: "counts_grid_lines", body: gridBody(item) },
      { id: "rows", strand: "arrays", stage: "connect_rows_to_repeated_addition", prompt: `Which repeated addition matches the tiled ${item.rows}-by-${item.columns} ${item.context}?`, answer: repeated(item.columns, item.rows), choices: [repeated(item.columns, item.rows), repeated(item.rows, item.columns + 1), `${item.rows} + ${item.columns}`, `${item.rows} + ${item.columns} + 1`], hints: ["Each row contains the same number of tiles.", `Repeat ${item.columns} once for each of the ${item.rows} rows.`], explanation: `${item.rows} equal rows of ${item.columns} are represented by ${repeated(item.columns, item.rows)}, which totals ${area} square units.`, purpose: "array_repeated_addition", misconception: "counts_one_row_and_one_column", body: gridBody(item) },
      { id: "lines", strand: "misconceptions", stage: "repair_grid_line_count", prompt: `The ${item.context} shows ${item.rows + 1} horizontal grid lines and ${item.columns + 1} vertical grid lines. How is its area found?`, answer: `Count the ${area} square spaces between the lines`, choices: [`Count the ${area} square spaces between the lines`, `Multiply ${item.rows + 1} by ${item.columns + 1} because lines are square units`, `Add all ${item.rows + item.columns + 2} grid lines`, "Count only the corner points"], hints: ["Grid lines divide the surface; they are not tiles.", `Look for ${item.rows} rows of square spaces.`], explanation: `The lines mark tile boundaries. The measurable area is formed by ${item.rows} × ${item.columns} = ${area} square spaces between them.`, purpose: "grid_lines_misconception_repair", misconception: "counts_grid_lines", body: { ...gridBody(item), horizontal_grid_lines: item.rows + 1, vertical_grid_lines: item.columns + 1 } },
      { id: "tile", strand: "tiling", stage: "verify_complete_tiling", prompt: `Which tiling proves the ${item.context} has area ${area} ${item.unit}?`, answer: `${area} equal square tiles cover the whole surface once, with no gaps or overlaps`, choices: [`${area} equal square tiles cover the whole surface once, with no gaps or overlaps`, `${area} tiles overlap in one corner`, `${area - 1} tiles leave one square gap`, "Different-sized tiles are counted as if each were one square unit"], hints: ["Every part of the surface must be covered exactly once.", "Equal units make the count meaningful."], explanation: `A valid area measure uses equal square units and covers the complete surface exactly once, so ${area} tiles demonstrate ${area} ${item.unit}.`, purpose: "complete_tiling_check", misconception: "gaps_or_overlaps_in_tiling", body: { ...gridBody(item), complete_cover: true, gaps: 0, overlaps: 0 } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `square-${item.id}-${mode.id}`, item, format: "grid-fill", blueprint: "square-unit-fills" }));
  }
  return variants.slice(0, count);
}

function arrayCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const area = item.rows * item.columns;
    const equivalentArea = item.equivalent[0] * item.equivalent[1];
    const modes = [
      { id: "multiply", strand: "length_width", stage: "use_length_times_width", prompt: `The ${item.context} is ${item.rows} units by ${item.columns} units. Which calculation gives its area?`, answer: `${item.rows} × ${item.columns} = ${area}`, choices: [`${item.rows} × ${item.columns} = ${area}`, `${item.rows} + ${item.columns} = ${item.rows + item.columns}`, `${item.rows} × 2 + ${item.columns} × 2 = ${2 * (item.rows + item.columns)}`, `${area} + ${item.rows} = ${area + item.rows}`], hints: ["A rectangle is an array of equal square units.", "Multiply the number of rows by the squares in each row."], explanation: `${item.rows} rows of ${item.columns} square units form the complete array, so length × width gives ${item.rows} × ${item.columns} = ${area}.`, purpose: "rectangle_area_multiplication", misconception: "length_plus_width", body: gridBody(item) },
      { id: "missing", strand: "missing_dimensions", stage: "find_missing_dimension", prompt: `A rectangular ${item.context} has area ${area} ${item.unit} and ${item.rows} equal rows. How many square units are in each row?`, answer: item.columns, choices: numericChoices(item.columns, [item.rows, item.rows + item.columns, area - item.rows]), hints: [`Share ${area} square units equally across ${item.rows} rows.`, "Use the inverse of multiplication."], explanation: `${area} ÷ ${item.rows} = ${item.columns}, so each row has ${item.columns} square units and the missing dimension is ${item.columns} units.`, purpose: "missing_rectangle_dimension", misconception: "adds_to_find_missing_dimension", body: { area, known_dimension: item.rows, missing_dimension: item.columns, inverse_calculation: `${area} ÷ ${item.rows}` } },
      { id: "turn", strand: "equivalence", stage: "reason_with_commutativity", prompt: `The ${item.rows}-by-${item.columns} ${item.context} is turned so it is ${item.columns} by ${item.rows}. What happens to its area?`, answer: `It stays ${area} ${item.unit} because ${item.rows} × ${item.columns} = ${item.columns} × ${item.rows}`, choices: [`It stays ${area} ${item.unit} because ${item.rows} × ${item.columns} = ${item.columns} × ${item.rows}`, `It doubles to ${area * 2} ${item.unit}`, `It becomes ${item.rows + item.columns} ${item.unit}`, "It cannot have an area after being turned"], hints: ["Turning does not add or remove square tiles.", "Multiplication is commutative."], explanation: `The same ${area} square units are rearranged. Swapping rows and columns changes orientation but not the product or covered area.`, purpose: "commutative_area_equivalence", misconception: "orientation_changes_area", body: { original_dimensions: [item.rows, item.columns], turned_dimensions: [item.columns, item.rows], area } },
      { id: "equivalent", strand: "comparison_equivalence", stage: "compare_equal_area_rectangles", prompt: `Compare a ${item.rows}-by-${item.columns} rectangle with a ${item.equivalent[0]}-by-${item.equivalent[1]} rectangle. Which statement is true?`, answer: `They have equal area: ${area} ${item.unit}`, choices: [`They have equal area: ${area} ${item.unit}`, `The first is larger because ${item.columns} is larger than ${item.equivalent[0]}`, "They must have equal perimeter as well as equal area", `Their areas differ by ${Math.abs(item.columns - item.equivalent[0])}`], hints: ["Calculate both rectangular arrays.", "Equal area does not require matching side lengths or perimeter."], explanation: `${item.rows} × ${item.columns} = ${area} and ${item.equivalent[0]} × ${item.equivalent[1]} = ${equivalentArea}, so the rectangles cover equal areas even though their dimensions differ.`, purpose: "equal_area_different_dimensions", misconception: "longer_side_means_larger_area", body: { rectangle_a: [item.rows, item.columns], rectangle_b: item.equivalent, area_a: area, area_b: equivalentArea } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `array-${item.id}-${mode.id}`, item, format: "array-build", blueprint: "rectangle-array-area" }));
  }
  return variants.slice(0, count);
}

function rectilinearCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const main = item.rows * item.columns;
    const extension = item.extensionRows * item.extensionColumns;
    const total = main + extension;
    const outerRows = item.rows + item.extensionRows;
    const outerColumns = item.columns;
    const outer = outerRows * outerColumns;
    const missing = outer - total;
    const modes = [
      { id: "add", strand: "rectilinear", stage: "decompose_and_add_rectangles", prompt: `An L-shaped ${item.context} splits without overlap into a ${item.rows}-by-${item.columns} rectangle and a ${item.extensionRows}-by-${item.extensionColumns} rectangle. What is its total area?`, answer: total, choices: numericChoices(total, [main, extension, main + item.extensionRows + item.extensionColumns]), hints: ["Find each rectangular area separately.", `Add ${main} and ${extension}; the regions do not overlap.`], explanation: `The two non-overlapping rectangles cover ${main} and ${extension} square units. Adding them gives a total area of ${total} square units.`, purpose: "rectilinear_additive_decomposition", misconception: "adds_side_lengths_instead_of_areas", body: compoundBody(item, main, extension, total) },
      { id: "subtract", strand: "rectilinear", stage: "subtract_missing_rectangle", prompt: `The same L-shape fits inside a ${outerRows}-by-${outerColumns} outer rectangle of area ${outer}. A rectangular corner of area ${missing} is missing. What area remains?`, answer: total, choices: numericChoices(total, [outer, missing, outer + missing]), hints: ["Start with the complete outer rectangle.", `Subtract the missing ${missing} square units once.`], explanation: `The complete outer rectangle covers ${outer} square units. Removing the ${missing}-square-unit corner leaves ${outer} − ${missing} = ${total}.`, purpose: "rectilinear_subtractive_decomposition", misconception: "includes_missing_corner", body: { ...compoundBody(item, main, extension, total), outer_rectangle: [outerRows, outerColumns], outer_area: outer, missing_corner_area: missing } },
      { id: "prove", strand: "reasoning", stage: "prove_decompositions_equivalent", prompt: `Two learners find the L-shaped ${item.context} area. One adds ${main} + ${extension}; the other calculates ${outer} − ${missing}. Which judgement is correct?`, answer: `Both methods are correct because both give ${total} square units`, choices: [`Both methods are correct because both give ${total} square units`, "Only addition can ever find a rectilinear area", "Only subtraction can ever find a rectilinear area", `The answers differ because ${main} and ${outer} are different`], hints: ["Evaluate both complete calculations.", "Different valid partitions can preserve the same covered region."], explanation: `${main} + ${extension} = ${total}, and ${outer} − ${missing} = ${total}. Both methods account for every covered square exactly once.`, purpose: "equivalent_decomposition_reasoning", misconception: "different_split_changes_area", body: { ...compoundBody(item, main, extension, total), addition_method: [main, extension], subtraction_method: [outer, missing] } },
      { id: "transfer", strand: "transfer", stage: "transfer_rectilinear_strategy", prompt: `A plan of the ${item.context} is redrawn with a different split line but the boundary and square grid stay fixed. What should the area strategy preserve?`, answer: "Cover every inside square exactly once, then add the non-overlapping rectangular parts", choices: ["Cover every inside square exactly once, then add the non-overlapping rectangular parts", "Count the split line as an extra row of area", "Add every labelled side length", "Change the answer whenever the split line moves"], hints: ["A helper line does not add covered space.", "Check for gaps and overlaps between parts."], explanation: `A decomposition is only a calculation aid. Moving its split line cannot change the fixed region, provided every square is included once with no overlap.`, purpose: "decomposition_strategy_transfer", misconception: "split_line_changes_area", body: { ...compoundBody(item, main, extension, total), alternate_split_allowed: true } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `rectilinear-${item.id}-${mode.id}`, item, format: "grid-fill", blueprint: "rectilinear-decompose" }));
  }
  return variants.slice(0, count);
}

function retrievalCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const area = item.rows * item.columns;
    const compareRows = item.rows + 1;
    const compareColumns = Math.max(1, item.columns - 1);
    const compareArea = compareRows * compareColumns;
    const relation = area === compareArea ? "the same area as" : area > compareArea ? "a larger area than" : "a smaller area than";
    const modes = [
      { id: "compare", strand: "comparison_equivalence", stage: "retrieve_area_comparison", prompt: `Compare the ${item.rows}-by-${item.columns} ${item.context} with a ${compareRows}-by-${compareColumns} rectangle. The first rectangle has...`, answer: `${relation} the second rectangle`, choices: [`${relation} the second rectangle`, ...["a larger area than the second rectangle", "a smaller area than the second rectangle", "the same area as the second rectangle"].filter((choice) => choice !== `${relation} the second rectangle`), "an area that cannot be compared"], hints: ["Find both products before comparing.", `${item.rows} × ${item.columns} = ${area}; ${compareRows} × ${compareColumns} = ${compareArea}.`], explanation: `The first area is ${area} square units and the second is ${compareArea} square units, so the first has ${relation} the second.`, purpose: "area_comparison_retrieval", misconception: "compares_one_dimension_only", body: { rectangle_a: [item.rows, item.columns], rectangle_b: [compareRows, compareColumns], area_a: area, area_b: compareArea } },
      { id: "fact", strand: "length_width", stage: "retrieve_rectangle_area_fact", prompt: `Workshop recall: what is the area of the ${item.rows}-by-${item.columns} ${item.context}?`, answer: area, choices: numericChoices(area, [item.rows + item.columns, 2 * (item.rows + item.columns), (item.rows + 1) * item.columns]), hints: ["Think of equal rows of square units.", `Use ${item.rows} × ${item.columns}.`], explanation: `${item.rows} equal rows of ${item.columns} square units make ${area} ${item.unit}; the answer is an area, not a boundary length.`, purpose: "rectangle_area_retrieval", misconception: "length_plus_width", body: gridBody(item) },
      { id: "repair", strand: "misconceptions", stage: "retrieve_misconception_check", prompt: `Which check best protects an area calculation for the ${item.context} from common mistakes?`, answer: "Confirm the inside is covered by equal squares and multiply rows by columns", choices: ["Confirm the inside is covered by equal squares and multiply rows by columns", "Count grid lines and add the two dimensions", "Trace only the outside boundary", "Write a plain length unit for the answer"], hints: ["Check what is measured and which unit represents it.", "Rows × columns counts every inside square once."], explanation: "This check combines the meaning of area, complete square coverage, rectangular array structure and an appropriate square unit.", purpose: "integrated_area_misconception_check", misconception: "mixed_area_misconceptions", body: gridBody(item) },
      { id: "transfer", strand: "transfer", stage: "retrieve_area_transfer", prompt: `A new rectangular design has the same ${area} square tiles as the ${item.context}, rearranged into ${item.equivalent[0]} equal rows. How many tiles are in each row?`, answer: item.equivalent[1], choices: numericChoices(item.equivalent[1], [item.equivalent[0], item.equivalent[0] + item.equivalent[1], area - item.equivalent[0]]), hints: ["Rearranging tiles preserves their total number.", `Calculate ${area} ÷ ${item.equivalent[0]}.`], explanation: `${area} square tiles shared equally into ${item.equivalent[0]} rows gives ${item.equivalent[1]} in each row, transferring area knowledge to a new rectangle.`, purpose: "area_factor_pair_transfer", misconception: "rearrangement_changes_area", body: { original_dimensions: [item.rows, item.columns], new_rows: item.equivalent[0], new_columns: item.equivalent[1], area } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `retrieval-${item.id}-${mode.id}`, item, format: "tap-choice", blueprint: "area-retrieval-mix", retrieval: true }));
  }
  return variants.slice(0, count);
}

function makeVariant({ id, item, format, blueprint, strand, stage, prompt, answer, choices, hints, explanation, purpose, misconception, body, retrieval = false }) {
  const fullId = `${prefix}${id}`;
  const band = bandFor(blueprint, stage);
  const cleanChoices = uniqueByJSON(choices);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotate(cleanChoices, fullId.length % cleanChoices.length),
      ...body,
      context: item.context,
      area_strand: strand,
      coverage_tags: coverageFor(strand, stage),
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tile_buttons_keyboard_switch_touch_numeric_or_partner_recorded",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, tile_add_remove_buttons: true, numeric_entry: true, partner_recording: true, drag_required: false, undo_available: true, confirm_before_submit: true },
      manipulative_routes: { virtual: "equal square tiles with add, remove, row-highlight and fill-all buttons", concrete: "adult-prepared square tiles on a bordered grid mat", drawn: "squared paper with rows, columns and non-overlapping regions labelled", symbolic: "rows × columns or sum/subtraction of rectangular areas" },
      send_routes: { visual: "high-contrast square spaces, patterned row bands and persistent dimension labels; colour is never required", concrete: "large tactile square tiles and raised boundary or Wikki Stix outline", text: "short numbered dimensions, area table and calculation sentence", oral: "adult or partner reads dimensions and records the learner's explanation" },
      reduced_visual_load: true,
      one_decision_per_screen: true,
      reduced_load_alternative: "show one rectangle or one decomposed region at a time with all decorative scenery removed",
      reduced_motion_alternative: "instant static tile fill and side-by-side before/after diagrams",
      audio_support: { required: false, pedagogical_decision: "The spatial and numerical evidence is fully available visually, concretely and in text; generated audio is unnecessary.", browser_tts_allowed: false, future_asset_policy: "Only a human-reviewed ElevenLabs asset may be added, with the complete non-audio route retained." },
      mission: missionFor(strand, stage, fullId),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
      review_interval_days: retrieval ? [1, 3, 7, 14, 30][fullId.length % 5] : undefined,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: `Workshop plan verified: ${purpose.replaceAll("_", " ")}.`, repair: repairFor(strand, stage), model_check: "Show where every square unit is counted once, then connect the model to the calculation.", unit_check: "State whether the question measures inside space or boundary length and attach an appropriate square unit to area.", misconception_check: misconceptionFeedback(misconception), retry: "The workshop keeps every correct tile and dimension. Repair one step with no timer, lives or penalty." },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(strand, stage, id) {
  const stations = { area_perimeter: "Inside-or-Edge Gate", units: "Square-Unit Store", counting_squares: "Tile Count Bench", arrays: "Equal-Row Rig", tiling: "No-Gap Floor Bay", length_width: "Dimension Engine", missing_dimensions: "Missing-Side Console", equivalence: "Turn-and-Match Table", comparison_equivalence: "Design Comparison Desk", rectilinear: "L-Shape Planning Board", reasoning: "Proof Inspector's Desk", transfer: "New Blueprint Dock", misconceptions: "Measurement Repair Bay" };
  const tools = { area_perimeter: "identify inside space before choosing a measure", units: "match a two-dimensional region to square units", counting_squares: "count square spaces in equal rows", arrays: "connect repeated rows to multiplication", tiling: "cover every part once without gaps or overlaps", length_width: "multiply perpendicular dimensions", missing_dimensions: "use division as the inverse of area multiplication", equivalence: "preserve the tile total when dimensions swap", comparison_equivalence: "calculate both areas before comparing", rectilinear: "split into non-overlapping rectangles or subtract one missing corner", reasoning: "prove every covered square is included exactly once", transfer: "carry the square-unit and factor-pair strategy to a new design", misconceptions: "separate inside area, outside perimeter, grid lines and square spaces" };
  return { campaign: "The Quiet Canopy Workshop: Build the Community Map", station: stations[strand], mission_code: id.slice(-30), objective: `Complete the ${stage.replaceAll("_", " ")} blueprint check.`, strategic_tool: tools[strand], build_protocol: ["identify the covered region", "choose equal square units", "organise rows, columns or rectangles", "calculate and check the unit"], reward: { item: "private blueprint stamp", earned_for: "using a model, explaining a strategy or repairing a misconception", effect: "adds one design to the workshop map without increasing speed or difficulty" }, retry_protocol: "No lives, stamps or progress are lost; correct tiles remain in place while one targeted model clue appears." };
}

function validateBank(packData, curatedItems, generatedItems) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 3) throw new Error(`Expected three curated variants, found ${curatedItems.length}.`);
  if (generatedItems.length !== pilot - curatedItems.length || curatedItems.length + generatedItems.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set(); const coverage = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of [...curatedItems, ...generatedItems]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
  }
  for (const variant of generatedItems) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || uniqueByJSON(variant.body.choices).length !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || !variant.body.interaction_support?.tile_add_remove_buttons || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.manipulative_routes?.virtual || !variant.body.manipulative_routes?.concrete || !variant.body.send_routes?.visual || !variant.body.send_routes?.concrete || !variant.body.send_routes?.text || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks manipulative or SEND routes.`);
    if (variant.body.audio_support?.browser_tts_allowed !== false || variant.body.audio_support?.required !== false || /ElevenLabs/.test(variant.body.audio_asset_id ?? "")) throw new Error(`${variant.id} violates the no-browser-TTS audio decision.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.mission?.retry_protocol) || !variant.body.mission?.strategic_tool) throw new Error(`${variant.id} lacks pressure-free missions.`);
    if (!variant.feedback?.repair || !variant.feedback?.model_check || !variant.feedback?.unit_check || !variant.feedback?.misconception_check || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks rich feedback.`);
    validateAreaData(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generatedItems);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("area coverage", new Set(["area_perimeter", "counting_squares", "arrays", "length_width", "missing_dimensions", "comparison_equivalence", "rectilinear", "units", "misconceptions", "reasoning", "transfer", "tiling"]), coverage);
}

function validateAreaData(variant) {
  const body = variant.body;
  if (body.rows && body.columns && body.area && body.rows * body.columns !== body.area) throw new Error(`${variant.id} has inconsistent rectangle dimensions.`);
  if (body.component_areas && body.total_area !== body.component_areas.reduce((sum, value) => sum + value, 0)) throw new Error(`${variant.id} has inconsistent rectilinear components.`);
  if (body.rectangle_a && body.area_a && body.rectangle_a[0] * body.rectangle_a[1] !== body.area_a) throw new Error(`${variant.id} has an inconsistent comparison rectangle A.`);
  if (body.rectangle_b && body.area_b && body.rectangle_b[0] * body.rectangle_b[1] !== body.area_b) throw new Error(`${variant.id} has an inconsistent comparison rectangle B.`);
}

function areaCase(id, context, rows, columns, unit, equivalent, extensionRows, extensionColumns) { return { id, context, rows, columns, unit, equivalent, extensionRows, extensionColumns }; }
function gridBody(item) { return { rows: item.rows, columns: item.columns, area: item.rows * item.columns, unit: item.unit, square_spaces: item.rows * item.columns, equal_square_units: true }; }
function compoundBody(item, main, extension, total) { return { shape: "simple_L_shape", components: [[item.rows, item.columns], [item.extensionRows, item.extensionColumns]], component_areas: [main, extension], total_area: total, overlap: 0, square_grid_available: true }; }
function unitChoices(answer) { return uniqueByJSON([answer, answer === "cm²" ? "cm" : answer === "m²" ? "m" : "units", "perimeter units", "cubic units", "minutes"]).slice(0, 4); }
function numericChoices(answer, distractors) { const values = uniqueByJSON([answer, ...distractors]); for (let offset = 1; values.length < 4; offset += 1) if (!values.includes(answer + offset)) values.push(answer + offset); return values.slice(0, 4); }
function repeated(value, times) { return Array.from({ length: times }, () => value).join(" + "); }
function coverageFor(strand, stage) { const tags = new Set([strand]); if (["counting_squares", "arrays", "tiling"].includes(strand)) tags.add("counting_squares"); if (stage.includes("dimension") || strand === "length_width") tags.add("length_width"); if (stage.includes("compare") || stage.includes("equivalent") || strand === "comparison_equivalence" || strand === "equivalence") tags.add("comparison_equivalence"); if (stage.includes("rectilinear") || stage.includes("decompos") || strand === "rectilinear") tags.add("rectilinear"); if (stage.includes("repair") || strand === "misconceptions") tags.add("misconceptions"); if (stage.includes("reason") || stage.includes("prove") || strand === "reasoning") tags.add("reasoning"); if (stage.includes("transfer") || strand === "transfer") tags.add("transfer"); return [...tags]; }
function bandFor(blueprint, stage) { if (blueprint === "inside-vs-edge-prompts") return stage.includes("repair") ? "developing" : "intro"; if (blueprint === "square-unit-fills") return stage.includes("repair") || stage.includes("verify") ? "expected" : "developing"; if (blueprint === "rectangle-array-area") return stage.includes("missing") || stage.includes("compare") ? "secure" : "expected"; if (blueprint === "rectilinear-decompose") return stage.includes("prove") || stage.includes("transfer") ? "stretch" : "secure"; return "retrieval"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function repairFor(strand, stage) { if (strand === "area_perimeter" || strand === "misconceptions") return "Name whether the question asks about inside space or the outside boundary, then count square spaces rather than lines."; if (strand === "units") return "Match the measure to two-dimensional square units and keep the unit attached to the answer."; if (["counting_squares", "arrays", "tiling"].includes(strand)) return "Build one complete row, repeat equal rows, and check that every square is covered once without gaps or overlaps."; if (strand === "missing_dimensions") return "Use the known area as the total tile count and divide it equally by the known dimension."; if (["equivalence", "comparison_equivalence"].includes(strand)) return "Calculate both areas before comparing; do not decide from one side length or orientation."; if (strand === "rectilinear" || strand === "reasoning" || stage.includes("decompos")) return "Mark non-overlapping rectangles, calculate each area, and verify that every inside square is included exactly once."; return "Return to equal square units, organise them into a rectangular array, and connect the model to multiplication or division."; }
function misconceptionFeedback(tag) { return ({ area_perimeter_confusion: "Area covers inside space; perimeter follows the outside edge.", uses_linear_units_for_area: "Area needs square units because it measures a two-dimensional surface.", counts_grid_lines: "Count square spaces between grid lines, not the lines themselves.", counts_one_row_and_one_column: "One row plus one column misses most inside squares; repeat every complete row.", gaps_or_overlaps_in_tiling: "A valid tiling covers each part exactly once with equal square units.", length_plus_width: "Length plus width does not count all rows; multiply the perpendicular dimensions.", adds_to_find_missing_dimension: "Use division because area is the product and one factor is missing.", orientation_changes_area: "Turning preserves the same tiles and therefore the same area.", longer_side_means_larger_area: "One longer side cannot determine area; compare both products.", adds_side_lengths_instead_of_areas: "For a compound shape, calculate and combine rectangular areas, not side lengths.", includes_missing_corner: "Subtract the uncovered corner from the complete outer rectangle.", different_split_changes_area: "A valid new split preserves the same covered region and total area.", split_line_changes_area: "A helper line reorganises the calculation but adds no square units.", compares_one_dimension_only: "Area comparison requires both dimensions or a complete square count.", mixed_area_misconceptions: "Check inside versus edge, square spaces versus lines, multiplication and square units.", rearrangement_changes_area: "Rearranging the same number of equal tiles preserves area." })[tag] ?? "Use the square-unit model to identify and repair the first incorrect step."; }
function animationFor(strand) { return ({ area_perimeter: "inside-edge-tool-toggle", units: "square-unit-label-lock", counting_squares: "calm-row-count-highlight", arrays: "equal-row-array-build", tiling: "no-gap-tile-check", length_width: "dimension-product-overlay", missing_dimensions: "missing-side-array-reveal", equivalence: "rectangle-turn-preserve", comparison_equivalence: "area-design-compare", rectilinear: "l-shape-split-static", reasoning: "decomposition-proof-overlay", transfer: "blueprint-factor-pair-build", misconceptions: "area-error-repair" })[strand]; }
function curatedBlueprint(variant) { const map = { "ma-y4-measure-area-rectangles-q-4-by-5": "rectangle-array-area", "ma-y4-measure-area-rectangles-q-area-not-perimeter": "inside-vs-edge-prompts", "ma-y4-measure-area-rectangles-q-grid-lines": "square-unit-fills" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generatedItems) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generatedItems) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generatedItems) { return Object.entries(combinedAllocation(curatedItems, generatedItems)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function uniqueByJSON(items) { const seen = new Set(); return items.filter((item) => { const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; }); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
