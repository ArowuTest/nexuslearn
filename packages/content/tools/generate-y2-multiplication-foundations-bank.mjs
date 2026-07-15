#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y2-multiplication-foundations.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y2-multiplication-foundations-bank-";
const reviewBatch = "y2-multiplication-foundations-pilot-a";
const pilotAllocation = {
  "build-and-check-equal-groups": 46,
  "arrays-and-commutative-turns": 46,
  "multiply-not-add-the-factors": 46,
  "sharing-grouping-and-inverse-facts": 46,
  "spaced-tables-and-parity-retrieval": 46,
};

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y2-multiplication-foundations") throw new Error("This generator only supports the Year 2 multiplication foundations pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, count]) => [id, count - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...equalGroupCandidates(targets["build-and-check-equal-groups"]),
  ...arrayCandidates(targets["arrays-and-commutative-turns"]),
  ...factCandidates(targets["multiply-not-add-the-factors"]),
  ...divisionCandidates(targets["sharing-grouping-and-inverse-facts"]),
  ...retrievalCandidates(targets["spaced-tables-and-parity-retrieval"]),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedGenerated = generated.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedGenerated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 2 multiplication-foundations pack with a deterministic 230-item pilot bank. Four curated variants are preserved alongside candidates spanning equal groups, arrays, repeated addition, 2/5/10 facts, commutativity, sharing, grouping, inverse checks, odd/even pairing and misconception repair. Every generated item includes concrete and visual alternatives, SEND sentence and interaction scaffolds, strategy feedback, unlimited thinking time and low-pressure progress based on completed reasoning rather than speed or streaks. Independent mathematics, teacher, accessibility and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, enrichedGenerated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-multiplication-foundations-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-multiplication-foundations-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y2-multiplication-foundations-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y2-multiplication-foundations-bank tables=${summary(generated, (variant) => variant.body.table_focus ?? "mixed")}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-multiplication-foundations-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 multiplication foundations bank is out of date; run generate-y2-multiplication-foundations-bank.mjs --write.");
  console.log("y2-multiplication-foundations-bank deterministic check passed");
} else {
  console.log("y2-multiplication-foundations-bank dry-run; pass --write to update the pack");
}

function equalGroupCandidates(count) {
  const facts = tableFacts();
  const objects = ["shells", "buttons", "counters", "leaves", "blocks"];
  return Array.from({ length: count }, (_, index) => {
    const { groups, size, total } = facts[index % facts.length];
    const object = objects[Math.floor(index / facts.length) % objects.length];
    const choices = numberChoices(total, groups + size, Math.max(1, total - size));
    return candidate({
      id: `groups-${groups}-of-${size}-${index + 1}`,
      format: "equal-groups-builder",
      blueprint: "build-and-check-equal-groups",
      band: "intro",
      prompt: `Build ${groups} equal groups with ${size} ${object} in each. How many ${object} altogether?`,
      body: { groups, group_size: size, object, choices: rotate(choices, index % choices.length), repeated_addition: repeatAddition(groups, size), equation_model: `${groups} × ${size} = ${total}`, table_focus: `${size}s`, interaction_mode: "auto_place_tap_number_or_build" },
      answer: total,
      hints: [`Make ${groups} hoops or trays first.`, `Put ${size} in every group, then count ${skipCount(groups, size)}.`],
      explanation: `${groups} equal groups of ${size} contain ${total}. The repeated addition is ${repeatAddition(groups, size)}, so ${groups} × ${size} = ${total}.`,
      difficulty: 2 + Math.floor(groups / 4),
      tag: index % 3 === 0 ? "unequal_groups_counted" : "groups_and_group_size_swapped",
      hook: "equal-groups-calm-check",
      correct: `Equal-group check complete: every group has ${size}, and the total is ${total}.`,
      repair: `Keep the ${groups} group mats. Fill one group at a time until each has exactly ${size}.`,
      scaffold: `There are __ groups. There are __ in each group. Altogether there are __.`,
      concrete: `Use ${groups} tactile hoops and ${total} large counters, or listen to each group being counted aloud.`,
    });
  });
}

