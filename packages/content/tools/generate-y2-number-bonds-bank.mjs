#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/ma-y2-number-bonds.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y2-number-bonds-bank-";
const reviewBatch = "y2-number-bonds-pilot-a";
const allocation = {
  "fluent-bonds-within-twenty": 44,
  "four-facts-one-model": 44,
  "scaled-tens-bonds": 44,
  "bridge-and-balance-transfer": 44,
  "spaced-related-fact-retrieval": 44,
};
const treasures = ["moon stones", "map tiles", "seed pods", "shell tokens", "robot bolts", "story cards", "crystal beads", "garden stars"];
const reviewDays = [1, 3, 7, 14, 30];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y2-number-bonds") throw new Error("This generator only supports the Year 2 number-bonds pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedBlueprint = new Map([
  ["ma-y2-number-bonds-q-family", "four-facts-one-model"],
  ["ma-y2-number-bonds-q-scale", "scaled-tens-bonds"],
  ["ma-y2-number-bonds-q-bridge", "bridge-and-balance-transfer"],
  ["ma-y2-number-bonds-q-balance", "bridge-and-balance-transfer"],
]);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...fluentCandidates(targets["fluent-bonds-within-twenty"]),
  ...familyCandidates(targets["four-facts-one-model"]),
  ...scaledCandidates(targets["scaled-tens-bonds"]),
  ...bridgeCandidates(targets["bridge-and-balance-transfer"]),
  ...retrievalCandidates(targets["spaced-related-fact-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 2 number-bonds pack with a deterministic 220-variant pilot bank. Four curated variants are unchanged. Generated tasks develop fluent bonds within 20, complements, commutativity, inverse subtraction, missing parts, four-fact families, related multiples-of-ten facts and bonds to 100, bridging through ten, balanced equations, short contexts, misconception diagnosis, checking and spaced transfer. Every generated task offers ten-frame, part-whole and number-line routes, reduced-load SEND/dyscalculia supports, alternative inputs, rich corrective feedback and pressure-free missions without timers, streaks, lives or loss. Selected narrated contexts reference ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent mathematics, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated, curatedBlueprint);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-number-bonds-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-number-bonds-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y2-number-bonds-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y2-number-bonds-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-number-bonds-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 number-bonds bank is out of date; run generate-y2-number-bonds-bank.mjs --write.");
  console.log("y2-number-bonds-bank deterministic check passed");
} else console.log("y2-number-bonds-bank dry-run; pass --write to update the pack");

function fluentCandidates(count) {
  const modes = ["missing_part", "complement_to_ten", "complement_to_twenty", "known_bond_check", "unknown_position"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], whole = 6 + ((i * 7) % 15), part = (i * 5 + 2) % (whole + 1), missing = whole - part;
    if (mode === "complement_to_ten" || mode === "complement_to_twenty") {
      const target = mode === "complement_to_ten" ? 10 : 20, known = mode === "complement_to_ten" ? 1 + (i % 9) : 10 + (i % 10), answer = target - known;
      return bond({ id: `${mode}-${known}-${i + 1}`, format: "part-whole-family", blueprint: "fluent-bonds-within-twenty", band: "intro", concept: mode,
        prompt: `Hidden-part mission ${i + 1}: ${known} and what make ${target}?`, whole: target, part: known, missing: answer,
        body: { choices: numberChoices(answer, target), flash_frame_then_optional_check: true, response_sequence: "retrieve_then_verify" },
        explanation: `${known} + ${answer} = ${target}; ${answer} is the complement of ${known} to ${target}.`, tag: "recounts_known_bond", hook: "frame-flash-check" });
    }
    const equation = mode === "unknown_position" ? `□ + ${part} = ${whole}` : `${part} + □ = ${whole}`;
    return bond({ id: `${mode}-${whole}-${part}-${i + 1}`, format: "part-whole-family", blueprint: "fluent-bonds-within-twenty", band: mode === "known_bond_check" ? "developing" : "intro", concept: mode,
      prompt: `Bond-lantern mission ${i + 1}: complete ${equation}.`, whole, part, missing,
      body: { equation, choices: numberChoices(missing, whole), ten_frame_check_available: true, number_line_check: [part, whole], unknown_position: mode === "unknown_position" ? "left" : "right" },
      explanation: `${part} and ${missing} are the two parts of ${whole}. Check: ${part} + ${missing} = ${whole}.`, tag: mode === "unknown_position" ? "equals_answer_last" : "recounts_known_bond", hook: "bond-lantern-hidden-part" });
  });
}

