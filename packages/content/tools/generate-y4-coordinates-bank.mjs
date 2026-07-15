#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y4-coordinates.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y4-coordinates-bank-";
const reviewBatch = "y4-coordinates-depth-pilot-a";
const gridMax = 12;
const pilotAllocation = {
  "origin-and-axis-traces": 52,
  "plot-ordered-pairs": 52,
  "read-plotted-points": 52,
  "translation-arrow-routes": 52,
  "complete-first-quadrant-polygons": 52,
};

const points = [[1, 2], [2, 5], [3, 1], [4, 6], [5, 3], [6, 7], [7, 2], [8, 5], [9, 4], [10, 8], [11, 6], [12, 9], [2, 10], [4, 11], [6, 12], [0, 7], [9, 0]];
const translationCases = [
  [[2, 2], 3, 2], [[5, 3], -2, 4], [[7, 2], 4, 3], [[9, 5], -3, -2], [[3, 7], 5, -3], [[8, 8], -4, 2],
  [[1, 4], 6, 1], [[10, 3], -5, 4], [[4, 9], 3, -5], [[6, 6], 2, 3], [[11, 7], -4, -3], [[5, 10], 4, -6],
  [[2, 8], 7, 2], [[9, 9], -6, 1], [[4, 4], 5, 5], [[7, 10], -3, -7], [[10, 10], -8, -4],
].map(([start, dx, dy]) => ({ start, dx, dy, end: [start[0] + dx, start[1] + dy] }));

