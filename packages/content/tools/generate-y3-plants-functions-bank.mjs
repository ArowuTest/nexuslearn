#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y3-plants-functions.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y3-plants-functions-bank-";
const reviewBatch = "y3-plants-functions-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "part-label-scans": 44,
  "function-match-cards": 44,
  "greenhouse-cause-tests": 44,
  "because-explanations": 44,
  "plant-function-retrieval": 44,
};

const parts = [
  part("roots", "below the soil or growing medium", ["take in water and mineral nutrients", "anchor the plant"], "fine branching structures spread through soil"),
  part("stem", "between roots and leaves or flowers", ["supports leaves and flowers", "carries water to other plant parts"], "an upright or trailing structure joins roots to leaves"),
  part("trunk", "the main woody stem of a tree", ["supports branches and leaves", "carries water through the tree"], "a thick woody stem rises from the roots"),
  part("leaves", "attached to stems or branches", ["use light, air and water to help make food", "exchange gases with the air"], "usually broad green surfaces receive light"),
  part("flower", "often at the end or side of a stem", ["has a role in pollination", "can lead to seed formation"], "petals and central reproductive structures form a flower"),
  part("fruit", "develops from part of a flower in many flowering plants", ["contains or protects seeds", "can help seeds disperse"], "a seed-containing structure develops after flowering"),
  part("seed", "inside a fruit, pod or seed head", ["contains a young plant", "can germinate in suitable conditions"], "a protective covering surrounds a young plant and food store"),
];

const requirements = [
  requirement("water", "roots take it in and the stem carries it", "without enough water, the plant may wilt and growth may slow"),
  requirement("light", "leaves use it to help make food", "with too little light, growth may be weak or pale"),
  requirement("air", "leaves exchange gases with the air", "plants need gases from air for life processes"),
  requirement("mineral nutrients", "roots take dissolved minerals from the growing medium", "a shortage can limit healthy growth"),
  requirement("room to grow", "roots and shoots need space to develop", "crowding can reduce access to light, water or space"),
  requirement("a suitable temperature", "life processes work best within a suitable range", "conditions that are too cold or hot can slow or damage growth"),
];

const dispersal = [
  disperse("dandelion", "wind", "light seeds have parachute-like hairs that can be carried by air"),
  disperse("sycamore", "wind", "winged fruits spin as they fall and may travel from the parent tree"),
  disperse("burdock", "animals", "hooked fruits can attach to animal fur or clothing and later fall off"),
  disperse("blackberry", "animals", "animals may eat the fruit and carry seeds away before the seeds are left elsewhere"),
  disperse("coconut", "water", "the fruit can float and be carried by water"),
  disperse("pea", "explosive pod", "a dry pod can split and scatter seeds away from the parent plant"),
];