function familyCandidates(count) {
  const modes = ["four_fact_family", "commutative_addition", "inverse_subtraction", "cover_a_part", "equation_orientation"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], whole = 8 + ((i * 7) % 13), a = 1 + ((i * 5) % (whole - 1)), b = whole - a;
    const facts = [`${a} + ${b} = ${whole}`, `${b} + ${a} = ${whole}`, `${whole} − ${a} = ${b}`, `${whole} − ${b} = ${a}`];
    if (mode === "four_fact_family") return family({ id: `four-${whole}-${a}-${i + 1}`, concept: mode, prompt: `Family-tree mission ${i + 1}: choose all four facts shown by parts ${a}, ${b} and whole ${whole}.`, whole, a, b,
      body: { choices: [...facts, `${a} − ${b} = ${Math.max(0, a - b)}`], select_count: 4 }, answer: facts,
      explanation: `The fixed relationship has parts ${a}, ${b} and whole ${whole}; it gives two commutative additions and two inverse subtractions.`, tag: "facts_seen_as_unrelated", hook: "fact-family-branches" });
    if (mode === "commutative_addition") return family({ id: `turn-${whole}-${a}-${i + 1}`, concept: mode, prompt: `Turnaround mission ${i + 1}: ${a} + ${b} = ${whole}. Which fact turns the parts around but keeps the whole?`, whole, a, b,
      body: { choices: [`${b} + ${a} = ${whole}`, `${whole} + ${a} = ${whole + a}`, `${a} − ${b} = ${Math.max(0, a - b)}`] }, answer: `${b} + ${a} = ${whole}`,
      explanation: `${a} + ${b} and ${b} + ${a} both equal ${whole}. Addition is commutative; the part-whole relationship is unchanged.`, tag: "turnaround_changes_whole", hook: "part-cards-turn" });
    if (mode === "inverse_subtraction" || mode === "cover_a_part") {
      const answer = `${whole} − ${a} = ${b}`;
      return family({ id: `${mode}-${whole}-${a}-${i + 1}`, concept: mode, prompt: `Cover-and-reveal mission ${i + 1}: cover part ${a} in whole ${whole}. Which inverse fact finds the visible part?`, whole, a, b,
        body: { covered_part: a, visible_part: b, choices: [answer, `${a} + ${whole} = ${a + whole}`, `${a} − ${b} = ${Math.max(0, a - b)}`] }, answer,
        explanation: `Start with whole ${whole}; remove covered part ${a}; visible part ${b} remains. Thus ${answer}.`, tag: "subtraction_not_linked_to_addition", hook: "cover-part-reveal" });
    }
    const answer = `${whole} = ${a} + ${b}`;
    return family({ id: `orientation-${whole}-${a}-${i + 1}`, concept: mode, prompt: `Equality-gate mission ${i + 1}: choose the true equation with the whole written first.`, whole, a, b,
      body: { choices: [answer, `${whole} = ${a} − ${b}`, `${a} + ${whole} = ${b}`], equals_means_same_value: true }, answer,
      explanation: `${whole} = ${a} + ${b} is true because both sides have value ${whole}; equals does not mean “the answer comes next”.`, tag: "equals_answer_last", hook: "equality-gate" });
  });
}