function arrayCandidates(count) {
  const facts = tableFacts();
  const views = ["dot card", "peg board", "raised-dot card", "audio-described grid"];
  return Array.from({ length: count }, (_, index) => {
    const { groups: rows, size: columns, total } = facts[index % facts.length];
    const view = views[Math.floor(index / facts.length) % views.length];
    const correct = `${columns} × ${rows} = ${total}`;
    const choices = rotate([correct, `${rows} + ${columns} = ${rows + columns}`, `${columns} × ${rows} = ${total + columns}`, `${rows} × ${Math.max(1, columns - 1)} = ${rows * Math.max(1, columns - 1)}`], index % 4);
    return candidate({
      id: `array-${rows}-by-${columns}-${index + 1}`,
      format: "array-turn",
      blueprint: "arrays-and-commutative-turns",
      band: "developing",
      prompt: `A ${view} has ${rows} rows of ${columns}. Which fact describes the same array after a quarter turn?`,
      body: { array: { rows, columns, total }, turned_array: { rows: columns, columns: rows, total }, choices, repeated_additions: [repeatAddition(rows, columns), repeatAddition(columns, rows)], table_focus: `${columns}s`, interaction_mode: "turn_model_or_compare_static_panels" },
      answer: correct,
      hints: ["A turn swaps the rows and columns.", `Count the same ${total} dots before and after the turn.`],
      explanation: `${rows} × ${columns} and ${columns} × ${rows} both equal ${total}. Turning an array changes its view, not its number of dots. This commutative rule is for multiplication, not division.`,
      difficulty: 3 + Math.floor(rows / 5),
      tag: index % 3 === 0 ? "array_turn_changes_total" : "commutativity_applied_to_division",
      hook: "array-static-or-quarter-turn",
      correct: `Array link found: ${rows} × ${columns} and ${columns} × ${rows} have the same total.`,
      repair: "Trace one row, then one column. After the turn those labels swap, but no dots are added or removed.",
      scaffold: `Before: __ rows of __. After: __ rows of __. Both totals are __.`,
      concrete: `Use a fixed ${rows}-by-${columns} peg board, a raised-dot rectangle, or two static labelled diagrams.`,
    });
  });
}

function factCandidates(count) {
  const facts = tableFacts();
  const contexts = ["bicycle wheels", "hands of five fingers", "packs of ten pencils", "pairs of socks", "five-frame cards"];
  return Array.from({ length: count }, (_, index) => {
    const { groups, size, total } = facts[index % facts.length];
    const context = contexts[Math.floor(index / facts.length) % contexts.length];
    const correct = `${groups} × ${size} = ${total}`;
    const choices = rotate([correct, `${groups} + ${size} = ${groups + size}`, `${groups} × ${size} = ${total + size}`, `${groups + 1} × ${size} = ${(groups + 1) * size}`], index % 4);
    return candidate({
      id: `fact-${groups}-times-${size}-${index + 1}`,
      format: "fact-family-choice",
      blueprint: "multiply-not-add-the-factors",
      band: "expected",
      prompt: `The model shows ${groups} equal groups of ${size} using ${context}. Which multiplication statement matches?`,
      body: { groups, group_size: size, total, context, choices, repeated_addition: repeatAddition(groups, size), skip_count: skipCount(groups, size), table_focus: `${size}s`, interaction_mode: "choose_equation_build_groups_or_say_fact" },
      answer: correct,
      hints: [`Read it as ${groups} groups of ${size}.`, `Check with ${repeatAddition(groups, size)}.`],
      explanation: `${groups} groups of ${size} means ${repeatAddition(groups, size)} = ${total}, so the matching statement is ${correct}. Adding the two factors would describe a different calculation.`,
      difficulty: 4 + Math.floor(groups / 6),
      tag: index % 2 === 0 ? "factors_added" : "repeated_addition_mismatch",
      hook: "groups-addition-equation-link",
      correct: `Representation matched: groups, repeated addition and ${correct} all show ${total}.`,
      repair: `Point to each whole group while saying ${size}; do not add only the labels ${groups} and ${size}.`,
      scaffold: `__ groups of __ is __ + __ ... = __, so __ × __ = __.`,
      concrete: `Build the groups with counters on a mat, use a printed array, or hear the ${size}s skip-count sequence.`,
    });
  });
}