const investigations = [
  investigation("water amount", ["same plant type", "similar starting size", "same light", "same temperature", "same soil and pot"], "volume of water", "height and leaf condition over time"),
  investigation("light level", ["same plant type", "similar starting size", "same water", "same temperature", "same soil and pot"], "light level", "height, leaf number and colour over time"),
  investigation("growing space", ["same plant type", "same number of days", "same water", "same light", "same soil type"], "amount of space or crowding", "height and leaf growth over time"),
  investigation("temperature", ["same plant type", "similar starting size", "same water", "same light", "same soil and pot"], "temperature within a teacher-approved safe range", "germination or growth over time"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y3-plants-functions") throw new Error("This generator only supports the Year 3 plant-functions pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedBlueprint = new Map([
  ["sc-y3-plants-functions-q-root-job", "function-match-cards"],
  ["sc-y3-plants-functions-q-leaf-job", "part-label-scans"],
  ["sc-y3-plants-functions-q-root-block", "greenhouse-cause-tests"],
]);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...partCandidates(targets["part-label-scans"]),
  ...functionCandidates(targets["function-match-cards"]),
  ...causeCandidates(targets["greenhouse-cause-tests"]),
  ...explanationCandidates(targets["because-explanations"]),
  ...retrievalCandidates(targets["plant-function-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 3 plant-functions pack with a deterministic 220-variant pilot bank. Three curated variants are unchanged. Generated tasks cover roots, stems/trunks, leaves, flowers, fruits and seeds; requirements for life and growth; water transport; pollination, seed formation and dispersal; age-appropriate cause/effect models; observation, diagrams, fair-test planning, evidence comparison, misconception repair and spaced transfer. Every generated task includes plant-part models, transport sequences, evidence comparisons or investigation planners, sensory-safe reduced-load SEND routes, optional tactile materials, alternative inputs, rich feedback and pressure-free garden-lab missions without timers, streaks, lives or loss. Selected narration references ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent science, practical safety, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated, curatedBlueprint);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-plants-functions-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y3-plants-functions-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y3-plants-functions-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y3-plants-functions-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-plants-functions-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 plant-functions bank is out of date; run generate-y3-plants-functions-bank.mjs --write.");
  console.log("y3-plants-functions-bank deterministic check passed");
} else console.log("y3-plants-functions-bank dry-run; pass --write to update the pack");

function partCandidates(count) {
  const modes = ["identify_part", "diagram_label", "location_evidence", "varied_plant_model", "part_system_order", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = parts[i % parts.length], mode = modes[i % modes.length];
    if (mode === "part_system_order") {
      const sequence = ["roots", "stem or trunk", "leaves", "flowers", "fruits and seeds"];
      return science({ id: `system-order-${i + 1}`, format: "label-drag", blueprint: "part-label-scans", band: "developing", concept: mode,
        prompt: `Whole-plant model ${i + 1}: arrange labels from below-ground intake to leaves, flowers and seeds.`, body: { cards: rotate(sequence, i % sequence.length), diagram_slots: ["below ground", "support/transport", "food-making", "flowering", "seed stage"], model_not_single_linear_process: true }, answer: sequence,
        hints: ["Begin with roots below the growing medium.", "Use position and function together; real plants can vary in shape."], explanation: `Roots connect through a stem or trunk to leaves and flowers; flowers can lead to fruits and seeds. The sequence organises a model, not a claim that every plant looks identical.`, correct: "Whole-plant model labelled in a useful functional order.", repair: "Anchor ROOTS and LEAVES first, then place support/transport and reproduction labels between or above them.", tag: "plant_parts_seen_as_unconnected", hook: "whole-plant-system-model" });
    }
    if (mode === "varied_plant_model") {
      const answer = `Use position, connections and observable structure: ${item.name} is ${item.location}; ${item.feature}.`;
      return science({ id: `varied-${slug(item.name)}-${i + 1}`, format: "label-drag", blueprint: "part-label-scans", band: "expected", concept: mode,
        prompt: `Botanical-model mission ${i + 1}: the plant diagram is rotated or has an unusual shape. Which evidence identifies ${item.name}?`, body: { target_part: item.name, diagram_variation: ["upright", "trailing", "woody", "young plant"][i % 4], choices: [answer, "Choose by colour alone.", "A part changes function when the diagram rotates."], location_clue: item.location, feature_clue: item.feature }, answer,
        hints: ["Rotation does not change a part's identity or function.", "Use where the part connects and its observable structure."], explanation: answer, correct: "Plant part identified across varied diagrams using structural evidence.", repair: "Switch to an outline diagram, trace connections from roots to stem to leaves and reveal one location clue.", tag: "diagram_orientation_changes_part", hook: "varied-plant-scan" });
    }
    if (mode === "misconception_repair") {
      const answer = "Identify the part using structure and location, then explain its function with separate evidence.";
      return science({ id: `label-repair-${slug(item.name)}-${i + 1}`, format: "label-drag", blueprint: "part-label-scans", band: "expected", concept: mode,
        prompt: `Scanner-repair mission ${i + 1}: which rule prevents guessing a plant part from colour or decoration?`, body: { target_part: item.name, choices: [answer, "Every bright part is a flower.", "Every green part has exactly the same job."], evidence_cards: [item.location, item.feature] }, answer,
        hints: ["Identification and function are connected but different questions.", "Use position, shape and connections before colour."], explanation: `${item.name}: ${item.location}; ${item.feature}. Its functions include ${item.functions.join(" and ")}.`, correct: "Part-identification misconception repaired with structural evidence.", repair: "Hide colour, reveal an outline and connection points, then choose between two named parts.", tag: "colour_only_part_identification", hook: "scanner-repair" });
    }
    const answer = item.name;
    return science({ id: `${mode}-${slug(item.name)}-${i + 1}`, format: "label-drag", blueprint: "part-label-scans", band: mode === "identify_part" ? "intro" : "developing", concept: mode,
      prompt: `Plant-part scanner ${i + 1}: place the correct label on the highlighted structure.`, body: { highlighted_structure: item.feature, location_clue: item.location, choices: rotate([item.name, ...parts.filter((x) => x.name !== item.name).slice(0, 3).map((x) => x.name)], i % 4), diagram_type: ["bean plant", "flowering shrub", "young tree", "wild flower"][i % 4] }, answer,
      hints: [`Look ${item.location}.`, item.feature], explanation: `The highlighted part is ${item.name}. It is ${item.location} and ${item.feature}.`, correct: `Plant part labelled accurately: ${item.name}.`, repair: "Keep the highlighted connection point, reduce to two labels and compare their normal positions on a simple outline.", tag: "part_label_by_colour", hook: "greenhouse-part-scan", audioScript: i % 4 === 0 ? `Place the ${item.name} label on the highlighted plant part.` : undefined });
  });
}

function functionCandidates(count) {
  const modes = ["part_function_match", "dual_function", "root_stem_connection", "leaf_flower_contrast", "pollination_role", "seed_dispersal_match", "word_sort"];
  return Array.from({ length: count }, (_, i) => {
    const item = parts[i % parts.length], mode = modes[i % modes.length];
    if (mode === "root_stem_connection") {
      const answer = "Roots take in water; the stem or trunk carries water upwards to leaves and other parts.";
      return science({ id: `root-stem-${i + 1}`, format: "explain-choice", blueprint: "function-match-cards", band: "developing", concept: mode,
        prompt: `Connected-jobs mission ${i + 1}: which statement links roots and stem accurately?`, body: { choices: [answer, "Roots make flowers and the stem makes soil.", "The stem takes water out of the plant."], diagram_sequence: ["water in growing medium", "roots", "stem/trunk", "leaves"] }, answer,
        hints: ["Follow water from the growing medium.", "Roots and stem have connected but different jobs."], explanation: answer, correct: "Root intake and stem transport linked as a system.", repair: "Place water-drop cards at roots, then move them through a labelled stem path to leaves.", tag: "roots_only_anchor", hook: "root-stem-water-link" });
    }
    if (mode === "leaf_flower_contrast") {
      const answer = "Leaves use light to help make food; flowers have a role in pollination and seed formation.";
      return science({ id: `leaf-flower-${i + 1}`, format: "explain-choice", blueprint: "function-match-cards", band: "expected", concept: mode,
        prompt: `Function-contrast mission ${i + 1}: which statement separates leaf and flower roles?`, body: { parts: ["leaves", "flower"], choices: [answer, "Flowers make all the plant's food and leaves make seeds.", "Leaves and flowers are only decoration."], evidence_icons: ["light at leaf", "pollen and seed sequence at flower"] }, answer,
        hints: ["Link light and food-making to leaves.", "Link pollination and seeds to flowers."], explanation: answer, correct: "Leaf and flower functions distinguished accurately.", repair: "Sort two job cards under LEAF and FLOWER, then reveal one confirming diagram for each.", tag: "flower_leaf_function_confusion", hook: "leaf-flower-contrast" });
    }
    if (mode === "pollination_role") {
      const answer = "Pollination is the transfer of pollen to the receiving part of a flower; it can lead to seed formation.";
      return science({ id: `pollination-${i + 1}`, format: "explain-choice", blueprint: "function-match-cards", band: "expected", concept: mode,
        prompt: `Flower-life-cycle mission ${i + 1}: choose the age-appropriate explanation of pollination.`, body: { choices: [answer, "Pollination is leaves catching light to make food.", "Pollination means every flower immediately becomes a fruit."], transfer_agents: ["insects", "wind"], sequence_preview: ["flower with pollen", "pollen transfer", "seed formation may follow"] }, answer,
        hints: ["Pollination involves pollen and flowers.", "Use “can lead to” rather than claiming every flower forms seeds."], explanation: answer, correct: "Flower role and pollination explained at appropriate depth.", repair: "Order three cards—pollen, transfer, possible seed formation—and remove the leaf food-making distractor.", tag: "pollination_is_food_making", hook: "pollination-sequence" });
    }
    if (mode === "seed_dispersal_match") {
      const method = dispersal[i % dispersal.length], answer = method.method;
      return science({ id: `dispersal-${method.plant}-${i + 1}`, format: "explain-choice", blueprint: "function-match-cards", band: "expected", concept: mode,
        prompt: `Seed-journey mission ${i + 1}: which dispersal method fits ${method.plant}?`, body: { plant: method.plant, adaptation_evidence: method.evidence, choices: [method.method, ...dispersal.filter((x) => x.method !== method.method).slice(0, 2).map((x) => x.method)], seed_model: true }, answer,
        hints: ["Use the seed or fruit's observable feature.", method.evidence], explanation: `${method.plant} can disperse by ${method.method}: ${method.evidence}.`, correct: "Dispersal method matched to observable evidence.", repair: "Highlight the wing, hook, floating covering, edible fruit or splitting pod before choosing a movement method.", tag: "all_seeds_fall_beside_parent", hook: "seed-journey" });
    }
    if (mode === "word_sort") {
      const answer = Object.fromEntries(parts.slice(0, 5).map((x) => [x.name, x.functions[0]]));
      return science({ id: `function-sort-${i + 1}`, format: "explain-choice", blueprint: "function-match-cards", band: "secure", concept: mode,
        prompt: `Plant-job sort ${i + 1}: match each concise job card to the part that mainly performs it.`, body: { parts: Object.keys(answer), job_cards: rotate(Object.values(answer), i % 5), expected_groups: answer, one_job_may_link_to_system_note: true }, answer,
        hints: ["Use the main function taught for each part.", "Remember that parts also work together as a system."], explanation: parts.slice(0, 5).map((x) => `${x.name}: ${x.functions[0]}`).join("; "), correct: "Five plant-part functions matched accurately.", repair: "Match ROOTS and LEAVES first, then use support/transport and pollination/seed clues for the remaining cards.", tag: "plant_jobs_randomly_swapped", hook: "function-card-sort" });
    }
    const answer = item.functions[i % item.functions.length];
    return science({ id: `${mode}-${slug(item.name)}-${i + 1}`, format: "explain-choice", blueprint: "function-match-cards", band: mode === "part_function_match" ? "developing" : "expected", concept: mode,
      prompt: `Function-card mission ${i + 1}: which job belongs to ${item.name}?`, body: { part: item.name, choices: [answer, ...parts.filter((x) => x.name !== item.name).slice(0, 3).map((x) => x.functions[0])], evidence_clue: item.feature, model_location: item.location }, answer,
      hints: [`Locate ${item.name}: ${item.location}.`, item.feature], explanation: `${item.name} ${answer}. Plant parts often have more than one connected function.`, correct: `Function matched to ${item.name}: ${answer}.`, repair: "Keep the part label and diagram visible, compare only two job cards and trace what the part connects to.", tag: item.name === "roots" ? "roots_only_anchor" : item.name === "leaves" ? "leaf_decoration" : "flower_leaf_function_confusion", hook: "function-card-snap" });
  });
}

function causeCandidates(count) {
  const modes = ["blocked_root_intake", "blocked_stem_transport", "reduced_light", "requirement_change", "water_transport_sequence", "fair_comparison", "prediction_evidence"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length];
    if (mode === "water_transport_sequence") {
      const answer = ["water in the growing medium", "roots take in water", "water moves through the stem or trunk", "water reaches leaves and other parts"];
      return science({ id: `transport-${i + 1}`, format: "plant-simulation", blueprint: "greenhouse-cause-tests", band: "expected", concept: mode,
        prompt: `Water-route mission ${i + 1}: order the simple model of water transport.`, body: { cards: rotate(answer, i % answer.length), transport_model: "labelled tubes/path in stem", coloured_water_practical_note: "teacher-led demonstration only; colour traces water movement but is not the water itself" }, answer,
        hints: ["Begin outside the plant in the growing medium.", "Roots take water in before the stem carries it upwards."], explanation: `${answer.join(" → ")}. This is a simple Year 3 model of water transport.`, correct: "Water-transport stages ordered from growing medium to plant parts.", repair: "Anchor ROOTS TAKE IN and STEM CARRIES, then place the starting water and destination cards.", tag: "stem_makes_water", hook: "water-transport-sequence" });
    }
    if (mode === "fair_comparison") {
      const test = investigations[i % investigations.length], answer = `Change only ${test.changed}; keep ${test.controls.join(", ")} the same.`;
      return science({ id: `fair-compare-${slug(test.topic)}-${i + 1}`, format: "plant-simulation", blueprint: "greenhouse-cause-tests", band: "secure", concept: mode,
        prompt: `Fair-test simulator ${i + 1}: which setup best tests the effect of ${test.topic}?`, body: { question: `How does ${test.topic} affect plant growth?`, changed_variable: test.changed, control_variables: test.controls, outcome_measure: test.outcome, choices: [answer, "Change water, light, plant type and pot together.", "Observe two different plants once with no measurements."], repeated_observations: true }, answer,
        hints: ["Change one factor that answers the question.", "Keep other important conditions alike and measure over time."], explanation: `${answer} Observe ${test.outcome} at regular times and compare the evidence.`, correct: "Fair comparison changes one variable and controls others.", repair: "Place the changed-variable card alone, then move every other condition to the KEEP SAME tray.", tag: "many_variables_changed", hook: "fair-test-simulator" });
    }
    if (mode === "prediction_evidence") {
      const requirementItem = requirements[i % requirements.length], answer = `${requirementItem.effect}, because ${requirementItem.link}.`;
      return science({ id: `predict-${slug(requirementItem.name)}-${i + 1}`, format: "plant-simulation", blueprint: "greenhouse-cause-tests", band: "expected", concept: mode,
        prompt: `Predict-run-observe mission ${i + 1}: predict what may happen when ${requirementItem.name} is limited, then choose the supported explanation.`, body: { changed_condition: requirementItem.name, before_after_panels: true, choices: [answer, "Nothing can change because plants do not need resources.", "The flower creates the missing requirement."], observation_times: ["start", "later", "final"] }, answer,
        hints: ["Link the requirement to a plant part or process.", "Use may/can because real plants vary."], explanation: answer, correct: "Prediction connected to requirement and later observations.", repair: "Keep the changed condition visible, reveal one before/after difference and complete “may happen because…”.", tag: "prediction_without_cause", hook: "predict-run-observe" });
    }
    const scenarios = {
      blocked_root_intake: ["roots cannot take in water", "The plant may wilt because less water enters and reaches other parts.", "roots_only_anchor"],
      blocked_stem_transport: ["water movement through the stem is blocked", "Leaves and flowers may receive less water because the transport path is interrupted.", "stem_only_supports"],
      reduced_light: ["leaves receive much less light", "The plant may make less food, so growth may slow or become weak.", "leaf_decoration"],
    };
    if (scenarios[mode]) {
      const [change, answer, tag] = scenarios[mode];
      return science({ id: `${mode}-${i + 1}`, format: "plant-simulation", blueprint: "greenhouse-cause-tests", band: "expected", concept: mode,
        prompt: `Greenhouse cause test ${i + 1}: what may happen if ${change}?`, body: { blocked_or_changed_function: change, choices: [answer, "The plant instantly changes into another species.", "A flower replaces every missing function."], static_before_after_available: true, one_variable_changed: true }, answer,
        hints: ["Name the missing function first.", "Trace which other plant parts depend on it."], explanation: answer, correct: "Cause-and-effect prediction follows the blocked plant function.", repair: "Show FUNCTION WORKING and FUNCTION BLOCKED panels, trace one dependency arrow and use cautious “may” language.", tag, hook: "greenhouse-cause-test" });
    }
    const requirementItem = requirements[i % requirements.length], answer = requirementItem.effect;
    return science({ id: `requirement-${slug(requirementItem.name)}-${i + 1}`, format: "plant-simulation", blueprint: "greenhouse-cause-tests", band: "developing", concept: mode,
      prompt: `Growth-requirement mission ${i + 1}: what is a likely effect if ${requirementItem.name} is unsuitable?`, body: { requirement: requirementItem.name, part_process_link: requirementItem.link, choices: [answer, "The plant no longer has any parts.", "Every plant responds in exactly the same way immediately."], individual_variation_note: true }, answer,
      hints: [requirementItem.link, "Use likely/may because plants and conditions vary."], explanation: `${requirementItem.effect}. The link is that ${requirementItem.link}.`, correct: "Growth requirement linked to an age-appropriate likely effect.", repair: "Match REQUIREMENT to PART/PROCESS, then choose between one supported and one unrelated outcome.", tag: "plants_only_need_water", hook: "requirement-change-test" });
  });
}