function scaledCandidates(count) {
  const modes = ["scale_all_values", "missing_tens_part", "inverse_tens_fact", "bonds_to_hundred", "related_place_value_fact"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], a = 1 + (i % 9), b = 10 - a, tensA = 10 * a, tensB = 10 * b;
    if (mode === "inverse_tens_fact") {
      const answer = `${100} − ${tensA} = ${tensB}`;
      return scaled({ id: `inverse-${a}-${i + 1}`, concept: mode, prompt: `Tens-family mission ${i + 1}: use ${a} + ${b} = 10 to choose a related subtraction from 100.`, a, b,
        body: { known_fact: `${a} + ${b} = 10`, choices: [answer, `${100} − ${a} = ${tensB}`, `${tensA} − ${tensB} = 100`] }, answer,
        explanation: `${tensA} + ${tensB} = 100, so the inverse fact is ${answer}.`, tag: "inverse_facts_unconnected", hook: "tens-family-branches" });
    }
    if (mode === "bonds_to_hundred" || mode === "missing_tens_part") {
      return scaled({ id: `${mode}-${a}-${i + 1}`, concept: mode, prompt: `Hundred-vault mission ${i + 1}: ${tensA} and what make 100?`, a, b,
        body: { equation: `${tensA} + □ = 100`, choices: [tensB, b, tensA, clamp(tensB + 10, 0, 100)], hundred_frame_rows: 10 }, answer: tensB,
        explanation: `${a} + ${b} = 10 scales to ${tensA} + ${tensB} = 100 because every value is ten times as large.`, tag: "partial_scale_change", hook: "hundred-vault-scale" });
    }
    const answer = `${tensA} + ${tensB} = 100`;
    return scaled({ id: `${mode}-${a}-${i + 1}`, concept: mode, prompt: `Scale-board mission ${i + 1}: change every value in ${a} + ${b} = 10 into tens.`, a, b,
      body: { known_fact: `${a} + ${b} = 10`, scaled_values: [tensA, tensB, 100], choices: [answer, `${tensA} + ${b} = 100`, `${tensA} + ${tensB} = 10`], simultaneous_scale_required: true }, answer,
      explanation: `One becomes one ten in every position, so ${a} + ${b} = 10 becomes ${answer}.`, tag: "partial_scale_change", hook: "ones-to-tens-scale" });
  });
}

function bridgeCandidates(count) {
  const modes = ["bridge_to_twenty", "bridge_next_ten", "balanced_equation", "unknown_left_side", "split_to_bridge", "diagnose_balance"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], teen = 11 + (i % 9), complement = 20 - teen;
    if (mode === "bridge_to_twenty") return balance({ id: `bridge20-${teen}-${i + 1}`, concept: mode, prompt: `Bridge-light mission ${i + 1}: use the ones bond to complete ${teen} + □ = 20.`,
      body: { equation: `${teen} + □ = 20`, known_bond: `${ones(teen)} + ${complement} = 10`, choices: numberChoices(complement, 20), parallel_ten_frames: true }, answer: complement,
      explanation: `${ones(teen)} needs ${complement} to make 10, so ${teen} needs ${complement} to reach 20.`, tag: "recounts_known_bond", hook: "parallel-frame-bridge" });
    if (mode === "bridge_next_ten" || mode === "split_to_bridge") {
      const start = 21 + ((i * 7) % 59), toTen = 10 - ones(start), add = toTen + 1 + (i % 5), answer = start + add;
      return balance({ id: `${mode}-${start}-${add}-${i + 1}`, concept: mode, prompt: `Number-line bridge ${i + 1}: solve ${start} + ${add} by reaching the next ten first.`,
        body: { calculation: `${start} + ${add}`, split_addend: [toTen, add - toTen], bridge_point: start + toTen, choices: numberChoices(answer, 100), number_line_jumps: [toTen, add - toTen] }, answer,
        explanation: `Split ${add} into ${toTen} and ${add - toTen}: ${start} + ${toTen} = ${start + toTen}, then add ${add - toTen} to reach ${answer}.`, tag: "bridge_part_not_conserved", hook: "number-line-next-ten" });
    }
    if (mode === "unknown_left_side") {
      const rightA = 10 + (i % 8), rightB = 2 + (i % 6), total = rightA + rightB, known = 5 + (i % 7), answer = total - known;
      return balance({ id: `unknown-left-${total}-${known}-${i + 1}`, concept: mode, prompt: `Balance-builder mission ${i + 1}: complete □ + ${known} = ${rightA} + ${rightB}.`,
        body: { left_expression: `□ + ${known}`, right_expression: `${rightA} + ${rightB}`, total, choices: numberChoices(answer, total), unknown_position: "left_of_equals" }, answer,
        explanation: `The right side totals ${total}; ${answer} + ${known} also totals ${total}, so both sides are equal.`, tag: "equals_answer_last", hook: "balance-unknown-left" });
    }
    if (mode === "diagnose_balance") {
      const leftA = 12 + (i % 8), leftB = 8 - (i % 4), total = leftA + leftB, shown = total - 1;
      const answer = "The right side is one too small; both sides must have the same value.";
      return balance({ id: `diagnose-${total}-${i + 1}`, concept: mode, prompt: `Balance-repair mission ${i + 1}: a helper says ${leftA} + ${leftB} = 10 + ${shown - 10}. What needs repairing?`,
        body: { left_expression: `${leftA} + ${leftB}`, right_expression: `10 + ${shown - 10}`, values: [total, shown], choices: [answer, "Equals means the right side can be smaller.", "Only the final digit needs to match."] }, answer,
        explanation: `${leftA} + ${leftB} = ${total}, but 10 + ${shown - 10} = ${shown}; equal means both complete expressions have the same value.`, tag: "equals_answer_last", hook: "balance-repair" });
    }
    const total = teen + complement, rightKnown = 10, answer = total - rightKnown;
    return balance({ id: `balanced-${teen}-${i + 1}`, concept: mode, prompt: `Equal-path mission ${i + 1}: complete ${teen} + ${complement} = ${rightKnown} + □.`,
      body: { left_expression: `${teen} + ${complement}`, right_expression: `${rightKnown} + □`, total, choices: numberChoices(answer, total), balance_bars: true }, answer,
      explanation: `The left side totals ${total}; ${rightKnown} + ${answer} also totals ${total}, so the equation balances.`, tag: "equals_answer_last", hook: "equation-balance-settle" });
  });
}