function divisionCandidates(count) {
  const facts = tableFacts().filter(({ total }) => total >= 10);
  const contexts = ["counters", "cards", "shells", "blocks"];
  return Array.from({ length: count }, (_, index) => {
    const { groups, size, total } = facts[index % facts.length];
    const sharing = index % 2 === 0;
    const object = contexts[Math.floor(index / facts.length) % contexts.length];
    const answer = sharing ? size : groups;
    const prompt = sharing
      ? `Share ${total} ${object} equally into ${groups} trays. How many go in each tray?`
      : `Make groups of ${size} from ${total} ${object}. How many equal groups can be made?`;
    const choices = rotate(numberChoices(answer, sharing ? groups : size, total), index % 4);
    return candidate({
      id: `${sharing ? "share" : "group"}-${total}-${groups}-${size}-${index + 1}`,
      format: "share-group-divide",
      blueprint: "sharing-grouping-and-inverse-facts",
      band: "secure",
      prompt,
      body: { division_meaning: sharing ? "sharing_known_number_of_groups" : "grouping_known_group_size", total, number_of_groups: groups, group_size: size, object, choices, inverse_check: `${groups} × ${size} = ${total}`, equation_model: sharing ? `${total} ÷ ${groups} = ${size}` : `${total} ÷ ${size} = ${groups}`, table_focus: `${size}s`, interaction_mode: "auto_deal_step_build_or_choose" },
      answer,
      hints: sharing ? ["Give one to each tray, then repeat.", `Check that all ${groups} trays contain the same number.`] : [`Make one complete group of ${size} at a time.`, "Count the completed groups, not the objects in one group."],
      explanation: sharing
        ? `${total} shared into ${groups} equal groups gives ${size} in each. Check: ${groups} × ${size} = ${total}.`
        : `${total} arranged in groups of ${size} makes ${groups} groups. Check: ${groups} × ${size} = ${total}.`,
      difficulty: 5 + (total > 50 ? 1 : 0),
      tag: sharing ? "division_role_reversal" : "groups_confused_with_group_size",
      hook: "sharing-grouping-meaning-toggle",
      correct: `Division check complete: the equal groups rebuild ${total} using ${groups} × ${size}.`,
      repair: sharing ? "The number of trays is known. Deal equally, then count what is in one tray." : `The group size is known. Ring sets of ${size}, then count the rings.`,
      scaffold: sharing ? `__ shared into __ trays gives __ in each.` : `__ arranged in groups of __ makes __ groups.`,
      concrete: `Use large counters and tactile trays, a step-by-step auto-deal, or an audio description after each complete group.`,
    });
  });
}

function retrievalCandidates(count) {
  const facts = tableFacts();
  const modes = ["fact", "missing factor", "parity", "division"];
  return Array.from({ length: count }, (_, index) => {
    const { groups, size, total } = facts[index % facts.length];
    const mode = modes[Math.floor(index / facts.length) % modes.length];
    if (mode === "parity") {
      const quantity = total === 100 ? 99 : total + (index % 2);
      const answer = quantity % 2 === 0 ? "even" : "odd";
      return candidate({
        id: `retrieval-parity-${quantity}-${index + 1}`, format: "odd-even-pair", blueprint: "spaced-tables-and-parity-retrieval", band: "retrieval",
        prompt: `Pair-check ${quantity} counters. Is the quantity odd or even?`,
        body: { quantity, choices: ["odd", "even"], pair_model: `${Math.floor(quantity / 2)} pairs${quantity % 2 ? " and 1 left over" : " with none left over"}`, table_focus: "2s", interaction_mode: "pair_reveal_build_or_choose" },
        answer, hints: ["Make groups of two.", quantity % 2 ? "Check whether one counter has no partner." : "Check whether every counter has a partner."],
        explanation: `${quantity} is ${answer} because pairing makes ${Math.floor(quantity / 2)} complete pairs${quantity % 2 ? " with one left over" : " with none left over"}.`,
        difficulty: 3 + (quantity > 50 ? 1 : 0), tag: "odd_even_without_pairs", hook: "pair-and-leftover-static-reveal",
        correct: `Pair evidence found: ${quantity} is ${answer}.`, repair: "Use the pair mat or tap PAIR REVEAL; the label must match whether a counter remains.",
        scaffold: `I made __ pairs. There ${quantity % 2 ? "is" : "is not"} one left, so __ is __.`, concrete: "Use a tactile two-column pairing mat, static paired dots, or spoken pairs with one-left-over narration.",
      });
    }
    const data = retrievalData(mode, groups, size, total);
    return candidate({
      id: `retrieval-${mode}-${groups}-${size}-${index + 1}`, format: "odd-even-pair", blueprint: "spaced-tables-and-parity-retrieval", band: "retrieval",
      prompt: data.prompt,
      body: { groups, group_size: size, total, choices: rotate(data.choices, index % data.choices.length), table_focus: `${size}s`, strategy_options: ["equal groups", "array", "skip count", "known fact"], interaction_mode: "choose_build_or_explain_strategy" },
      answer: data.answer, hints: data.hints, explanation: data.explanation,
      difficulty: 3 + Math.floor(groups / 5), tag: data.tag, hook: "calm-strategy-retrieval-path",
      correct: `Practice marker earned for using or checking a strategy; no speed score is recorded. ${data.explanation}`,
      repair: "Choose one strategy card: build groups, view an array, skip-count, or use a known related fact.",
      scaffold: `I used __. I know __ because __.`, concrete: "Keep counters, an array card and an audio skip-count available before and after answering.",
    });
  });
}