function explanationCandidates(count) {
  const modes = ["because_part_function", "evidence_comparison", "investigation_question", "variables_plan", "results_conclusion", "pollination_explanation", "seed_formation_sequence", "dispersal_explanation"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], partItem = parts[i % parts.length], test = investigations[i % investigations.length];
    if (mode === "variables_plan") {
      const answer = { change: test.changed, keep_same: test.controls, measure: test.outcome };
      return science({ id: `plan-${slug(test.topic)}-${i + 1}`, format: "explain-choice", blueprint: "because-explanations", band: "secure", concept: mode,
        prompt: `Garden-lab planner ${i + 1}: complete CHANGE, KEEP SAME and MEASURE for “How does ${test.topic} affect growth?”`, body: { investigation_question: `How does ${test.topic} affect growth?`, cards: rotate([test.changed, ...test.controls, test.outcome], i % (test.controls.length + 2)), planner_columns: ["change", "keep the same", "measure/observe"], expected_plan: answer, safe_teacher_led: true }, answer,
        hints: ["The changed variable answers the question.", "Measure the outcome repeatedly and keep comparison conditions alike."], explanation: `Change ${test.changed}; keep ${test.controls.join(", ")} the same; measure ${test.outcome}.`, correct: "Investigation variables organised into a fair-test plan.", repair: "Fill CHANGE first, MEASURE second, then move all remaining conditions to KEEP SAME.", tag: "many_variables_changed", hook: "garden-lab-planner" });
    }
    if (mode === "investigation_question") {
      const answer = `How does ${test.topic} affect ${test.outcome}?`;
      return science({ id: `question-${slug(test.topic)}-${i + 1}`, format: "explain-choice", blueprint: "because-explanations", band: "expected", concept: mode,
        prompt: `Question-builder mission ${i + 1}: choose a testable plant-growth question.`, body: { choices: [answer, "Which plant is nicest?", "Why are all plants exactly the same?"], changed_variable: test.changed, outcome_measure: test.outcome }, answer,
        hints: ["A testable question names something to change and something to observe or measure.", "Avoid preference words such as nicest."], explanation: `“${answer}” can be investigated with a fair comparison and repeated observations.`, correct: "Testable plant-growth question selected.", repair: "Choose one CHANGE card and one MEASURE card, then place them in “How does __ affect __?”.", tag: "preference_as_science_question", hook: "question-builder" });
    }
    if (mode === "results_conclusion" || mode === "evidence_comparison") {
      const change = mode === "results_conclusion" ? "received regular suitable water" : "received more light";
      const values = mode === "results_conclusion" ? [4, 7, 11] : [3, 6, 9], comparison = mode === "results_conclusion" ? [4, 5, 5] : [3, 4, 5];
      const answer = `The evidence supports that ${change} was linked with greater growth in this test, because the measured values were ${values.join(", ")} cm compared with ${comparison.join(", ")} cm.`;
      return science({ id: `${mode}-${i + 1}`, format: "explain-choice", blueprint: "because-explanations", band: "secure", concept: mode,
        prompt: `Evidence-table mission ${i + 1}: choose the conclusion supported by the repeated measurements.`, body: { condition_a: change, measurements_a_cm: values, condition_b: "comparison condition", measurements_b_cm: comparison, choices: [answer, "This proves every plant everywhere will respond identically.", "The plant with the prettiest pot grew most."], limited_conclusion_language: true }, answer,
        hints: ["Compare measurements at the same observation times.", "Say “in this test” rather than overgeneralising."], explanation: answer, correct: "Conclusion uses repeated measurements and cautious scope.", repair: "Highlight the two final measurements, state the observed difference and add “in this test”.", tag: "conclusion_ignores_evidence", hook: "evidence-table-compare" });
    }
    if (mode === "pollination_explanation") {
      const answer = "Seeds can form after pollen is transferred to the receiving part of a flower, for example by insects or wind.";
      return science({ id: `pollination-because-${i + 1}`, format: "explain-choice", blueprint: "because-explanations", band: "secure", concept: mode,
        prompt: `Pollination explanation ${i + 1}: which because statement links flowers and seed formation?`, body: { choices: [answer, "Seeds form because leaves are decorative.", "Every flower becomes a seed without pollination."], evidence_sequence: ["pollen on flower", "pollen transfer", "seed formation can follow"] }, answer,
        hints: ["Use pollen transfer and flower parts.", "Use can form; not every flower necessarily forms seeds."], explanation: answer, correct: "Flower role, pollination and possible seed formation linked accurately.", repair: "Order the pollen-transfer cards, then complete “Seeds can form after…”.", tag: "flower_only_decoration", hook: "pollination-because" });
    }
    if (mode === "seed_formation_sequence") {
      const answer = ["flower develops", "pollination occurs", "seeds begin to form", "fruit or seed head may develop", "seeds are dispersed"];
      return science({ id: `seed-sequence-${i + 1}`, format: "explain-choice", blueprint: "because-explanations", band: "secure", concept: mode,
        prompt: `Flower-to-seed mission ${i + 1}: order the age-appropriate life-cycle model.`, body: { cards: rotate(answer, i % answer.length), variation_note: "details vary among flowering plants; fruit formation is not identical in every example" }, answer,
        hints: ["Pollination happens before seed formation.", "Dispersal moves formed seeds away from the parent plant."], explanation: `${answer.join(" → ")}. This is a simplified model; flowering plants vary in detail.`, correct: "Flower, pollination, seed formation and dispersal sequenced.", repair: "Anchor FLOWER first and DISPERSAL last, then place pollination before seed formation.", tag: "dispersal_before_seed_formation", hook: "flower-seed-sequence" });
    }
    if (mode === "dispersal_explanation") {
      const method = dispersal[i % dispersal.length], answer = `${method.plant} seeds can be dispersed by ${method.method} because ${method.evidence}.`;
      return science({ id: `dispersal-because-${method.plant}-${i + 1}`, format: "explain-choice", blueprint: "because-explanations", band: "expected", concept: mode,
        prompt: `Dispersal-evidence mission ${i + 1}: choose the strongest because explanation.`, body: { plant: method.plant, choices: [answer, "The seeds travel because every seed has wings.", "Dispersal means the parent plant walks away."], feature_card: method.evidence }, answer,
        hints: ["Name the method and observable seed/fruit feature.", "Different plants use different dispersal methods."], explanation: answer, correct: "Seed dispersal method justified by observable adaptation evidence.", repair: "Match the feature card to wind, animal, water or splitting-pod movement before completing the because sentence.", tag: "all_seeds_same_method", hook: "dispersal-evidence" });
    }
    const answer = `${partItem.name} ${partItem.functions[0]} because ${partItem.feature}.`;
    return science({ id: `because-${slug(partItem.name)}-${i + 1}`, format: "explain-choice", blueprint: "because-explanations", band: "secure", concept: mode,
      prompt: `Scientific-because mission ${i + 1}: choose the explanation linking ${partItem.name}, function and evidence.`, body: { part: partItem.name, choices: [answer, `${partItem.name} has this job because it looks nice.`, "All plant parts do exactly the same job."], evidence_highlight: partItem.feature }, answer,
      hints: ["Name the part's function.", "Use structural or observation evidence after because."], explanation: answer, correct: "Part, function and evidence linked in a because explanation.", repair: "Use three cards—PART, FUNCTION, EVIDENCE—and place because between function and evidence.", tag: "because_without_evidence", hook: "because-evidence-link", audioScript: i % 4 === 0 ? `Choose the explanation linking ${partItem.name}, its function and the evidence.` : undefined });
  });
}