function retrievalCandidates(count) {
  const modes = ["context_missing_part", "context_inverse", "representation_transfer", "misconception_repair", "spaced_bond", "check_with_inverse", "scaled_transfer", "bridge_context"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], whole = 10 + ((i * 7) % 11), part = 2 + ((i * 5) % (whole - 2)), missing = whole - part, treasure = treasures[i % treasures.length], day = reviewDays[i % reviewDays.length];
    if (mode === "misconception_repair") {
      const answer = "Keep the same two parts and whole; cover a part to derive subtraction.";
      return retrieval({ id: `repair-${whole}-${part}-${i + 1}`, concept: mode, prompt: `Repair-map mission ${i + 1}: a helper knows ${part} + ${missing} = ${whole} but guesses ${whole} − ${part}. Which repair is best?`,
        body: { known_fact: `${part} + ${missing} = ${whole}`, choices: [answer, "Recount unrelated objects from one.", "Change the whole before subtracting."], review_interval_days: day }, answer,
        explanation: `The same model shows ${whole} − ${part} = ${missing}; addition and subtraction facts are connected.`, tag: "facts_seen_as_unrelated", hook: "repair-map-cover-part" });
    }
    if (mode === "representation_transfer") {
      const answer = `${part} and ${missing} make ${whole}`;
      return retrieval({ id: `transfer-${whole}-${part}-${i + 1}`, concept: mode, prompt: `Model-translator mission ${i + 1}: which statement matches the ten-frame, part-whole mat and number line?`,
        body: { whole, parts: [part, missing], representations: ["ten/twenty-frame", "part-whole", "number line"], choices: [answer, `${part} is the whole and ${whole} is a part`, "The models show different quantities"], review_interval_days: day }, answer,
        explanation: `All three models preserve parts ${part}, ${missing} and whole ${whole}; changing representation does not change the bond.`, tag: "representation_changes_relationship", hook: "model-translator" });
    }
    if (mode === "scaled_transfer") {
      const a = 1 + (i % 9), b = 10 - a, answer = 10 * b;
      return retrieval({ id: `scaled-${a}-${i + 1}`, concept: mode, prompt: `Memory-scale mission ${i + 1}: after ${day} days, use ${a} + ${b} = 10 to complete ${10 * a} + □ = 100.`,
        body: { known_fact: `${a} + ${b} = 10`, equation: `${10 * a} + □ = 100`, choices: [answer, b, 10 * a, clamp(answer + 10, 0, 100)], review_interval_days: day }, answer,
        explanation: `Scaling every value by ten gives ${10 * a} + ${answer} = 100.`, tag: "partial_scale_change", hook: "memory-scale" });
    }
    if (mode === "bridge_context") {
      const teen = 11 + (i % 9), needed = 20 - teen;
      return retrieval({ id: `bridge-context-${teen}-${i + 1}`, concept: mode, prompt: `A tray has ${teen} ${treasure}. How many more fill two complete ten-frames?`,
        body: { start: teen, target: 20, choices: numberChoices(needed, 20), known_ones_bond: `${ones(teen)} + ${needed} = 10`, review_interval_days: day }, answer: needed,
        explanation: `${ones(teen)} and ${needed} complete the second ten, so ${teen} + ${needed} = 20.`, tag: "recounts_known_bond", hook: "context-frame-bridge", audioScript: i % 2 === 0 ? `A tray has ${teen} ${treasure}. How many more fill two complete ten-frames?` : undefined });
    }
    if (mode === "check_with_inverse" || mode === "context_inverse") {
      const answer = `${whole} − ${part} = ${missing}`;
      return retrieval({ id: `${mode}-${whole}-${part}-${i + 1}`, concept: mode, prompt: `Check-tool mission ${i + 1}: ${part} + ${missing} = ${whole}. Which inverse checks the missing part?`,
        body: { known_fact: `${part} + ${missing} = ${whole}`, choices: [answer, `${part} − ${whole} = ${missing}`, `${whole} + ${part} = ${missing}`], review_interval_days: day }, answer,
        explanation: `Start with whole ${whole} and subtract known part ${part}; ${missing} remains.`, tag: "inverse_facts_unconnected", hook: "inverse-check-tool" });
    }
    const prompt = mode === "context_missing_part" ? `${part} ${treasure} are visible. There are ${whole} altogether. How many are hidden?` : `After ${day} days, complete ${part} + □ = ${whole}.`;
    return retrieval({ id: `${mode}-${whole}-${part}-${i + 1}`, concept: mode, prompt: `Memory-map mission ${i + 1}: ${prompt}`,
      body: { whole, known_part: part, missing_part: missing, choices: numberChoices(missing, whole), review_interval_days: day }, answer: missing,
      explanation: `${part} + ${missing} = ${whole}; inverse check: ${whole} − ${part} = ${missing}.`, tag: "missing_part_guess", hook: "memory-map-bond", audioScript: mode === "context_missing_part" ? prompt : undefined });
  });
}

