#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y4-electricity-simple-circuits.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y4-electricity-circuits-bank-";
const reviewBatch = "y4-electricity-circuits-pilot-a";
const allocation = { "component-identification": 48, "complete-loop-builds": 48, "switch-open-closed-tests": 48, "debug-the-dark-bulb": 48, "circuit-retrieval-mix": 48 };
const curatedBlueprint = new Map([
  ["sc-y4-electricity-simple-circuits-q-complete-loop", "complete-loop-builds"],
  ["sc-y4-electricity-simple-circuits-q-open-switch", "switch-open-closed-tests"],
  ["sc-y4-electricity-simple-circuits-q-label-cell", "component-identification"],
]);
const reviewDays = [1, 3, 7, 14, 30];
const components = [
  component("cell", "provides electrical energy to the circuit", "one long and one short parallel line", 2, "source"),
  component("wire", "connects components to make a continuous conducting path", "a straight connecting line", 2, "connector"),
  component("lamp", "produces light when it is in a complete working circuit", "a circle with a cross inside", 2, "output"),
  component("switch", "opens or closes the conducting path", "two contacts with a movable link", 2, "control"),
  component("buzzer", "produces sound in a complete working circuit", "a labelled buzzer symbol", 2, "output"),
  component("motor", "produces movement in a complete working circuit", "a circle labelled M", 2, "output"),
];
const outputs = ["lamp", "buzzer", "motor"];
const materials = [
  material("copper strip", "conductor", "the lamp lights steadily"), material("aluminium foil", "conductor", "the lamp lights steadily"),
  material("steel paperclip", "conductor", "the lamp lights steadily"), material("iron nail", "conductor", "the lamp lights steadily"),
  material("plastic strip", "insulator", "the lamp stays off"), material("rubber band", "insulator", "the lamp stays off"),
  material("dry wooden stick", "insulator", "the lamp stays off"), material("glass rod", "insulator", "the lamp stays off"),
  material("ceramic tile", "insulator", "the lamp stays off"), material("paper card", "insulator", "the lamp stays off"),
];
const faults = [
  fault("missing return wire", "a gap remains between the output component and the cell's second terminal", "connect a wire from the output component back to the unused cell terminal", "single_wire_enough"),
  fault("open switch", "the switch contacts are separated", "close the switch to join the path", "open_switch_broken"),
  fault("loose wire", "one wire end is not connected to a terminal", "connect the loose wire end to the correct terminal", "disconnected_wire"),
  fault("lamp terminal bypassed", "both wires meet the same lamp terminal, so the path does not pass through the lamp", "connect one wire to each lamp terminal", "component_not_in_loop"),
  fault("cell missing", "the loop has no cell to provide electrical energy", "add one suitable low-voltage cell into the loop", "source_missing"),
  fault("broken path card", "a numbered path segment is visibly disconnected", "replace the disconnected path segment with a secure wire", "gap_ignored"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y4-electricity-simple-circuits") throw new Error("This generator only supports sc-y4-electricity-simple-circuits.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
if (curated.length !== 3) throw new Error(`Expected 3 curated variants, found ${curated.length}.`);
for (const variant of curated) if (!curatedBlueprint.has(variant.id)) throw new Error(`Unmapped curated variant ${variant.id}.`);
const curatedCounts = countBy(curated, (variant) => curatedBlueprint.get(variant.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
const generated = [
  ...componentCandidates(targets["component-identification"]),
  ...loopCandidates(targets["complete-loop-builds"]),
  ...switchCandidates(targets["switch-open-closed-tests"]),
  ...debugCandidates(targets["debug-the-dark-bulb"]),
  ...retrievalCandidates(targets["circuit-retrieval-mix"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Deterministic 240-variant Year 4 electricity pilot bank preserving all three curated variants unchanged. Generated review tasks cover cells, wires, lamps, switches, buzzers and motors; complete loops and component terminals; open/closed switches; conductors and insulators from test evidence; fault diagnosis; fair comparisons; safe low-voltage practical work; misconception repair and transfer. Every generated variant offers labelled circuit diagrams, linear path descriptions, reduced-load and alternative-input SEND routes, rich evidence-led feedback and pressure-free repair missions. Selected narration references ElevenLabs assets requiring human listening review; browser TTS is prohibited. Independent science, teacher, accessibility, safeguarding and renderer review remains required before promotion.";
validateBank(pack, curated, curatedSnapshot, generated);

console.log(`y4-electricity-circuits-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y4-electricity-circuits-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y4-electricity-circuits-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y4-electricity-circuits-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
console.log(`y4-electricity-circuits-bank audio=${summary(generated, (v) => v.body.audio_required ? "reviewed_reference" : "not_needed")}`);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-electricity-circuits-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 electricity circuits bank is out of date; run generate-y4-electricity-circuits-bank.mjs --write.");
  console.log("y4-electricity-circuits-bank deterministic check passed");
} else console.log("y4-electricity-circuits-bank dry-run; pass --write to update the pack");

function componentCandidates(count) {
  const modes = ["name_from_job", "job_from_name", "symbol_match", "terminal_reasoning", "component_role_sort", "output_compare", "component_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const item = components[i % components.length], mode = modes[i % modes.length];
    let prompt, answer, body, explanation;
    if (mode === "name_from_job") {
      prompt = `Component tray ${i + 1}: which component ${item.job}?`; answer = item.name;
      body = { job: item.job, choices: componentChoices(item.name, i), labelled_symbol_alternative: item.symbol };
      explanation = `The ${item.name} ${item.job}.`;
    } else if (mode === "job_from_name") {
      prompt = `Component job card ${i + 1}: choose the accurate job of the ${item.name}.`; answer = item.job;
      body = { component: item.name, choices: [item.job, "stores electricity after the circuit is opened", "removes the need for a complete loop", "works without connections"] };
      explanation = `A ${item.name} ${item.job}; it still needs suitable connections in a complete circuit.`;
    } else if (mode === "symbol_match") {
      prompt = `Diagram key ${i + 1}: which component matches “${item.symbol}”?`; answer = item.name;
      body = { symbol_description: item.symbol, choices: componentChoices(item.name, i + 2), real_component_label_available: true };
      explanation = `The diagram description “${item.symbol}” represents the ${item.name}.`;
    } else if (mode === "terminal_reasoning") {
      prompt = `Terminal map ${i + 1}: why are both terminals of the ${item.name} shown in the path?`; answer = "The circuit path must connect through the component and continue around the loop.";
      body = { component: item.name, terminal_count: item.terminals, choices: [answer, "One loose wire always completes a circuit.", "Both wires should meet the same terminal."] };
      explanation = `${answer} A component cannot be bypassed or left as a dead end.`;
    } else if (mode === "component_role_sort") {
      prompt = `Role-sort ${i + 1}: place the ${item.name} in its circuit-role tray.`; answer = item.role;
      body = { component: item.name, choices: ["source", "connector", "control", "output"], expected_role: item.role };
      explanation = `The ${item.name} is a ${item.role}: it ${item.job}.`;
    } else if (mode === "output_compare") {
      const output = components.find((c) => c.name === outputs[i % outputs.length]); prompt = `Output selector ${i + 1}: choose the component that produces ${output.name === "lamp" ? "light" : output.name === "buzzer" ? "sound" : "movement"}.`; answer = output.name;
      body = { required_effect: output.job, choices: ["lamp", "buzzer", "motor", "switch"] };
      explanation = `The ${output.name} is the output component that ${output.job}.`;
    } else {
      prompt = `New-diagram transfer ${i + 1}: identify the ${item.name} and state its job before tracing the circuit.`; answer = `${item.name}: ${item.job}`;
      body = { symbol_description: item.symbol, choices: [answer, `wire: provides all electrical energy`, `switch: produces every output`], diagram_orientation_changes: true };
      explanation = `Rotating or rearranging a diagram does not change the component's identity or job: ${answer}.`;
    }
    return science({ id: `component-${mode}-${item.name}-${i + 1}`, format: "component-label", blueprint: "component-identification", band: i < 10 ? "intro" : "developing", concept: mode, prompt, body, answer, explanation, tag: "component_function_confusion", hook: "component-tray-scan", audioScript: i % 12 === 0 ? prompt : undefined });
  });
}

function loopCandidates(count) {
  const modes = ["complete_loop", "missing_return_path", "connect_both_terminals", "insert_output", "path_order", "single_wire_repair", "loop_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const output = outputs[i % outputs.length], mode = modes[i % modes.length], path = ["cell terminal A", "wire", output, "wire", "cell terminal B"];
    let prompt, answer = "closed_complete_loop", body, explanation, tag = "single_wire_enough";
    if (mode === "path_order") {
      answer = path; prompt = `Path-sequence board ${i + 1}: order the parts to make one complete circuit containing a ${output}.`;
      body = { cards: rotate(path, i), expected_order: path, output_prediction: outputEffect(output) };
      explanation = `The path leaves one cell terminal, passes through the ${output}, and returns to the other cell terminal without a gap.`;
    } else if (mode === "connect_both_terminals") {
      answer = `connect one wire to each ${output} terminal`; prompt = `Terminal builder ${i + 1}: how should the ${output} be connected so it is part of the loop?`;
      body = { components: ["cell", "two wires", output], choices: [answer, "connect both wires to the same terminal", "leave one terminal unconnected"], terminal_map: true };
      explanation = `One connection enters and the other leaves the ${output}, so the path continues through it.`;
    } else if (mode === "insert_output") {
      answer = output; prompt = `Output-bay builder ${i + 1}: insert the component that should produce ${outputEffect(output)} in the complete loop.`;
      body = { complete_path_with_component_slot: true, choices: [output, ...outputs.filter((name) => name !== output), "wire gap"], required_output: outputEffect(output) };
      explanation = `A ${output} produces ${outputEffect(output)} when connected in the complete circuit.`;
    } else {
      prompt = `Circuit builder ${i + 1}: complete the safe low-voltage loop so the ${output} can work.`;
      body = { components: ["one cell", "two or more wires", output], path_segments: path, missing_connection: mode === "complete_loop" ? "choose_complete_diagram" : "return_to_second_cell_terminal", test_outcome: outputEffect(output), choices: ["closed_complete_loop", "one wire ending at the output", "two wires joined to one output terminal"] };
      explanation = `A complete, unbroken path must include the cell and ${output} and return to the cell's other terminal. The ${output} then produces ${outputEffect(output)}.`;
    }
    return science({ id: `loop-${mode}-${output}-${i + 1}`, format: "circuit-builder", blueprint: "complete-loop-builds", band: i < 10 ? "developing" : "expected", concept: mode, prompt, body, answer, explanation, tag, hook: "current-loop-trace", audioScript: i % 14 === 0 ? prompt : undefined });
  });
}

function switchCandidates(count) {
  const modes = ["open_switch_prediction", "closed_switch_prediction", "switch_state_compare", "open_not_broken", "switch_position", "switch_sequence", "switch_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const output = outputs[i % outputs.length], mode = modes[i % modes.length], closed = !mode.startsWith("open") && mode !== "open_not_broken" && (mode === "closed_switch_prediction" || i % 2 === 0);
    const effect = closed ? outputEffect(output) : `${output} is off`;
    let answer = closed ? "The closed switch joins the path, so the circuit is complete." : "The open switch makes a gap, so the circuit is incomplete.";
    let prompt = `Switch test ${i + 1}: predict the ${output} when the switch is ${closed ? "closed" : "open"}.`, body = { output_component: output, switch_state: closed ? "closed" : "open", choices: [answer, "The cell instantly runs out.", `The ${output} must be broken.`], predicted_output: effect }, explanation = `${answer} The same working components can be tested again after the switch state changes.`, tag = "open_switch_broken";
    if (mode === "switch_state_compare") {
      answer = "Closed joins the path; open separates the contacts and creates a gap."; prompt = `Switch comparison ${i + 1}: compare the two states without calling either state a fault.`;
      body = { same_circuit: true, open_result: `${output} off`, closed_result: effect, choices: [answer, "Open means broken and closed means repaired.", "The switch changes the cell into an output."] };
      explanation = `${answer} A switch is designed to control whether the path is complete.`;
    } else if (mode === "open_not_broken") {
      answer = "Close the switch and retest; if the output works, the open state—not a broken component—explained the first result."; prompt = `Evidence checkpoint ${i + 1}: how can you distinguish an open switch from a broken ${output}?`;
      body = { switch_state: "open", output_component: output, choices: [answer, `Replace the ${output} without testing the switch.`, "Touch bare wires while connected."] };
      explanation = answer; tag = "open_switch_broken";
    } else if (mode === "switch_position") {
      answer = "Any position in the single loop can control the circuit if the switch opens or closes the only path."; prompt = `Diagram transfer ${i + 1}: the switch moves to another part of the same series loop. Can it still control the ${output}?`;
      body = { two_diagrams_same_connections: true, choices: [answer, "Only a switch beside the cell can work.", "Moving its symbol makes it an output component."] };
      explanation = answer; tag = "diagram_position_changes_function";
    } else if (mode === "switch_sequence") {
      answer = ["open: path has a gap", "closed: path is complete", `open again: ${output} turns off`]; prompt = `Control sequence ${i + 1}: order the evidence as a working switch opens, closes and opens again.`;
      body = { cards: rotate(answer, i), expected_order: answer, same_components_throughout: true };
      explanation = `Only the switch state changes, so the repeated output change is evidence that it controls the path.`;
    }
    return science({ id: `switch-${mode}-${output}-${i + 1}`, format: "circuit-builder", blueprint: "switch-open-closed-tests", band: i < 12 ? "developing" : "expected", concept: mode, prompt, body, answer, explanation, tag, hook: "switch-open-close", audioScript: i % 13 === 0 ? prompt : undefined });
  });
}

function debugCandidates(count) {
  const modes = ["fault_diagnosis", "conductor_evidence", "insulator_evidence", "fair_material_test", "fair_component_test", "safety_choice", "evidence_not_guess", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], faultItem = faults[i % faults.length];
    const matchingMaterials = mode === "conductor_evidence" ? materials.filter((item) => item.classification === "conductor") : mode === "insulator_evidence" ? materials.filter((item) => item.classification === "insulator") : materials;
    const sample = matchingMaterials[i % matchingMaterials.length];
    let prompt, answer, body, explanation, tag = faultItem.tag;
    if (mode === "fault_diagnosis" || mode === "misconception_repair") {
      answer = `${faultItem.evidence}; ${faultItem.repair}`; prompt = `Fault detective ${i + 1}: the output is off. Use the numbered diagram evidence to diagnose one precise fault.`;
      body = { fault: faultItem.name, observed_evidence: faultItem.evidence, choices: [answer, "Electricity was used up before returning.", "Every unlit output needs a stronger cell."], repair_step: faultItem.repair, first_fault_only: true };
      explanation = `The evidence shows ${faultItem.evidence}. The targeted repair is to ${faultItem.repair}; then retest the complete path.`;
    } else if (mode === "conductor_evidence" || mode === "insulator_evidence") {
      answer = sample.classification; tag = "material_classified_by_appearance"; prompt = `Material-test evidence ${i + 1}: when ${sample.name} fills the test gap, ${sample.result}. What does this evidence suggest?`;
      body = { material: sample.name, result: sample.result, complete_test_circuit_confirmed: true, choices: [sample.classification, sample.classification === "conductor" ? "insulator" : "conductor", "cell", "switch"], cautious_claim: `In this test, ${sample.name} behaved as a ${sample.classification}.` };
      explanation = `Because the rest of the test circuit is complete, “${sample.result}” is evidence that ${sample.name} behaved as a ${sample.classification} in this test.`;
    } else if (mode === "fair_material_test") {
      answer = "Change only the material in the gap; keep the cell, lamp, wires, contact positions and test time the same."; tag = "multiple_variables_changed"; prompt = `Fair-test planner ${i + 1}: compare whether two supplied materials conduct electricity.`;
      body = { changed_variable: "material in the test gap", controlled_variables: ["same cell", "same lamp", "same wires", "same contact positions", "same test time"], choices: [answer, "Change the material, cell and lamp together.", "Judge materials by colour without testing."] };
      explanation = `${answer} First confirm the circuit works with a known conductor, then compare recorded outcomes safely.`;
    } else if (mode === "fair_component_test") {
      answer = "Change one component, keep every connection and other component the same, and compare the same output observation."; tag = "multiple_variables_changed"; prompt = `Component comparison ${i + 1}: which plan makes the comparison interpretable?`;
      body = { choices: [answer, "Rebuild a different circuit for every trial.", "Change the cell and output together."], repeat_test: true, record_table: ["component tested", "switch state", "output observed"] };
      explanation = `${answer} A single changed variable lets the evidence support a conclusion.`;
    } else if (mode === "safety_choice") {
      const rules = safetyRules(i); answer = rules.correct; tag = "unsafe_circuit_testing"; prompt = `Safety gate ${i + 1}: choose the safe action for a classroom circuit investigation.`;
      body = { scenario: rules.scenario, choices: [rules.correct, rules.unsafeA, rules.unsafeB], practical_scope: "teacher-approved low-voltage cells and supplied components only" };
      explanation = `${rules.correct} Never investigate mains electricity, sockets, damaged cells, wet equipment or deliberately short-circuited cells.`;
    } else {
      answer = "Check that the test circuit works with a known conductor, change one material, record the output, and repeat before concluding."; tag = "conclusion_without_evidence"; prompt = `Evidence quality ${i + 1}: which routine supports a conductor/insulator conclusion rather than a guess?`;
      body = { choices: [answer, "Classify from shininess alone.", "Use one failed circuit without checking its connections."], evidence_table_required: true };
      explanation = `${answer} This separates a material result from an unnoticed circuit fault.`;
    }
    return science({ id: `debug-${mode}-${i + 1}`, format: "explain-choice", blueprint: "debug-the-dark-bulb", band: "secure", concept: mode, prompt, body, answer, explanation, tag, hook: "first-fault-freeze", audioScript: i % 16 === 0 ? prompt : undefined });
  });
}

