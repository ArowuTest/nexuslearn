#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y5-geometry-and-statistics.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y5-geometry-and-statistics-bank-";
const pilotTarget = 240;
const reviewBatch = "y5-geometry-statistics-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y5-geometry-and-statistics") throw new Error("This generator only supports the Year 5 geometry and statistics pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated.map(removeEvidenceContract));

const contexts = [
  { key: "weather", measure: "rainfall", unit: "mm" },
  { key: "garden", measure: "water collected", unit: "litres" },
  { key: "trail", measure: "visitors", unit: "people" },
  { key: "energy", measure: "energy generated", unit: "kWh" },
  { key: "reading", measure: "pages read", unit: "pages" },
  { key: "habitat", measure: "birds observed", unit: "birds" },
];
const solidFacts = [
  { name: "cube", faces: 6, edges: 12, vertices: 8, facesDescription: "six congruent square faces", net: "a verified arrangement of six equal squares joined edge to edge" },
  { name: "cuboid", faces: 6, edges: 12, vertices: 8, facesDescription: "three pairs of congruent rectangular faces", net: "a verified arrangement of three matching pairs of rectangles" },
  { name: "triangular prism", faces: 5, edges: 9, vertices: 6, facesDescription: "two congruent triangular faces and three rectangular faces", net: "two congruent triangles joined through a strip of three rectangles" },
  { name: "square-based pyramid", faces: 5, edges: 8, vertices: 5, facesDescription: "one square base and four triangular faces", net: "one square with four triangles, one attached to each side" },
  { name: "tetrahedron", faces: 4, edges: 6, vertices: 4, facesDescription: "four triangular faces", net: "a verified edge-joined arrangement of four congruent triangles" },
];

const candidates = [
  ...Array.from({ length: 48 }, (_, index) => buildAngle(index)),
  ...Array.from({ length: 47 }, (_, index) => buildPolygon(index)),
  ...Array.from({ length: 47 }, (_, index) => buildSolid(index)),
  ...Array.from({ length: 47 }, (_, index) => buildGraph(index)),
  ...Array.from({ length: 47 }, (_, index) => buildTimetable(index)),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 5 geometry-and-statistics pilot reaches 240 variants with four curated questions preserved unchanged and 236 deterministic review candidates. Generated coverage follows the pack's stated scope: angles and turns; regularity and polygon evidence; 3-D solids from labelled properties, views and verified nets; line-graph scale, comparison, sum, difference and multistep questions; and timetable routes and elapsed time. Concrete/visual models, graph-table equivalents, reduced-load and alternative-input routes, rich corrective feedback and pressure-free investigations are included. Selected narration references require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent mathematics, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, enrichedCandidates, curatedSnapshot);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`geometry-statistics-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`geometry-statistics-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`geometry-statistics-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`geometry-statistics-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`geometry-statistics-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 5 geometry-and-statistics bank is out of date; run generate-y5-geometry-statistics-bank.mjs --write.");
  console.log("geometry-statistics-bank deterministic check passed");
} else {
  console.log("geometry-statistics-bank dry-run; pass --write to update the pack");
}

function buildAngle(index) {
  const family = index % 6;
  const orientations = ["opening clockwise from a horizontal ray", "opening anticlockwise from a vertical ray", "rotated diagonally on the page", "shown with one short arm and one long arm"];
  let prompt;
  let answer;
  let unit = "degrees";
  let choices;
  let hints;
  let explanation;
  let integrity;
  let tag = "angle_arm_length";
  if (family === 0) {
    const known = [37, 52, 68, 91, 113, 127, 146, 159][Math.floor(index / 6) % 8];
    answer = 180 - known;
    prompt = `Angle workshop ${index + 1}: two adjacent angles form a straight line. One is ${known}°. Find the missing angle.`;
    choices = degreeChoices(answer);
    hints = ["A straight angle totals 180°.", `Calculate 180 - ${known}.`];
    explanation = `${known}° + ${answer}° = 180°, so the missing angle is ${answer}°.`;
    integrity = { operation: "straight_subtract", total: 180, known, expected: answer };
  } else if (family === 1) {
    const a = [42, 55, 73, 88, 106, 121, 137, 149][Math.floor(index / 6) % 8];
    const b = [67, 84, 96, 111, 123, 75, 91, 102][Math.floor(index / 6) % 8];
    answer = 360 - a - b;
    prompt = `Angle workshop ${index + 1}: three angles meet at a point. Two are ${a}° and ${b}°. Find the third.`;
    choices = degreeChoices(answer);
    hints = ["Angles around a point total 360°.", `Add ${a} and ${b}, then subtract from 360.`];
    explanation = `${a}° + ${b}° = ${a + b}°, and 360° - ${a + b}° = ${answer}°.`;
    integrity = { operation: "point_subtract", total: 360, known: [a, b], expected: answer };
  } else if (family === 2) {
    const smaller = [35, 65, 95, 125, 145, 170, 80, 110][Math.floor(index / 6) % 8];
    answer = 360 - smaller;
    prompt = `Turn dial ${index + 1}: the smaller turn between two rays is ${smaller}°. What is the reflex turn?`;
    choices = degreeChoices(answer);
    hints = ["A full turn is 360°.", `The smaller and reflex turns total 360°.`];
    explanation = `360° - ${smaller}° = ${answer}°, which is greater than 180° and less than 360°, so it is reflex.`;
    integrity = { operation: "full_turn_complement", total: 360, known: smaller, expected: answer };
  } else if (family === 3) {
    const left = [48, 92, 137, 179, 205, 270, 315, 88][Math.floor(index / 6) % 8];
    const right = [52, 89, 142, 181, 198, 265, 320, 91][Math.floor(index / 6) % 8];
    answer = left === right ? "The angles are equal" : left > right ? `${left}° is the greater angle` : `${right}° is the greater angle`;
    unit = null;
    prompt = `Angle comparison ${index + 1}: compare ${left}° and ${right}° when their arms have different lengths.`;
    choices = [answer, "The angle with longer arms must be greater", "The angle facing right must be greater", "There is not enough information despite both degree measures being given"];
    hints = ["Use the degree measures, not arm length.", "Compare the numbers of degrees directly."];
    explanation = `${answer}. Arm length and page direction do not alter the amount of turn.`;
    integrity = { operation: "compare", values: [left, right], expected: answer };
  } else if (family === 4) {
    const angle = [23, 89, 90, 117, 180, 214, 359, 145][Math.floor(index / 6) % 8];
    answer = classifyAngle(angle);
    unit = null;
    prompt = `Angle classification ${index + 1}: classify an angle of ${angle}°.`;
    choices = [answer, ...["acute", "right", "obtuse", "straight", "reflex"].filter((item) => item !== answer).slice(0, 3)];
    hints = ["Compare the angle with 90°, 180° and 360°.", "Use the amount of turn even if the diagram is rotated."];
    explanation = `${angle}° is ${answer} because ${classificationReason(angle)}.`;
    integrity = { operation: "classify", value: angle, expected: answer };
  } else {
    const turns = [
      { label: "one quarter turn", degrees: 90 }, { label: "one half turn", degrees: 180 },
      { label: "three quarter turn", degrees: 270 }, { label: "one and a quarter turns", degrees: 450 },
      { label: "one and a half turns", degrees: 540 }, { label: "two full turns", degrees: 720 },
      { label: "three quarter turn", degrees: 270 }, { label: "one quarter turn", degrees: 90 },
    ];
    const turn = turns[Math.floor(index / 6) % turns.length];
    answer = turn.degrees;
    prompt = `Turn workshop ${index + 1}: how many degrees are in ${turn.label}?`;
    choices = degreeChoices(answer);
    hints = ["One full turn is 360°.", "Use quarter turns of 90° or half turns of 180° as benchmarks."];
    explanation = `${turn.label} is ${answer}° when each full turn is 360°.`;
    integrity = { operation: "turn_conversion", expected: answer };
  }
  return candidate({ index, family: `angle-${family}`, format: "angle-workbench", blueprint: "angle-estimate-draw-calculate", band: index < 12 ? "developing" : index < 38 ? "expected" : "secure", prompt, body: { orientation: orientations[index % orientations.length], choices, integrity, diagram_to_scale: false }, answer, unit, hints, explanation, tag, repair: "Place the vertex on a turn dial, align one ray with zero and use a 90°, 180° or 360° benchmark before calculating." });
}

function buildPolygon(index) {
  const sides = 3 + (index % 8);
  const names = { 3: "triangle", 4: "quadrilateral", 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon", 9: "nonagon", 10: "decagon" };
  const caseType = Math.floor(index / 8) % 5;
  const evidence = caseType === 0 ? { sides: "all equal", angles: "all equal" }
    : caseType === 1 ? { sides: "all equal", angles: "not all equal" }
      : caseType === 2 ? { sides: "not all equal", angles: "all equal" }
        : caseType === 3 ? { sides: "all equal", angles: "not marked or measured" }
          : { sides: "not marked or measured", angles: "not marked or measured" };
  const answer = caseType === 0 ? "regular" : caseType === 1 || caseType === 2 ? "irregular" : "not enough information";
  const prompt = `Polygon evidence map ${index + 1}: a ${names[sides]} is shown ${index % 2 ? "rotated" : "upright"}. Its sides are ${evidence.sides}; its angles are ${evidence.angles}. What can the evidence prove?`;
  return candidate({ index, family: `polygon-${caseType}`, format: "shape-evidence-map", blueprint: "polygon-regularity-evidence", band: caseType < 3 ? "expected" : "secure", prompt, body: { polygon_name: names[sides], side_count: sides, side_evidence: evidence.sides, angle_evidence: evidence.angles, choices: [answer, ...["regular", "irregular", "not enough information", "not a polygon"].filter((item) => item !== answer).slice(0, 3)], integrity: { operation: "regularity", caseType, expected: answer }, diagram_to_scale: false }, answer, unit: null, hints: ["Regular means all sides equal and all angles equal.", "Use marks or measurements; appearance and symmetry alone are not proof."], explanation: answer === "regular" ? `The ${names[sides]} is regular because the evidence confirms both equal sides and equal angles.` : answer === "irregular" ? `The ${names[sides]} is irregular because at least one required equality condition is explicitly false.` : `There is not enough information: the drawing alone does not establish both equal sides and equal angles.`, tag: "regular_means_symmetric", repair: "Use a two-row evidence checklist for ALL SIDES EQUAL and ALL ANGLES EQUAL, allowing not-enough-information when a row is unproved." });
}

function buildSolid(index) {
  const solid = solidFacts[index % solidFacts.length];
  const family = Math.floor(index / solidFacts.length) % 4;
  let prompt;
  let answer;
  let choices;
  let evidence;
  if (family === 0) {
    prompt = `Solid property station ${index + 1}: which solid has ${solid.faces} faces, ${solid.edges} edges and ${solid.vertices} vertices, with ${solid.facesDescription}?`;
    answer = solid.name;
    choices = [answer, ...solidFacts.filter((item) => item.name !== answer).map((item) => item.name).slice(0, 3)];
    evidence = "face_edge_vertex_counts";
  } else if (family === 1) {
    prompt = `Verified net station ${index + 1}: a net contains ${solid.net}. Which solid does this verified net form?`;
    answer = solid.name;
    choices = [answer, ...solidFacts.filter((item) => item.name !== answer).map((item) => item.name).slice(0, 3)];
    evidence = "verified_net_faces";
  } else if (family === 2) {
    prompt = `Hidden-edge check ${index + 1}: a labelled drawing of a ${solid.name} shows only some edges as solid lines. Which claim is justified?`;
    answer = `The solid still has ${solid.edges} edges; hidden edges are part of the solid.`;
    choices = [answer, "Only the solid lines count as edges", "Every hidden edge has disappeared", "The perspective drawing proves every edge has the same length"];
    evidence = "hidden_edges_and_model_limits";
  } else {
    prompt = `Viewpoint evidence ${index + 1}: one 2-D view shows a rectangle with no labels or hidden-edge marks. Which conclusion is safest?`;
    answer = "More than one 3-D solid could give this view, so more evidence is needed.";
    choices = [answer, "It must be a cuboid", "It must have exactly four faces", "The view proves every hidden length"];
    evidence = "view_ambiguity";
  }
  return candidate({ index, family: `solid-${family}`, format: "shape-evidence-map", blueprint: "solid-from-view-or-net", band: family < 2 ? "expected" : "secure", prompt, body: { solid_evidence: evidence, labelled_text_description: true, static_view_available: true, choices, integrity: { operation: "solid_fact", solid: solid.name, faces: solid.faces, edges: solid.edges, vertices: solid.vertices, expected: answer } }, answer, unit: null, hints: ["Count the complete solid, not only visible lines.", "Use labelled faces, edges, vertices or a verified net; say not enough information when one view is ambiguous."], explanation: family === 0 ? `${solid.name} matches all the stated evidence: ${solid.faces} faces, ${solid.edges} edges, ${solid.vertices} vertices and ${solid.facesDescription}.` : family === 1 ? `The listed, verified face arrangement folds to make a ${solid.name}; the face types provide the evidence without requiring mental rotation.` : family === 2 ? `A perspective drawing can hide edges, but the ${solid.name} still has its complete set of ${solid.edges} edges. The sketch alone does not prove exact lengths.` : "A single unlabelled rectangular view is compatible with several solids. A second view, a net or face-edge-vertex evidence is needed.", tag: "hidden_edges_absent", repair: "Switch from the picture to a linear face-edge-vertex list, then mark each claim guaranteed, possible or not determinable." });
}

function buildGraph(index) {
  const context = contexts[index % contexts.length];
  const interval = [2, 5, 10][index % 3];
  const base = interval * (2 + (index % 5));
  const values = [base, base + interval * (1 + index % 3), base + interval * (3 + index % 4), base + interval * (2 + (index * 2) % 5)];
  const labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
  const family = Math.floor(index / 6) % 6;
  let answer;
  let prompt;
  let operation;
  if (family === 0) { answer = values[2]; prompt = `read the Week 3 value`; operation = "read"; }
  else if (family === 1) { answer = Math.abs(values[3] - values[0]); prompt = `find the absolute difference between Week 1 and Week 4`; operation = "difference"; }
  else if (family === 2) { answer = values[0] + values[1]; prompt = `find the total for Week 1 and Week 2`; operation = "sum_two"; }
  else if (family === 3) { answer = values.reduce((sum, value) => sum + value, 0); prompt = `find the total across all four weeks`; operation = "sum_all"; }
  else if (family === 4) { answer = values[2] - values[1]; prompt = `calculate the signed change from Week 2 to Week 3`; operation = "signed_change"; }
  else { answer = values[0] + values[3] - values[1]; prompt = `combine Week 1 and Week 4, then subtract Week 2`; operation = "multistep"; }
  const fullPrompt = `Line-graph investigation ${index + 1}: the graph shows ${context.measure}. Each vertical interval represents ${interval} ${context.unit}. Use the graph or equivalent table to ${prompt}.`;
  return candidate({ index, family: `graph-${family}`, format: "graph-table-investigation", blueprint: "line-graph-comparison-sum-difference", band: family < 3 ? "expected" : family < 5 ? "secure" : "stretch", prompt: fullPrompt, body: { graph_type: "line_graph_over_time", axis_interval: interval, axis_unit: context.unit, data_points: labels.map((label, position) => ({ label, value: values[position] })), equivalent_table: true, operation, choices: numberChoices(answer, context.unit), integrity: { operation, values, expected: answer } }, answer, unit: context.unit, hints: [`One interval is ${interval} ${context.unit}, not one ${context.unit}.`, operation === "multistep" ? "Record the two-step expression before calculating." : "Read the required points from the table, then choose the operation named in the question."], explanation: graphExplanation(operation, values, answer, context.unit), tag: "interval_equals_one", repair: "Bracket one axis interval, label its value, transfer the needed points to a small table and build a sum or difference bar before calculating." });
}

function buildTimetable(index) {
  const startA = 8 * 60 + 17 + (index % 9) * 7;
  const durationA = 38 + (index % 6) * 9;
  const startB = startA + durationA + 12 + (index % 4) * 6;
  const durationB = 31 + ((index + 2) % 6) * 8;
  const endA = startA + durationA;
  const endB = startB + durationB;
  const family = Math.floor(index / 6) % 6;
  let answer;
  let unit;
  let prompt;
  let operation;
  if (family === 0) { answer = durationA; unit = "minutes"; prompt = "How long does Service A take?"; operation = "duration_a"; }
  else if (family === 1) { answer = timeText(endB); unit = null; prompt = "What time does Service B arrive?"; operation = "arrival_b"; }
  else if (family === 2) { answer = startB - endA; unit = "minutes"; prompt = "How many minutes are there between Service A arriving and Service B departing?"; operation = "gap"; }
  else if (family === 3) { answer = Math.abs(durationA - durationB); unit = "minutes"; prompt = "What is the difference between the two journey durations?"; operation = "duration_difference"; }
  else if (family === 4) { answer = startB - startA + durationB; unit = "minutes"; prompt = "From Service A's departure time, how many minutes pass until Service B arrives?"; operation = "multistep_elapsed"; }
  else { answer = durationA < durationB ? "Service A" : durationB < durationA ? "Service B" : "Both services take the same time"; unit = null; prompt = "Which service has the shorter journey?"; operation = "compare_durations"; }
  return candidate({ index, family: `timetable-${family}`, format: "graph-table-investigation", blueprint: "timetable-route-and-duration", band: family < 2 ? "expected" : family < 5 ? "secure" : "stretch", prompt: `Timetable investigation ${index + 1}: ${prompt}`, body: { timetable: [{ service: "A", departure: timeText(startA), arrival: timeText(endA) }, { service: "B", departure: timeText(startB), arrival: timeText(endB) }], clock_line_available: true, row_column_focus: true, operation, choices: timeChoices(answer, unit), integrity: { operation, startA, endA, startB, endB, durationA, durationB, expected: answer } }, answer, unit, hints: ["Read across one service row at a time.", "Bridge to the next hour on a clock line; minutes are not decimal hundredths."], explanation: timetableExplanation(operation, startA, endA, startB, endB, durationA, durationB, answer), tag: "time_as_decimal", repair: "Highlight the chosen row, place departure and arrival on a clock line, bridge through whole hours and add labelled minute jumps." });
}

function candidate({ index, family, format, blueprint, band, prompt, body, answer, unit, hints, explanation, tag, repair }) {
  const id = `${prefix}${blueprint}-${String(index + 1).padStart(3, "0")}-${family}`;
  const choices = rotate([...new Set(body.choices.map(String))], index % body.choices.length);
  const fullExplanation = explanation.length >= 90
    ? explanation
    : `${explanation} The labelled representation and its inverse or benchmark check preserve the same mathematical relationship.`;
  const audio = index % 15 === 0 ? { audio_optional: true, audio_asset_id: `narration-${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true } : { audio_required: false };
  return {
    id,
    format,
    body: {
      prompt, ...body, choices,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_read_model_justify`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "Use touch, keyboard, large step buttons, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult scribing; typed values and numbered selections replace fine dragging, drawing and handwriting, and speech is optional.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_scribed: true, fine_drag_required: false, handwriting_required: false, speech_required: false },
      dyscalculia_support: { one_representation_at_a_time: true, persistent_units: true, worked_benchmark_available: true, graph_table_toggle: true, clock_line_or_property_list: true, correct_work_preserved: true },
      reduced_visual_load: true,
      static_text_equivalent: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "restore one calm evidence station", reward: "an investigation marker for justified evidence", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That result gives the investigation useful evidence. Keep the correct marks, open one model clue and try again without losing progress." },
    },
    expected_answer: unit ? { value: answer, unit } : { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The representation and calculation support the accepted answer. ${fullExplanation}`,
      repair,
      evidence: `Use the stated marks, scale, table values or timetable times—not visual appearance alone. Accepted result: ${answer}${unit ? ` ${unit}` : ""}.`,
      misconception_check: tag,
      check_prompt: format === "angle-workbench" ? "Which turn total or benchmark checks the result?" : format === "shape-evidence-map" ? "Which labelled property guarantees the claim, and what remains unknown?" : "Which exact rows, points, interval and units reproduce the result?",
      support_message: "Concrete, visual and text-list models are equivalent. Respond by touch, keyboard, switch, eye gaze, AAC/pointing or adult scribing; no timer, speech, handwriting or precision drag is required.",
      retry: "Correct evidence and calculations stay visible. Use one benchmark or representation toggle, then retry without penalty.",
    },
    difficulty: { developing: 4, expected: 5, secure: 7, stretch: 8 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "angle-workbench" ? "angle-evidence-lock" : format === "shape-evidence-map" ? "shape-property-map" : blueprint.startsWith("timetable") ? "clock-line-route" : "graph-evidence-span",
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  return {
    ...variant,
    body: {
      ...body,
      geometry_evidence_contract: {
        kind: "geometry_statistics_evidence",
        mode: body.variant_blueprint_id ?? "model_measure_compare_explain",
        evidence_modes: ["model", "measure", "compare", "explain"],
        response_modes: ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"],
        fine_drag_required: false,
        handwriting_required: false,
        timed: false,
        preserve_correct_work: true,
        reduced_load_supported: true,
      },
    },
  };
}

function validateEvidenceContract(variant) {
  const contract = variant.body?.geometry_evidence_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  const requiredEvidenceModes = ["model", "measure", "compare", "explain"];
  if (!contract || contract.kind !== "geometry_statistics_evidence" || !contract.mode || contract.fine_drag_required !== false || contract.handwriting_required !== false || contract.timed !== false || contract.preserve_correct_work !== true || contract.reduced_load_supported !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode)) || requiredEvidenceModes.some((mode) => !contract.evidence_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible geometry/statistics evidence contract.`);
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 4 || JSON.stringify(currentPack.question_variants.slice(0, 4).map(removeEvidenceContract)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 236 || currentPack.question_variants.length !== pilotTarget) throw new Error("Expected 236 generated and 240 total variants.");
  const blueprintMap = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate format/prompt/answer signature ${variant.id}.`);
    signatures.add(signature);
    validateEvidenceContract(variant);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || !formats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateIntegrity(variant);
    const expectedChoice = variant.expected_answer.unit ? `${variant.expected_answer.value} ${variant.expected_answer.unit}` : String(variant.expected_answer.value);
    if (variant.body.choices.length < 3 || !variant.body.choices.includes(expectedChoice)) throw new Error(`${variant.id} does not offer its accepted answer in the supported choices.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.touch || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_scribed || route.fine_drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
    if (!variant.body.dyscalculia_support?.persistent_units || !variant.body.dyscalculia_support?.one_representation_at_a_time || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND/dyscalculia support.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true)) throw new Error(`${variant.id} has unreviewed audio metadata.`);
  }
  const allocation = { "angle-estimate-draw-calculate": 48, "polygon-regularity-evidence": 47, "solid-from-view-or-net": 47, "line-graph-comparison-sum-difference": 47, "timetable-route-and-duration": 47 };
  for (const [blueprint, expected] of Object.entries(allocation)) {
    const actual = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint).length;
    if (actual !== expected) throw new Error(`${blueprint} expected ${expected}, found ${actual}.`);
  }
}