function bond({ id, format, blueprint, band, concept, prompt, whole, part, missing, body, explanation, tag, hook }) {
  return candidate({ id, format, blueprint, band, concept, prompt, body: { whole, known_part: part, missing_part: missing, parts: [part, missing], ...body }, answer: missing,
    hints: ["Name the whole and the known part.", "Use the structured frame or count from the known part only if recall needs checking."], explanation, correct: `The two parts account for the whole. ${explanation}`, repair: "Keep the whole visible, cover the known part and reveal or count only the missing part; preserve all correct placements.", tag, hook });
}

function family({ id, concept, prompt, whole, a, b, body, answer, explanation, tag, hook }) {
  return candidate({ id, format: "part-whole-family", blueprint: "four-facts-one-model", band: "developing", concept, prompt, body: { whole, parts: [a, b], ...body }, answer,
    hints: ["Keep the same whole and two parts.", "Addition combines parts; subtraction starts with the whole."], explanation, correct: `Fact matched to the conserved part-whole model. ${explanation}`, repair: "Build one fixed part-whole model, cover one part for subtraction and turn only the two part cards for commutative addition.", tag, hook });
}

function scaled({ id, concept, prompt, a, b, body, answer, explanation, tag, hook }) {
  return candidate({ id, format: "ten-frame-scale", blueprint: "scaled-tens-bonds", band: "expected", concept, prompt, body: { source_bond: { parts: [a, b], whole: 10 }, scaled_bond: { parts: [10 * a, 10 * b], whole: 100 }, ...body }, answer,
    hints: ["Exchange every one for one ten.", "All three values scale together; check the new whole is 100."], explanation, correct: `All values scaled consistently. ${explanation}`, repair: "Use before/after panels and exchange each source counter for one ten-rod in both parts and the whole.", tag, hook });
}