function retrievalCandidates(count) {
  const modes = ["component_retrieval", "loop_retrieval", "switch_retrieval", "material_retrieval", "fault_retrieval", "fair_test_retrieval", "safety_retrieval", "transfer_retrieval"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length], output = outputs[i % outputs.length], item = components[i % components.length], sample = materials[i % materials.length], faultItem = faults[i % faults.length];
    let prompt, answer, body, explanation, tag = "complete_path_not_traced";
    if (mode === "component_retrieval") { answer = item.name; prompt = `Return-route component ${i + 1}: identify “${item.symbol}” and recall its job.`; body = { symbol_description: item.symbol, job: item.job, choices: componentChoices(item.name, i), review_interval_days: day }; explanation = `The ${item.name} ${item.job}.`; tag = "component_function_confusion"; }
    else if (mode === "loop_retrieval") { answer = "Trace an unbroken path from one cell terminal, through the output, to the other cell terminal."; prompt = `Return-route loop ${i + 1}: which check proves the ${output} is connected in a complete circuit?`; body = { output_component: output, choices: [answer, "Count one wire and stop.", "Check only whether symbols are close together."], review_interval_days: day }; explanation = answer; tag = "single_wire_enough"; }
    else if (mode === "switch_retrieval") { const closed = i % 2 === 0; answer = closed ? `${output} works because the closed switch completes the path` : `${output} is off because the open switch creates a gap`; prompt = `Return-route switch ${i + 1}: predict and explain the output with the switch ${closed ? "closed" : "open"}.`; body = { switch_state: closed ? "closed" : "open", output_component: output, choices: [answer, `${output} is broken because switches cannot change state`], review_interval_days: day }; explanation = answer; tag = "open_switch_broken"; }
    else if (mode === "material_retrieval") { answer = sample.classification; prompt = `Return-route evidence ${i + 1}: ${sample.name} gives “${sample.result}” in a confirmed working tester. Classify its behaviour.`; body = { material: sample.name, result: sample.result, choices: ["conductor", "insulator"], review_interval_days: day }; explanation = `The test evidence supports ${sample.classification}.`; tag = "material_classified_by_appearance"; }
    else if (mode === "fault_retrieval") { answer = faultItem.repair; prompt = `Return-route repair ${i + 1}: evidence says “${faultItem.evidence}”. Choose the precise repair.`; body = { choices: [faultItem.repair, "add unrelated components", "use a mains socket"], review_interval_days: day }; explanation = `Repair the evidenced fault: ${faultItem.repair}.`; tag = faultItem.tag; }
    else if (mode === "fair_test_retrieval") { answer = "Change one factor, control the rest, record the same outcome and repeat."; prompt = `Return-route fair test ${i + 1}: select the reliable comparison rule.`; body = { choices: [answer, "Change several parts together.", "Choose the expected result before testing."], review_interval_days: day }; explanation = answer; tag = "multiple_variables_changed"; }
    else if (mode === "safety_retrieval") { answer = "Use only teacher-approved low-voltage cells and supplied parts; disconnect if anything is hot or damaged."; prompt = `Return-route safety ${i + 1}: choose the safe classroom-circuit rule.`; body = { choices: [answer, "Test a wall socket.", "Join cell terminals directly and leave them connected."], review_interval_days: day }; explanation = answer; tag = "unsafe_circuit_testing"; }
    else { answer = "Component order and diagram shape may change, but a working simple series circuit still needs one complete path through the cell and output."; prompt = `New-layout transfer ${i + 1}: which rule still applies when a circuit diagram is rearranged?`; body = { diagram_shape_changed: true, choices: [answer, "A rectangular diagram works but a circular one cannot.", "Electricity stops after the output."], review_interval_days: day }; explanation = answer; tag = "diagram_shape_changes_circuit"; }
    return science({ id: `retrieval-${mode}-${i + 1}`, format: "component-label", blueprint: "circuit-retrieval-mix", band: "retrieval", concept: mode, prompt, body, answer, explanation, tag, hook: "evidence-card-pin", audioScript: i % 17 === 0 ? prompt : undefined });
  });
}