function retrievalData(mode, groups, size, total) {
  if (mode === "missing factor") return {
    prompt: `${groups} equal groups contain ${total} counters. How many counters are in each group?`,
    answer: size, choices: numberChoices(size, groups, total), hints: [`Build ${groups} equal groups.`, `Check ${groups} × __ = ${total}.`],
    explanation: `${groups} × ${size} = ${total}, so each group contains ${size}.`, tag: "groups_and_group_size_swapped",
  };
  if (mode === "division") return {
    prompt: `How many groups of ${size} can be made from ${total}?`,
    answer: groups, choices: numberChoices(groups, size, total), hints: [`Ring groups of ${size}.`, `Use ${groups} × ${size} = ${total} to check.`],
    explanation: `${total} ÷ ${size} = ${groups} because ${groups} groups of ${size} make ${total}.`, tag: "division_role_reversal",
  };
  const answer = total;
  return {
    prompt: `Use any calm strategy to find ${groups} × ${size}. What is the product?`,
    answer, choices: numberChoices(total, groups + size, Math.max(1, total - size)), hints: ["Build equal groups or picture an array.", `You may skip-count in ${size}s: ${skipCount(groups, size)}.`],
    explanation: `${groups} groups of ${size} total ${total}. Equal groups, arrays and repeated addition all confirm the fact.`, tag: "factors_added",
  };
}

function candidate({ id, format, blueprint, band, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair, scaffold, concrete }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt, ...body,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_or_oral",
      supported_interaction: "adult_or_peer_may_read_scan_point_auto_place_and_record_without_answering",
      sentence_scaffold: scaffold,
      concrete_alternative: concrete,
      visual_alternative: "high-contrast labelled groups, static arrays and text-equivalent descriptions",
      audio_replay: true,
      static_model: true,
      reduced_motion: "instant_state_change",
      no_timer: true,
      retry_without_penalty: true,
      strategy_choice_preserved: true,
      low_pressure_gamification: "one_path_tile_for_completed_reasoning; no countdown, leaderboard, streak loss or speed bonus",
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, strategy: explanation },
    difficulty, status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const responseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  let builderContract;
  if (variant.format === "equal-groups-builder") {
    const structured = body.repeated_addition !== undefined && body.equation_model !== undefined;
    builderContract = {
      kind: "equal_groups",
      mode: structured ? "structured_model" : "authored_choice",
      groups_key: "groups",
      group_size_key: "group_size",
      total_source: structured ? "expected_answer" : "expected_answer",
      repeated_addition_key: structured ? "repeated_addition" : null,
      equation_key: structured ? "equation_model" : null,
      table_focus_key: structured ? "table_focus" : null,
      drag_required: false,
      response_modes: responseModes,
    };
  } else if (variant.format === "array-turn") {
    const structured = body.array !== undefined && body.turned_array !== undefined;
    builderContract = {
      kind: "array_turn",
      mode: structured ? "structured_model" : "authored_choice",
      array_key: structured ? "array" : null,
      turned_array_key: structured ? "turned_array" : null,
      same_total_required: true,
      rows_and_columns_swap: true,
      drag_required: false,
      response_modes: responseModes,
    };
  } else if (variant.format === "share-group-divide") {
    const structured = body.group_size !== undefined && body.inverse_check !== undefined;
    builderContract = {
      kind: "share_group_divide",
      mode: structured ? "structured_model" : "authored_choice",
      total_key: "total",
      number_of_groups_key: "number_of_groups",
      group_size_key: structured ? "group_size" : null,
      division_meaning_key: structured ? "division_meaning" : null,
      inverse_check_key: structured ? "inverse_check" : null,
      drag_required: false,
      response_modes: responseModes,
    };
  }
  return builderContract ? { ...variant, body: { ...body, builder_contract: builderContract } } : variant;
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} variants, found ${currentPack.question_variants.length}.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of currentPack.question_variants.filter((item) => ["equal-groups-builder", "array-turn", "share-group-divide"].includes(item.format))) validateBuilderContract(variant);
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format || variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} does not match its blueprint.`);
    if (variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} must remain in review.`);
    for (const field of ["supported_interaction", "sentence_scaffold", "concrete_alternative", "visual_alternative", "low_pressure_gamification"]) if (!variant.body[field]) throw new Error(`${variant.id} is missing ${field}.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze")) throw new Error(`${variant.id} lacks SEND response routes.`);
    if (variant.body.no_timer !== true || variant.body.retry_without_penalty !== true || variant.body.strategy_choice_preserved !== true) throw new Error(`${variant.id} has speed or strategy pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.strategy) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 2 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one answer.`);
    if (variant.body.prompt.length > 130) throw new Error(`${variant.id} prompt is too long for Year 2.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  for (const size of [2, 5, 10]) if (!generated.some((variant) => variant.body.table_focus === `${size}s`)) throw new Error(`Missing ${size} times-table coverage.`);
}