function balance({ id, concept, prompt, body, answer, explanation, tag, hook }) {
  return candidate({ id, format: "balance-equation", blueprint: "bridge-and-balance-transfer", band: "secure", concept, prompt, body, answer,
    hints: ["Find the value of each complete side or bridge to the next ten.", "Equal means both sides have the same value, wherever the unknown appears."], explanation, correct: `Bridge or balance relationship checked. ${explanation}`, repair: "Build each expression as a static bar, label its total and change only the unknown part until both complete values match.", tag, hook });
}

function retrieval({ id, concept, prompt, body, answer, explanation, tag, hook, audioScript }) {
  return candidate({ id, format: "balance-equation", blueprint: "spaced-related-fact-retrieval", band: "retrieval", concept, prompt, body, answer,
    hints: ["Choose the known bond, model or inverse that fits this relationship.", "Check without changing the whole or either part."], explanation, correct: `Spaced relationship retained and checked. ${explanation}`, repair: "Return to the last secure representation, rebuild one relationship slowly and transfer it back without any speed score.", tag, hook, audioScript });
}

function candidate({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_use_picture_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_concrete_or_symbolic_task" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, move named counters or record the child's indicated fact without supplying the missing number.",
      ten_frame_route: "Use one or two structured frames with optional brief flash followed by an always-available static check.",
      part_whole_route: "Use tactile or visual labelled PART, PART and WHOLE regions; correct cards remain in place during repair.",
      number_line_route: "Use static labelled jumps to a target ten or between a known part and whole.",
      dyscalculia_support: { structured_quantity_patterns: true, part_whole_labels: true, one_relationship_per_panel: true, equation_symbols_with_words: true, inverse_check_available: true, colour_not_required: true },
      visual_route: "One low-clutter model per panel with large numerals, generous spacing, pattern-plus-text labels and no colour-only meaning.",
      processing_route: "Reveal one part, whole, scale or equation step at a time; preserve correct work and reduce choices when useful.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed placement can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_before_after_or_instant_model_state", undo_available: true, preserve_correct_work: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "light a calm bond-map by building and checking one relationship", reward: "one relationship lantern for a fact, model or check", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct parts stay. Choose another model or clue and continue." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, mathematical_evidence: explanation, strategy_message: "Recall, frames, part-whole models, number lines, pointing, eye gaze, AAC and adult-scribed explanations are equally valid; response speed is not evidence." },
    difficulty: band === "intro" ? 3 : band === "developing" ? 4 : band === "expected" ? 5 : 6,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated, curatedBlueprint) {
  if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 216) throw new Error("Pilot must contain 4 curated and 216 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["missing_part", "complement_to_ten", "complement_to_twenty", "four_fact_family", "commutative_addition", "inverse_subtraction", "bonds_to_hundred", "scale_all_values", "bridge_to_twenty", "bridge_next_ten", "balanced_equation", "unknown_left_side", "context_missing_part", "misconception_repair", "spaced_bond", "check_with_inverse"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyscalculia_support?.part_whole_labels || !b.ten_frame_route || !b.part_whole_route || !b.number_line_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/dyscalculia route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.mathematical_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function ones(n) { return n % 10; }
function numberChoices(n, max = 100) { return unique([n, clamp(n - 1, 0, max), clamp(n + 1, 0, max), clamp(max - n, 0, max)]); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function unique(items) { return [...new Set(items)]; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