function science({ id, format, blueprint, band, concept, prompt, body, answer, explanation, tag, hook, audioScript }) {
  const choices = body.choices ? rotate(unique(body.choices), id.length % body.choices.length) : undefined;
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_keep_text_diagram_linear_path_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_text_diagram_and_linear_path_are_complete" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...(choices ? { choices } : {}), ...audio, concept_focus: concept,
      interaction_mode: "build_label_sort_select_explain_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, place the learner's named component or record an indicated prediction/explanation without supplying the science decision.",
      circuit_builder_route: "Large snap points, named terminals, undo and test controls; keyboard and switch users select START TERMINAL–COMPONENT–END TERMINAL instead of dragging.",
      diagram_route: "High-contrast standard component symbols are paired with text labels, terminal markers and a static numbered path; colour and animated glow are never the only evidence.",
      linear_path_route: "Every circuit has an equivalent ordered list from one cell terminal through each connection to the other terminal, including an explicit GAP label when incomplete.",
      evidence_route: "Observation tables separate circuit state, changed variable, output result and conclusion; learners may point, select, eye-gaze, use AAC or have evidence adult-scribed.",
      send_support: { one_component_or_path_segment_at_a_time: true, persistent_component_key: true, prediction_before_test_optional: true, correct_connections_preserved: true, replay_and_reread: true, no_mandatory_touch_speech_or_drawing: true },
      visual_route: "Low-clutter board, generous spacing, labelled icons and steady states with no flashing, alarm effects or colour-only meaning.",
      reduced_load_route: "Reveal tray, path check, prediction and evidence separately; keep correct components and hide decorative scenery.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed selection replaces dragging, speech and handwriting.",
      sensory_safe_route: "Use silent visual output descriptions by default; buzzer sound is optional, replay-controlled and never required for the scientific judgement.",
      practical_safety: { classroom_scope: "teacher-approved low-voltage cells and supplied components only", never_use: ["mains electricity", "wall sockets", "damaged or leaking cells", "wet equipment", "body as a test material"], short_circuit_warning: "Never connect cell terminals directly; disconnect and tell an adult if a cell, wire or component becomes warm.", adult_supervision: true },
      low_visual_load: true, reduced_motion: "static_numbered_before_after_diagrams_no_flashing_or_current_animation", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "restore one calm circuit station in the Signal Garden", reward: "one evidence beacon for a safe build, prediction or repair", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct components and evidence stay. Inspect one path clue and continue without penalty." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: { value: answer },
    hints: ["Trace the path from one cell terminal through every component and back to the other terminal.", "Use the observed switch state, connection or test result; do not guess from appearance."],
    explanation,
    feedback: { correct: `Circuit evidence secured through ${concept.replaceAll("_", " ")}. ${explanation}`, repair: repairFor(tag), evidence_statement: explanation, safety_reminder: "Use only teacher-approved low-voltage equipment; never use mains electricity or deliberately join cell terminals directly.", retry: "Keep correct labels and connections, inspect the first gap or unsupported claim, then retry without losing progress." },
    difficulty: band === "intro" ? 2 : band === "developing" ? 4 : band === "expected" ? 5 : band === "secure" ? 7 : 5,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, preserved, snapshot, generatedVariants) {
  if (preserved.length !== 3 || JSON.stringify(preserved) !== snapshot) throw new Error("Curated preservation failed.");
  if (generatedVariants.length !== 237 || currentPack.question_variants.length !== 240 || currentPack.practice.variant_targets.pilot !== 240) throw new Error("Pilot must contain 3 curated and 237 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id); if (new Set(ids).size !== ids.length) throw new Error("Duplicate IDs found.");
  const signatures = new Set();
  for (const v of generatedVariants) { const signature = `${v.format}|${v.body.prompt}|${JSON.stringify(v.expected_answer.value)}`; if (signatures.has(signature)) throw new Error(`Duplicate signature ${v.id}.`); signatures.add(signature); }
  const counts = countBy(currentPack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, target] of Object.entries(allocation)) if (counts[id] !== target) throw new Error(`${id}: expected ${target}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generatedVariants.map((v) => v.body.concept_focus));
  for (const concept of ["name_from_job", "symbol_match", "complete_loop", "missing_return_path", "connect_both_terminals", "single_wire_repair", "open_switch_prediction", "closed_switch_prediction", "open_not_broken", "fault_diagnosis", "conductor_evidence", "insulator_evidence", "fair_material_test", "fair_component_test", "safety_choice", "evidence_not_guess", "material_retrieval", "transfer_retrieval"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
  for (const name of ["cell", "wire", "lamp", "switch", "buzzer", "motor"]) if (!generatedVariants.some((v) => JSON.stringify(v.body).includes(`\"${name}\"`))) throw new Error(`Missing component ${name}.`);
  for (const v of generatedVariants) {
    const b = v.body;
    if (!b.send_support?.one_component_or_path_segment_at_a_time || !b.circuit_builder_route || !b.diagram_route || !b.linear_path_route || !b.evidence_route || !b.visual_route || !b.reduced_load_route || !b.motor_alternative || !b.sensory_safe_route || !b.low_visual_load) throw new Error(`Missing SEND route in ${v.id}.`);
    if (!b.practical_safety?.adult_supervision || !b.practical_safety.never_use.includes("mains electricity") || !b.practical_safety.short_circuit_warning) throw new Error(`Missing safety route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.evidence_statement || !v.feedback?.safety_reminder) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error || b.gamification?.speed_bonus) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) { if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${v.id}.`); }
    else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unexpected audio reference in ${v.id}.`);
  }
}

function repairFor(tag) {
  const repairs = {
    component_function_confusion: "Match the component's labelled symbol to one observable circuit job, then check it in a complete path.",
    single_wire_enough: "Trace until the path stops, add the return connection to the cell's other terminal and retest.",
    open_switch_broken: "Keep every component unchanged, close the switch and compare the output before deciding anything is faulty.",
    disconnected_wire: "Follow numbered path segments to the loose endpoint and reconnect only that gap.",
    component_not_in_loop: "Connect one wire to each output terminal so the path passes through the component.",
    source_missing: "Add one teacher-approved low-voltage cell to the loop; do not use mains electricity.",
    gap_ignored: "Mark the first disconnected path segment, repair that single gap and retest.",
    material_classified_by_appearance: "Confirm the tester with a known conductor, insert the material and classify from the recorded output rather than appearance.",
    multiple_variables_changed: "Choose one changed variable, hold the circuit and observation method constant, then repeat and record.",
    unsafe_circuit_testing: "Stop, disconnect the low-voltage circuit and choose the teacher-approved safe action; never use mains, wet or damaged equipment.",
    conclusion_without_evidence: "Check the circuit first, collect a repeatable output observation and make a cautious claim tied to that evidence.",
    diagram_position_changes_function: "Compare connections and component jobs, not diagram position or shape.",
    diagram_shape_changes_circuit: "Linearise both diagrams from one cell terminal to the other and compare the same connections.",
    complete_path_not_traced: "Use the numbered linear path, identify the first gap or bypass and preserve all correct segments.",
  };
  return repairs[tag] ?? "Return to the labelled path, preserve correct evidence and repair only the first unsupported connection or claim.";
}

function component(name, job, symbol, terminals, role) { return { name, job, symbol, terminals, role }; }
function material(name, classification, result) { return { name, classification, result }; }
function fault(name, evidence, repair, tag) { return { name, evidence, repair, tag }; }
function outputEffect(output) { return output === "lamp" ? "light" : output === "buzzer" ? "sound" : "movement"; }
function componentChoices(answer, i) { return rotate(unique([answer, ...components.map((c) => c.name)]), i, 4); }
function safetyRules(i) { const cases = [
  { scenario: "A wire or cell feels warm.", correct: "Disconnect the circuit and tell the supervising adult.", unsafeA: "Keep it connected to see whether it gets hotter.", unsafeB: "Cool it with water while connected." },
  { scenario: "A learner wants to test a wall socket.", correct: "Do not touch or test the socket; use only the supplied low-voltage circuit.", unsafeA: "Insert a wire into the socket.", unsafeB: "Test it with wet hands." },
  { scenario: "The cell terminals are joined directly by a wire.", correct: "Disconnect immediately and rebuild with an output component in the path.", unsafeA: "Leave the direct connection running.", unsafeB: "Add another direct wire." },
  { scenario: "A material sample is wet.", correct: "Do not place it in the circuit; use the dry teacher-approved samples.", unsafeA: "Hold it while connected.", unsafeB: "Test it beside an open drink." },
  { scenario: "A cell looks damaged or is leaking.", correct: "Do not use it; move away and tell the supervising adult.", unsafeA: "Wipe it by hand and continue.", unsafeB: "Connect it to check whether it works." },
  { scenario: "A buzzer output may be uncomfortable.", correct: "Use the silent visual result or keep sound optional and low under adult control.", unsafeA: "Require every learner to hear it.", unsafeB: "Use an alarm-volume surprise." },
]; return cases[i % cases.length]; }
function rotate(items, amount, limit = items.length) { const chosen = items.slice(0, limit), offset = amount % chosen.length; return chosen.slice(offset).concat(chosen.slice(0, offset)); }
function unique(items) { return [...new Set(items.map((item) => JSON.stringify(item)))].map((item) => JSON.parse(item)); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([key, value]) => `${key}:${value}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