function validateBuilderContract(variant) {
  const body = variant.body ?? {};
  const contract = body.builder_contract;
  const requiredResponseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  if (!contract || contract.drag_required !== false || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible multiplication builder contract.`);
  if (variant.format === "equal-groups-builder") {
    if (contract.kind !== "equal_groups") throw new Error(`${variant.id} has the wrong equal-groups contract.`);
    if (contract.mode === "structured_model") {
      if (!Number.isInteger(body.groups) || !Number.isInteger(body.group_size) || body.groups < 1 || body.group_size < 1 || body.groups * body.group_size !== variant.expected_answer.value) throw new Error(`${variant.id} has invalid equal-group arithmetic.`);
      if (!body[contract.repeated_addition_key] || !body[contract.equation_key] || !body[contract.table_focus_key]) throw new Error(`${variant.id} lacks equal-group representation links.`);
    } else if (contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown equal-groups mode.`);
  } else if (variant.format === "array-turn") {
    if (contract.kind !== "array_turn") throw new Error(`${variant.id} has the wrong array-turn contract.`);
    if (contract.mode === "structured_model") {
      const array = body[contract.array_key], turned = body[contract.turned_array_key];
      if (!array || !turned || array.rows !== turned.columns || array.columns !== turned.rows || array.total !== turned.total || array.rows * array.columns !== array.total) throw new Error(`${variant.id} has an invalid turned-array model.`);
    } else if (contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown array-turn mode.`);
  } else if (variant.format === "share-group-divide") {
    if (contract.kind !== "share_group_divide") throw new Error(`${variant.id} has the wrong division builder contract.`);
    if (contract.mode === "structured_model") {
      if (!Number.isInteger(body[contract.total_key]) || !Number.isInteger(body[contract.number_of_groups_key]) || !Number.isInteger(body[contract.group_size_key]) || body[contract.total_key] !== body[contract.number_of_groups_key] * body[contract.group_size_key] || !body[contract.inverse_check_key]) throw new Error(`${variant.id} has invalid sharing/grouping arithmetic.`);
    } else if (contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown sharing/grouping mode.`);
  }
}

function tableFacts() {
  const facts = [];
  for (const size of [2, 5, 10]) for (let groups = 2; groups <= 10; groups += 1) facts.push({ groups, size, total: groups * size });
  return facts;
}
function numberChoices(answer, distractorA, distractorB) {
  const values = [answer, distractorA, distractorB, answer + (answer < 10 ? 2 : 5)].filter((value) => Number.isInteger(value) && value >= 0);
  for (let value = 1; new Set(values).size < 4; value += 1) values.push(answer + value);
  return [...new Set(values)].slice(0, 4);
}
function repeatAddition(groups, size) { return `${Array.from({ length: groups }, () => size).join(" + ")} = ${groups * size}`; }
function skipCount(groups, size) { return Array.from({ length: groups }, (_, index) => (index + 1) * size).join(", "); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