function retrievalCandidates(count) {
  const modes = ["part_function_retrieval", "transport_retrieval", "requirements_retrieval", "pollination_retrieval", "dispersal_retrieval", "fair_test_retrieval", "diagram_transfer", "misconception_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length], partItem = parts[i % parts.length];
    if (mode === "transport_retrieval") {
      const answer = ["roots take in water", "stem or trunk carries water", "water reaches leaves and flowers"];
      return retrieve({ id: `transport-${i + 1}`, concept: mode, prompt: `Water-path revisit ${i + 1}: after ${day} days, rebuild the transport sequence.`, body: { cards: rotate(answer, i % 3), review_interval_days: day }, answer,
        explanation: `${answer.join(" → ")}.`, tag: "stem_makes_water" });
    }
    if (mode === "requirements_retrieval") {
      const req = requirements[i % requirements.length], answer = req.link;
      return retrieve({ id: `requirement-${slug(req.name)}-${i + 1}`, concept: mode, prompt: `Growth-needs revisit ${i + 1}: how is ${req.name} linked to plant growth?`, body: { requirement: req.name, choices: [req.link, "It is only decoration.", "Every plant needs exactly the same amount in every condition."], likely_effect: req.effect, review_interval_days: day }, answer,
        explanation: `${req.link}; ${req.effect}.`, tag: "plants_only_need_water" });
    }
    if (mode === "pollination_retrieval") {
      const answer = "pollen transfer between flower parts can lead to seed formation";
      return retrieve({ id: `pollination-${i + 1}`, concept: mode, prompt: `Flower-role revisit ${i + 1}: complete the link between pollination and seeds.`, body: { choices: [answer, "leaves turn directly into seeds", "flowers only make food using light"], agents: ["insects", "wind"], review_interval_days: day }, answer,
        explanation: `Pollination is pollen transfer; successful pollination can lead to seed formation.`, tag: "pollination_is_food_making" });
    }
    if (mode === "dispersal_retrieval") {
      const method = dispersal[i % dispersal.length], answer = method.method;
      return retrieve({ id: `dispersal-${method.plant}-${i + 1}`, concept: mode, prompt: `Seed-journey revisit ${i + 1}: which method fits ${method.plant}?`, body: { plant: method.plant, evidence: method.evidence, choices: [method.method, ...dispersal.filter((x) => x.method !== method.method).slice(0, 2).map((x) => x.method)], review_interval_days: day }, answer,
        explanation: `${method.plant}: ${method.method}, because ${method.evidence}.`, tag: "all_seeds_same_method" });
    }
    if (mode === "fair_test_retrieval") {
      const test = investigations[i % investigations.length], answer = `Change ${test.changed}; keep ${test.controls.join(", ")} the same; measure ${test.outcome}.`;
      return retrieve({ id: `fair-${slug(test.topic)}-${i + 1}`, concept: mode, prompt: `Investigation revisit ${i + 1}: choose the fair plan for testing ${test.topic}.`, body: { choices: [answer, "Change several conditions and compare once.", "Choose the plant that looks nicest."], review_interval_days: day }, answer,
        explanation: answer, tag: "many_variables_changed" });
    }
    if (mode === "diagram_transfer") {
      const answer = partItem.name;
      return retrieve({ id: `diagram-${slug(partItem.name)}-${i + 1}`, concept: mode, prompt: `New-diagram revisit ${i + 1}: identify the part from structure, position and connection.`, body: { diagram_style: ["line drawing", "photograph", "cross-section model", "tactile outline"][i % 4], clues: [partItem.location, partItem.feature], choices: [partItem.name, ...parts.filter((x) => x.name !== partItem.name).slice(0, 2).map((x) => x.name)], review_interval_days: day }, answer,
        explanation: `${partItem.name}: ${partItem.location}; ${partItem.feature}.`, tag: "diagram_orientation_changes_part" });
    }
    if (mode === "misconception_transfer") {
      const answer = "Use part-function evidence and test one changed condition; do not decide from colour, decoration or one observation alone.";
      return retrieve({ id: `repair-${i + 1}`, concept: mode, prompt: `Greenhouse-toolkit revisit ${i + 1}: which routine repairs a plant-function guess?`, body: { choices: [answer, "Every bright part is a flower and every green part is a leaf.", "Change all conditions together."], review_interval_days: day }, answer,
        explanation: answer, tag: "plant_function_guess" });
    }
    const answer = partItem.functions[0];
    return retrieve({ id: `part-${slug(partItem.name)}-${i + 1}`, concept: mode, prompt: `Plant-job revisit ${i + 1}: choose one main function of ${partItem.name}.`, body: { part: partItem.name, choices: [answer, ...parts.filter((x) => x.name !== partItem.name).slice(0, 2).map((x) => x.functions[0])], review_interval_days: day }, answer,
      explanation: `${partItem.name} ${answer}.`, tag: partItem.name === "roots" ? "roots_only_anchor" : "plant_jobs_randomly_swapped" });
  });
}