const rectangles = [
  [1, 1, 4, 3], [2, 2, 6, 5], [3, 1, 8, 4], [1, 5, 5, 8], [4, 3, 9, 7], [6, 1, 10, 6],
  [2, 7, 7, 10], [5, 5, 11, 9], [7, 2, 12, 5], [1, 2, 3, 9], [3, 6, 8, 12], [8, 6, 12, 11],
  [0, 1, 4, 4], [2, 0, 6, 3], [5, 2, 9, 10], [1, 8, 4, 12], [7, 7, 11, 12],
].map(([x1, y1, x2, y2], index) => ({ id: index + 1, x1, y1, x2, y2, known: [[x1, y1], [x2, y1], [x1, y2]], missing: [x2, y2] }));

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y4-coordinates") throw new Error("This generator only supports the Year 4 coordinates pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...originCandidates(targets["origin-and-axis-traces"]),
  ...plotCandidates(targets["plot-ordered-pairs"]),
  ...readCandidates(targets["read-plotted-points"]),
  ...translationCandidates(targets["translation-arrow-routes"]),
  ...polygonCandidates(targets["complete-first-quadrant-polygons"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 4 coordinates pack with a deterministic 260-item pilot bank and five preserved curated variants. The bank progresses through origin and axis conventions, first-quadrant plotting and reading, horizontal and vertical translations, shape vertices, missing coordinates, reasoning and named misconception repair. Generated candidates include SEND grid, visual, concrete and text-table routes, supported non-drag interactions, rich feedback and untimed strategic map missions. Independent mathematics, teacher, accessibility, safeguarding and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y4-coordinates-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y4-coordinates-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y4-coordinates-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-coordinates-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-coordinates-bank strands=${summary(candidates, (variant) => variant.body.coordinate_strand)}`);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-coordinates-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 coordinates bank is out of date; run generate-y4-coordinates-bank.mjs --write.");
  console.log("y4-coordinates-bank deterministic check passed");
} else {
  console.log("y4-coordinates-bank dry-run; pass --write to update the pack");
}

function originCandidates(count) {
  const variants = [];
  for (const [x, y] of points) {
    const coordinate = coord(x, y);
    const route = `${x} across on x, then ${y} up on y`;
    variants.push(makeVariant({ id: `origin-${x}-${y}`, format: "tap-choice", blueprint: "origin-and-axis-traces", strand: "origin_and_axes", stage: "trace_from_origin", prompt: `From the origin, which route reaches ${coordinate}?`, answer: route, choices: [route, `${y} across on x, then ${x} up on y`, `${x + 1} across and ${y + 1} up`, `start at (1, 1), then move ${x} and ${y}`], hints: ["Start at (0, 0), not (1, 1).", "Read x across first, then y up."], explanation: `${coordinate} is reached by starting at the origin, moving ${x} units across on the x-axis and then ${y} units up on the y-axis.`, purpose: "origin_to_coordinate_trace", misconception: "starts_counting_at_one", body: { grid: grid(), target: [x, y], route: { x_first: x, y_second: y } } }));
    variants.push(makeVariant({ id: `axis-order-${x}-${y}`, format: "tap-choice", blueprint: "origin-and-axis-traces", strand: "axis_order", stage: "apply_x_then_y_order", prompt: `A marker is ${x} across and ${y} up. Which ordered pair names it?`, answer: coordinate, choices: coordinateChoices(x, y), hints: ["The first number is x: across.", "The second number is y: up."], explanation: `${x} across gives x = ${x} and ${y} up gives y = ${y}, so the coordinate is ${coordinate}.`, purpose: "across_then_up_order", misconception: "reverses_x_y_order", body: { grid: grid(), target: [x, y] } }));
    variants.push(makeVariant({ id: `counting-${x}-${y}`, format: "tap-choice", blueprint: "origin-and-axis-traces", strand: "misconceptions", stage: "repair_off_by_one_counting", prompt: `Which instruction avoids an off-by-one error when tracing to ${coordinate}?`, answer: "Count unit jumps from 0 on each axis, not the number of labels touched", choices: ["Count unit jumps from 0 on each axis, not the number of labels touched", "Call the origin 1 before moving", "Count y first because it is vertical", "Skip the zero line on both axes"], hints: ["The origin is (0, 0).", "Measure spaces or unit jumps between grid lines."], explanation: "Coordinates measure displacement from zero. Counting unit jumps from the origin prevents placing the point one square too far. ", purpose: "origin_counting_misconception_repair", misconception: "starts_counting_at_one", body: { grid: grid(), target: [x, y], origin: [0, 0] } }));
  }
  return variants.slice(0, count);
}

function plotCandidates(count) {
  const variants = [];
  for (let index = 0; index < points.length; index += 1) {
    const [x, y] = points[index];
    const target = [x, y];
    const guideX = (x + 3) % (gridMax + 1);
    variants.push(makeVariant({ id: `plot-${x}-${y}`, format: "coordinate-plot", blueprint: "plot-ordered-pairs", strand: "plotting", stage: "plot_ordered_pair", prompt: `Plot ${coord(x, y)} on the first-quadrant grid.`, answer: target, choices: coordinateArrayChoices(x, y), hints: ["Begin at the origin.", `Move to x = ${x}, then up to y = ${y}.`], explanation: `${coord(x, y)} places the point where the vertical guide from x = ${x} meets the horizontal guide from y = ${y}.`, purpose: "ordered_pair_plot", misconception: "reverses_x_y_order", body: { grid: grid(), target, direct_coordinate_entry: true } }));
    variants.push(makeVariant({ id: `plot-swap-${x}-${y}`, format: "coordinate-plot", blueprint: "plot-ordered-pairs", strand: "plotting", stage: "distinguish_swapped_pairs", prompt: `Which candidate point is ${coord(x, y)}, not ${coord(y, x)}?`, answer: target, choices: coordinateArrayChoices(x, y), hints: [`Locate x = ${x} on the horizontal axis first.`, `Only then move to y = ${y}.`], explanation: `Changing the order changes the location. ${coord(x, y)} means ${x} across then ${y} up.`, purpose: "swapped_coordinate_plot", misconception: "reverses_x_y_order", body: { grid: grid(), target, swapped_point: [y, x], candidate_points: coordinateArrayChoices(x, y) } }));
    variants.push(makeVariant({ id: `plot-missing-${x}-${y}`, format: "coordinate-plot", blueprint: "plot-ordered-pairs", strand: "missing_coordinates", stage: "combine_x_and_y_guides", prompt: `Point P has x = ${x}. It lies on the same horizontal line as Q at ${coord(guideX, y)}. Plot P.`, answer: target, choices: coordinateArrayChoices(x, y), hints: [`P must stay on the vertical line x = ${x}.`, `Sharing Q's horizontal line gives y = ${y}.`], explanation: `The x clue gives ${x}; Q's horizontal line gives y = ${y}. Combining them places P at ${coord(x, y)}.`, purpose: "missing_coordinate_from_guides", misconception: "matches_one_coordinate_only", body: { grid: grid(), target, x_clue: x, horizontal_guide_point: [guideX, y] } }));
  }
  return variants.slice(0, count);
}

function readCandidates(count) {
  const variants = [];
  for (const [x, y] of points) {
    const answer = coord(x, y);
    variants.push(makeVariant({ id: `read-${x}-${y}`, format: "coordinate-read", blueprint: "read-plotted-points", strand: "reading", stage: "read_plotted_coordinate", prompt: `A beacon is plotted at x = ${x}, y = ${y}. What is its coordinate?`, answer, choices: coordinateChoices(x, y), hints: ["Project down to read x first.", "Project across to read y second."], explanation: `The point lines up with ${x} on the x-axis and ${y} on the y-axis, so it is ${answer}.`, purpose: "plotted_point_reading", misconception: "reads_y_before_x", body: { grid: grid(), point: [x, y], guide_lines: true } }));
    variants.push(makeVariant({ id: `read-components-${x}-${y}`, format: "coordinate-read", blueprint: "read-plotted-points", strand: "axis_order", stage: "interpret_coordinate_components", prompt: `Which statement correctly describes the point ${answer}?`, answer: `x is ${x} and y is ${y}`, choices: [`x is ${x} and y is ${y}`, `x is ${y} and y is ${x}`, `both axes show ${x + y}`, `the point starts at (1, 1)`], hints: ["The first coordinate belongs to x.", "The second coordinate belongs to y."], explanation: `In ${answer}, the first component is x = ${x} and the second is y = ${y}.`, purpose: "coordinate_component_reading", misconception: "reads_y_before_x", body: { grid: grid(), point: [x, y], x_value: x, y_value: y } }));
    variants.push(makeVariant({ id: `read-axis-${x}-${y}`, format: "coordinate-read", blueprint: "read-plotted-points", strand: "reasoning", stage: "reason_about_axis_guides", prompt: `A learner reads ${answer} as ${coord(y, x)}. Which guide-line check repairs the error?`, answer: `Read the horizontal x value ${x} first, then the vertical y value ${y}`, choices: [`Read the horizontal x value ${x} first, then the vertical y value ${y}`, "Read whichever value is larger first", "Start counting labels from 1", "Swap the axes after writing the pair"], hints: ["Use the axis labels, not the size of the numbers.", "Say across, then up."], explanation: `Guide lines show x = ${x} before y = ${y}; this preserves the ordered-pair convention and gives ${answer}.`, purpose: "axis_order_reasoning_repair", misconception: "reads_y_before_x", body: { grid: grid(), point: [x, y], incorrect_reading: [y, x] } }));
  }
  return variants.slice(0, count);
}

function translationCandidates(count) {
  const variants = [];
  for (let index = 0; index < translationCases.length; index += 1) {
    const item = translationCases[index];
    const [sx, sy] = item.start; const [ex, ey] = item.end;
    const moveText = moveDescription(item.dx, item.dy);
    variants.push(makeVariant({ id: `translation-end-${index + 1}`, format: "movement-translation", blueprint: "translation-arrow-routes", strand: "translations", stage: "find_translation_destination", prompt: `A marker starts at ${coord(sx, sy)} and moves ${moveText}. Where does it finish?`, answer: coord(ex, ey), choices: translationChoices(item), hints: [horizontalHint(sx, item.dx), verticalHint(sy, item.dy)], explanation: `The horizontal move changes x from ${sx} to ${ex}; the vertical move changes y from ${sy} to ${ey}. The destination is ${coord(ex, ey)}.`, purpose: "point_translation_destination", misconception: "vertical_direction_reversal", body: { grid: grid(), start: item.start, vector: [item.dx, item.dy], end: item.end } }));
    variants.push(makeVariant({ id: `translation-vector-${index + 1}`, format: "movement-translation", blueprint: "translation-arrow-routes", strand: "translations", stage: "describe_translation_vector", prompt: `Which translation moves ${coord(sx, sy)} to ${coord(ex, ey)}?`, answer: moveText, choices: [moveText, moveDescription(-item.dx, item.dy), moveDescription(item.dx, -item.dy), moveDescription(item.dy, item.dx), "0 right and 0 up"], hints: ["Compare the x-values for left or right.", "Compare the y-values for up or down."], explanation: `x changes by ${signed(item.dx)} and y changes by ${signed(item.dy)}, so the translation is ${moveText}.`, purpose: "translation_vector_description", misconception: "vertical_direction_reversal", body: { grid: grid(), start: item.start, end: item.end, vector: [item.dx, item.dy] } }));
    const shape = [[sx, sy], [sx + 1, sy], [sx, sy + 1]];
    const movedShape = shape.map(([x, y]) => [x + item.dx, y + item.dy]);
    variants.push(makeVariant({ id: `translation-shape-${index + 1}`, format: "movement-translation", blueprint: "translation-arrow-routes", strand: "shape_vertices", stage: "translate_every_vertex_equally", prompt: `A triangular marker has vertices ${shape.map(([x, y]) => coord(x, y)).join(", ")}. It moves ${moveText}. Which rule must be used?`, answer: "Apply the same translation vector to every vertex; do not turn or resize the shape", choices: ["Apply the same translation vector to every vertex; do not turn or resize the shape", "Move only one vertex", "Swap x and y for every vertex", "Change each side length after moving"], hints: ["A translation is a slide.", "Every vertex follows equal parallel arrows."], explanation: `Adding the vector (${item.dx}, ${item.dy}) to every vertex produces ${movedShape.map(([x, y]) => coord(x, y)).join(", ")} while preserving size and orientation.`, purpose: "whole_shape_translation", misconception: "translation_as_turn_or_resize", body: { grid: grid(), start_vertices: shape, vector: [item.dx, item.dy], end_vertices: movedShape, preserves_size_and_orientation: true } }));
  }
  return variants.slice(0, count);
}

function polygonCandidates(count) {
  const variants = [];
  for (const item of rectangles) {
    const answer = coord(...item.missing);
    const verticesText = item.known.map(([x, y]) => coord(x, y)).join(", ");
    variants.push(makeVariant({ id: `rectangle-${item.id}-complete`, format: "polygon-complete", blueprint: "complete-first-quadrant-polygons", strand: "shape_vertices", stage: "complete_rectangle_vertex", prompt: `Three rectangle vertices are ${verticesText}. What is the missing vertex?`, answer, choices: polygonChoices(item), hints: [`Match x = ${item.x2} with the right side.`, `Match y = ${item.y2} with the top side.`], explanation: `The missing corner combines the right-side x-coordinate ${item.x2} with the top-side y-coordinate ${item.y2}, giving ${answer}.`, purpose: "rectangle_missing_vertex", misconception: "matches_one_coordinate_only", body: { grid: grid(), shape: "rectangle", known_vertices: item.known, missing_vertex: item.missing } }));
    variants.push(makeVariant({ id: `rectangle-${item.id}-reason`, format: "polygon-complete", blueprint: "complete-first-quadrant-polygons", strand: "reasoning", stage: "justify_missing_coordinate", prompt: `Why must the missing corner for vertices ${verticesText} be ${answer}?`, answer: `It shares x = ${item.x2} with the right-hand vertex and y = ${item.y2} with the upper vertex`, choices: [`It shares x = ${item.x2} with the right-hand vertex and y = ${item.y2} with the upper vertex`, "It uses the two largest numbers in any order", "A rectangle needs only one matching coordinate", "The coordinate is found by adding x and y"], hints: ["Trace the vertical side to match x.", "Trace the horizontal side to match y."], explanation: `Vertical rectangle sides share an x-coordinate and horizontal sides share a y-coordinate, so both clues are needed to determine ${answer}.`, purpose: "missing_vertex_reasoning", misconception: "matches_one_coordinate_only", body: { grid: grid(), shape: "rectangle", known_vertices: item.known, missing_vertex: item.missing, parallel_side_rule: true } }));
    variants.push(makeVariant({ id: `rectangle-${item.id}-misconception`, format: "polygon-complete", blueprint: "complete-first-quadrant-polygons", strand: "misconceptions", stage: "repair_one_coordinate_match", prompt: `A learner chooses ${coord(item.x2, item.y1)} as the missing corner because x matches. What is the correction?`, answer: `A missing vertex must satisfy both side alignments, so use ${answer}`, choices: [`A missing vertex must satisfy both side alignments, so use ${answer}`, "Matching x alone is always enough", "Swap every x- and y-coordinate", "Move the existing vertices instead"], hints: ["Check the horizontal alignment as well as the vertical one.", `The missing y-value is ${item.y2}, not ${item.y1}.`], explanation: `The suggested point repeats a known lower corner. The new corner must match x = ${item.x2} and y = ${item.y2}, so it is ${answer}.`, purpose: "missing_vertex_misconception_repair", misconception: "matches_one_coordinate_only", body: { grid: grid(), shape: "rectangle", known_vertices: item.known, incorrect_vertex: [item.x2, item.y1], missing_vertex: item.missing } }));
  }
  return variants.slice(0, count);
}

function makeVariant({ id, format, blueprint, strand, stage, prompt, answer, choices, hints, explanation, purpose, misconception, body }) {
  const fullId = `${prefix}${id}`;
  const band = bandFor(blueprint, stage);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotate(uniqueByJSON(choices), fullId.length % choices.length),
      ...body,
      coordinate_strand: strand,
      coverage_tags: coverageFor(strand, stage),
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "grid_keyboard_switch_touch_direct_coordinate_or_partner_recorded",
      interaction_support: { keyboard_arrows: true, switch_scan: true, touch: true, direct_coordinate_entry: true, partner_recording: true, drag_required: false, undo_available: true, confirm_before_submit: true },
      send_routes: {
        grid: "large high-contrast first-quadrant grid with persistent origin and patterned x/y axes",
        visual: "static guide lines, labelled points and numbered translation arrows; colour is never required",
        concrete: "adult-prepared pegboard or tactile coordinate mat with x-card first, y-card second and movable vertex pegs",
        text: "coordinate table listing point name, x, y, horizontal move and vertical move",
      },
      reduced_visual_load: true,
      one_operation_per_screen: true,
      reduced_motion_alternative: "side-by-side start and end grids with instant labelled arrows",
      feedback_mode: "retain the correct axis or coordinate, identify one swapped or off-by-one step and retrace from the origin",
      mission: missionFor(strand, stage, fullId),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: `Map coordinate verified: ${purpose.replaceAll("_", " ")}.`, repair: repairFor(strand, stage), reasoning_check: "State the x clue, the y clue and how both determine the point or movement.", misconception_check: misconceptionFeedback(misconception), retry: "The map keeps every correct axis step. Retrace one instruction without a timer or penalty." },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(strand, stage, id) {
  const sectors = { origin_and_axes: "Origin Basecamp", axis_order: "Across-Then-Up Causeway", plotting: "Beacon Placement Grid", missing_coordinates: "Missing Signal Junction", reading: "Guide-Line Observatory", reasoning: "Cartographer's Proof Desk", translations: "Vector Route Control", shape_vertices: "Polygon Survey Zone", misconceptions: "Map Error Repair Bay" };
  const tools = { origin_and_axes: "start at (0, 0) and count unit jumps", axis_order: "lock x first, then y", plotting: "trace across, trace up, then place the point", missing_coordinates: "combine one x clue with one y clue", reading: "project to both labelled axes", reasoning: "justify the coordinate with two independent alignments", translations: "change x horizontally and y vertically", shape_vertices: "apply the same vector or match both side coordinates", misconceptions: "preserve the correct axis and repair only the swapped or off-by-one step" };
  return { campaign: "Atlas Grid Command: Reconnect the First-Quadrant Archipelago", sector: sectors[strand], mission_code: id.slice(-30), objective: `Complete the ${stage.replaceAll("_", " ")} map operation and verify it with both axes.`, strategic_tool: tools[strand], navigation_protocol: ["locate the origin", "read or change x", "read or change y", "check the ordered pair and map shape"], reward: { item: "archipelago route tile", earned_for: "using a coordinate strategy or completing a repair", effect: "reconnects a map route without increasing speed, pressure or difficulty" }, retry_protocol: "No lives, map tiles or progress are lost; correct axis work remains fixed while a targeted guide line appears." };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 5) throw new Error(`Expected five curated variants, found ${curatedItems.length}.`);
  if (generated.length !== pilot - curatedItems.length || curatedItems.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set(); const coverage = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of [...curatedItems, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || uniqueByJSON(variant.body.choices).length !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    if (!variant.body.interaction_support?.keyboard_arrows || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_routes?.grid || !variant.body.send_routes?.visual || !variant.body.send_routes?.concrete || !variant.body.send_routes?.text || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND routes.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.mission?.retry_protocol) || !variant.body.mission?.strategic_tool) throw new Error(`${variant.id} lacks low-pressure map missions.`);
    if (!variant.feedback?.repair || !variant.feedback?.reasoning_check || !variant.feedback?.misconception_check || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks rich feedback.`);
    validateCoordinateData(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("coordinate coverage", new Set(["first_quadrant", "plotting", "reading", "translations", "shape_vertices", "missing_coordinates", "reasoning", "misconceptions"]), coverage);
}

function validateCoordinateData(variant) {
  const body = variant.body;
  const pointsToCheck = [body.target, body.point, body.start, body.end, body.missing_vertex, ...(body.known_vertices ?? []), ...(body.start_vertices ?? []), ...(body.end_vertices ?? [])].filter(Array.isArray);
  for (const [x, y] of pointsToCheck) if (x < 0 || y < 0 || x > gridMax || y > gridMax) throw new Error(`${variant.id} leaves the first-quadrant grid at (${x}, ${y}).`);
  if (body.start && body.end && body.vector && (body.start[0] + body.vector[0] !== body.end[0] || body.start[1] + body.vector[1] !== body.end[1])) throw new Error(`${variant.id} has an invalid translation.`);
  if (body.start_vertices && body.end_vertices) for (let i = 0; i < body.start_vertices.length; i += 1) if (body.start_vertices[i][0] + body.vector[0] !== body.end_vertices[i][0] || body.start_vertices[i][1] + body.vector[1] !== body.end_vertices[i][1]) throw new Error(`${variant.id} translates vertices inconsistently.`);
  if (body.shape === "rectangle" && body.missing_vertex) { const [mx, my] = body.missing_vertex; if (!body.known_vertices.some(([x]) => x === mx) || !body.known_vertices.some(([, y]) => y === my)) throw new Error(`${variant.id} has an unsupported rectangle vertex.`); }
}

function grid() { return { x_min: 0, y_min: 0, x_max: gridMax, y_max: gridMax, quadrant: "first", origin_labelled: true, unit_intervals: true }; }
function coord(x, y) { return `(${x}, ${y})`; }
function coordinateChoices(x, y) { return uniqueByJSON([coord(x, y), coord(y, x), coord(x, 0), coord(0, y), coord(Math.min(gridMax, x + 1), Math.min(gridMax, y + 1))]).slice(0, 4); }
function coordinateArrayChoices(x, y) { return uniqueByJSON([[x, y], [y, x], [x, 0], [0, y], [Math.min(gridMax, x + 1), Math.min(gridMax, y + 1)]]).slice(0, 4); }
function translationChoices(item) { const [sx, sy] = item.start; return uniqueByJSON([coord(...item.end), coord(sx + item.dx, sy), coord(sx, sy + item.dy), coord(sx - item.dx, sy - item.dy), coord(item.end[1], item.end[0])]).slice(0, 4); }
function polygonChoices(item) { return uniqueByJSON([coord(...item.missing), coord(item.y2, item.x2), coord(item.x1, item.y2), coord(item.x2, item.y1), coord(item.x1, item.y1)]).slice(0, 4); }
function moveDescription(dx, dy) { return `${Math.abs(dx)} ${dx >= 0 ? "right" : "left"} and ${Math.abs(dy)} ${dy >= 0 ? "up" : "down"}`; }
function horizontalHint(start, delta) { return `${delta >= 0 ? "Right increases" : "Left decreases"} x: ${start} ${delta >= 0 ? "+" : "−"} ${Math.abs(delta)}.`; }
function verticalHint(start, delta) { return `${delta >= 0 ? "Up increases" : "Down decreases"} y: ${start} ${delta >= 0 ? "+" : "−"} ${Math.abs(delta)}.`; }
function signed(value) { return value >= 0 ? `+${value}` : String(value); }
function coverageFor(strand, stage) { const tags = new Set([strand, "first_quadrant"]); if (stage.includes("plot")) tags.add("plotting"); if (stage.includes("read")) tags.add("reading"); if (stage.includes("translation")) tags.add("translations"); if (stage.includes("vertex") || strand === "shape_vertices") tags.add("shape_vertices"); if (stage.includes("missing") || strand === "missing_coordinates") tags.add("missing_coordinates"); if (stage.includes("reason") || strand === "reasoning") tags.add("reasoning"); if (stage.includes("repair") || strand === "misconceptions") tags.add("misconceptions"); return [...tags]; }
function bandFor(blueprint, stage) { if (blueprint === "origin-and-axis-traces") return stage.includes("repair") ? "developing" : "intro"; if (blueprint === "plot-ordered-pairs") return stage.includes("missing") ? "expected" : "developing"; if (blueprint === "read-plotted-points") return stage.includes("reason") ? "secure" : "expected"; if (blueprint === "translation-arrow-routes") return stage.includes("vertex") ? "stretch" : "secure"; return "stretch"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8 }[band]; }
function repairFor(strand, stage) { if (stage.includes("repair") || strand === "misconceptions") return "Keep the correct axis clue, return to (0, 0), and repair only the swapped, reversed or off-by-one step."; if (strand === "translations") return "Compare x-values for left or right, compare y-values for up or down, then apply the same vector consistently."; if (strand === "shape_vertices") return "Trace one vertical and one horizontal side; the missing point must satisfy both coordinate alignments."; if (strand === "missing_coordinates") return "Write the known x clue and known y clue separately, then combine them in x-first order."; return "Start at the origin, trace x across first, trace y up second and verify against both labelled axes."; }
function misconceptionFeedback(tag) { return ({ starts_counting_at_one: "The origin is zero; count unit jumps between lines rather than labels touched.", reverses_x_y_order: "Coordinates always record x across first and y up second.", reads_y_before_x: "Project to the x-axis first, then read the y-axis.", vertical_direction_reversal: "Up increases y and down decreases y; horizontal moves change x.", translation_as_turn_or_resize: "A translation slides every vertex by one shared vector without changing size or orientation.", matches_one_coordinate_only: "A missing vertex must satisfy both its x alignment and its y alignment." })[tag] ?? "Check both axes and the ordered pair."; }
function animationFor(strand) { return ({ origin_and_axes: "origin-compass-trace", axis_order: "coordinate-swap-compare", plotting: "coordinate-laser-plot", missing_coordinates: "guide-line-intersection", reading: "point-guide-lines", reasoning: "coordinate-proof-overlay", translations: "translation-arrow-slide", shape_vertices: "polygon-vertex-complete", misconceptions: "map-error-repair" })[strand]; }
function curatedBlueprint(variant) { const map = { "ma-y4-coordinates-q-plot-4-3": "plot-ordered-pairs", "ma-y4-coordinates-q-read-flag": "read-plotted-points", "ma-y4-coordinates-q-translate-gem": "translation-arrow-routes", "ma-y4-coordinates-q-swap-points": "origin-and-axis-traces", "ma-y4-coordinates-q-complete-rectangle": "complete-first-quadrant-polygons" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generated) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generated) { return Object.entries(combinedAllocation(curatedItems, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function uniqueByJSON(items) { const seen = new Set(); return items.filter((item) => { const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; }); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