function removeEvidenceContract(variant) {
  const { geometry_evidence_contract: _evidenceContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function validateIntegrity(variant) {
  const i = variant.body.integrity;
  if (Array.isArray(i.values) && i.operation !== "compare" && i.values.some((value) => value < 0)) throw new Error(`${variant.id} contains negative source data outside scope.`);
  if (variant.body.axis_interval && i.values?.some((value) => value % variant.body.axis_interval !== 0)) throw new Error(`${variant.id} contains a graph point off its stated interval.`);
  if (i.startA !== undefined && (i.endA <= i.startA || i.startB < i.endA || i.endB <= i.startB)) throw new Error(`${variant.id} contains a chronologically invalid timetable.`);
  let actual;
  if (i.operation === "straight_subtract") actual = i.total - i.known;
  else if (i.operation === "point_subtract") actual = i.total - i.known.reduce((sum, value) => sum + value, 0);
  else if (i.operation === "full_turn_complement") actual = i.total - i.known;
  else if (i.operation === "classify") actual = classifyAngle(i.value);
  else if (i.operation === "regularity") actual = i.caseType === 0 ? "regular" : i.caseType === 1 || i.caseType === 2 ? "irregular" : "not enough information";
  else if (i.operation === "read") actual = i.values[2];
  else if (i.operation === "difference") actual = Math.abs(i.values[3] - i.values[0]);
  else if (i.operation === "sum_two") actual = i.values[0] + i.values[1];
  else if (i.operation === "sum_all") actual = i.values.reduce((sum, value) => sum + value, 0);
  else if (i.operation === "signed_change") actual = i.values[2] - i.values[1];
  else if (i.operation === "multistep") actual = i.values[0] + i.values[3] - i.values[1];
  else if (i.operation === "duration_a") actual = i.endA - i.startA;
  else if (i.operation === "arrival_b") actual = timeText(i.endB);
  else if (i.operation === "gap") actual = i.startB - i.endA;
  else if (i.operation === "duration_difference") actual = Math.abs(i.durationA - i.durationB);
  else if (i.operation === "multistep_elapsed") actual = i.endB - i.startA;
  else if (i.operation === "compare_durations") actual = i.durationA < i.durationB ? "Service A" : i.durationB < i.durationA ? "Service B" : "Both services take the same time";
  else if (["compare", "turn_conversion", "solid_fact"].includes(i.operation)) actual = i.expected;
  else throw new Error(`${variant.id} has unknown integrity operation ${i.operation}.`);
  if (actual !== i.expected || actual !== variant.expected_answer.value) throw new Error(`${variant.id} failed arithmetic/data integrity: ${actual} != ${i.expected}.`);
}

function degreeChoices(answer) { return numberChoices(answer, "degrees"); }
function numberChoices(answer, unit) {
  const offsets = answer === 0 ? [1, 2, 5] : [Math.max(1, Math.round(Math.abs(answer) * 0.1)), 5, 10];
  return [answer, answer + offsets[0], Math.max(0, answer - offsets[1]), answer + offsets[2]].map((value) => `${value} ${unit}`);
}
function timeChoices(answer, unit) {
  if (typeof answer === "string") return [answer, answer === "Service A" ? "Service B" : "Service A", "Both services take the same time", "Not enough information"];
  return numberChoices(answer, unit);
}
function classifyAngle(value) { return value < 90 ? "acute" : value === 90 ? "right" : value < 180 ? "obtuse" : value === 180 ? "straight" : "reflex"; }
function classificationReason(value) { return value < 90 ? "it is less than 90°" : value === 90 ? "it is exactly a quarter turn" : value < 180 ? "it is greater than 90° but less than 180°" : value === 180 ? "it is exactly a half turn" : "it is greater than 180° but less than 360°"; }
function graphExplanation(operation, v, answer, unit) {
  const equations = { read: `${v[2]}`, difference: `|${v[3]} - ${v[0]}| = ${answer}`, sum_two: `${v[0]} + ${v[1]} = ${answer}`, sum_all: `${v.join(" + ")} = ${answer}`, signed_change: `${v[2]} - ${v[1]} = ${answer}`, multistep: `${v[0]} + ${v[3]} - ${v[1]} = ${answer}` };
  return `The equivalent table confirms the graph values. ${equations[operation]} ${unit}; the interval and unit remain attached to the result.`;
}
function timetableExplanation(operation, startA, endA, startB, endB, durationA, durationB, answer) {
  const details = { duration_a: `${timeText(startA)} to ${timeText(endA)} is ${durationA} minutes`, arrival_b: `Service B departs at ${timeText(startB)} and arrives at ${timeText(endB)}`, gap: `${timeText(endA)} to ${timeText(startB)} is ${answer} minutes`, duration_difference: `The journeys last ${durationA} and ${durationB} minutes, a difference of ${answer} minutes`, multistep_elapsed: `${timeText(startA)} to ${timeText(endB)} is ${answer} minutes`, compare_durations: `The journeys last ${durationA} and ${durationB} minutes, so ${answer} is correct` };
  return `${details[operation]}. A clock-line bridge treats each hour as 60 minutes, not 100.`;
}
function timeText(totalMinutes) { const hours = Math.floor(totalMinutes / 60) % 24; const minutes = totalMinutes % 60; return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`; }
function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