function retrieve({ id, concept, prompt, body, answer, explanation, tag }) {
  return science({ id, format: "label-drag", blueprint: "plant-function-retrieval", band: "retrieval", concept, prompt, body, answer,
    hints: ["Use the diagram, sequence, requirement or fair-test planner that matches the question.", "Check one evidence link rather than answering from colour or memory alone."], explanation, correct: `Spaced plant-science evidence retained. ${explanation}`, repair: "Return to one static model or planner, preserve correct cards and retry with two choices.", tag, hook: "greenhouse-retrieval" });
}

function science({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_use_diagram_text_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_diagram_model_sequence_or_planner" };
  const sequence = Array.isArray(answer);
  return {
    id: `${prefix}${slug(blueprint)}-${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      interaction_mode: "label_build_sequence_compare_plan_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, move the learner's named card or record an indicated explanation without supplying the science conclusion.",
      plant_part_model_route: "Clear varied diagrams with named connection points, outline mode, concise alt descriptions and a two-column part/function table.",
      transport_sequence_route: "Static water-drop sequence from growing medium to roots, stem/trunk and leaves with text labels; animation is optional.",
      evidence_comparison_route: "Side-by-side before/after panels or simple tables with one changed condition and repeated observations.",
      investigation_planner_route: "CHANGE, KEEP SAME and MEASURE/OBSERVE columns accept picture, text, pointing or adult-scribed cards.",
      send_support: { one_concept_per_panel: true, reduced_choice_mode: true, diagram_and_text_labels: true, colour_not_required: true, predictable_card_positions: true, adult_scribed_equal_evidence: true },
      sensory_safe_route: "No sudden sounds, flashing, compulsory plant handling, strong smells or distressing wilt animation; tactile materials and real specimens are optional.",
      tactile_optional_route: "Use raised plant outlines, pipe-cleaner stems or textured cards only by choice; complete visual, auditory and text routes remain available.",
      visual_route: "Low-clutter plant model, generous spacing, persistent part labels and no function encoded by colour alone.",
      processing_route: "Reveal one part, transport stage, variable or evidence row at a time; preserve correct work and allow repeated viewing.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed placement can replace dragging, speech and handwriting.",
      practical_safety: "Teacher-led plant work; check allergies and sensitivities, do not taste plants or solutions, wash hands after handling soil or plant material.",
      low_visual_load: true, reduced_motion: "static_before_after_and_instant_card_placement", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "help a calm garden lab organise one plant-science evidence card", reward: "one greenhouse badge leaf for a checked model, sequence or fair plan", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct evidence stays. Choose another model or clue and continue." },
      age_appropriate_scope: "year3_flowering_plant_functions_growth_requirements_transport_pollination_seed_formation_and_dispersal",
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: sequence ? { sequence: answer } : { value: answer }, hints, explanation,
    feedback: { correct, repair, science_evidence: explanation, support_message: "Labelling, sequencing, pointing, eye gaze, AAC, oral explanation and adult-scribed planning carry equal evidence; speed, handwriting and handling materials are not scored." },
    difficulty: band === "intro" ? 2 : band === "developing" ? 3 : band === "expected" ? 4 : band === "secure" ? 5 : 4,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated, curatedBlueprint) {
  if (curated.length !== 3) throw new Error(`Expected 3 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 217) throw new Error("Pilot must contain 3 curated and 217 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["identify_part", "diagram_label", "varied_plant_model", "part_system_order", "part_function_match", "root_stem_connection", "leaf_flower_contrast", "pollination_role", "seed_dispersal_match", "blocked_root_intake", "blocked_stem_transport", "reduced_light", "requirement_change", "water_transport_sequence", "fair_comparison", "prediction_evidence", "because_part_function", "investigation_question", "variables_plan", "results_conclusion", "pollination_explanation", "seed_formation_sequence", "dispersal_explanation", "transport_retrieval", "fair_test_retrieval"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.send_support?.reduced_choice_mode || !b.plant_part_model_route || !b.transport_sequence_route || !b.evidence_comparison_route || !b.investigation_planner_route || !b.sensory_safe_route || !b.tactile_optional_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/sensory route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.science_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function part(name, location, functions, feature) { return { name, location, functions, feature }; }
function requirement(name, link, effect) { return { name, link, effect }; }
function disperse(plant, method, evidence) { return { plant, method, evidence }; }
function investigation(topic, controls, changed, outcome) { return { topic, controls, changed, outcome }; }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
