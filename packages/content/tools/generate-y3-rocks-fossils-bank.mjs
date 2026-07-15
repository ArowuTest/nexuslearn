#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y3-rocks-and-fossils.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y3-rocks-fossils-bank-";
const reviewBatch = "y3-rocks-fossils-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "rock-observation-and-grouping": 44,
  "comparative-rock-property-tests": 44,
  "fossil-formation-sequences": 44,
  "soil-components-and-comparison": 44,
  "rocks-fossils-soils-retrieval": 44,
};

const sampleSets = [
  [sample("A", "grey", "large visible", "rough", "not layered", 2, 4), sample("B", "dark", "too small to see", "smooth", "thin layers", 4, 2), sample("C", "pale", "large visible", "speckled", "not layered", 1, 5), sample("D", "reddish", "fine", "rough", "clear layers", 3, 3)],
  [sample("E", "pale", "fine", "smooth", "not layered", 1, 5), sample("F", "grey", "medium visible", "rough", "not layered", 5, 2), sample("G", "dark", "fine", "smooth", "clear layers", 2, 4), sample("H", "mixed colours", "medium visible", "bumpy", "not layered", 4, 3)],
  [sample("J", "cream", "large visible", "rough", "clear layers", 5, 2), sample("K", "black", "too small to see", "smooth", "not layered", 1, 5), sample("L", "brown", "fine", "gritty", "thin layers", 4, 3), sample("M", "speckled", "large visible", "bumpy", "not layered", 2, 4)],
];

const fossilModels = [
  fossil("shell impression", ["A shell from a living animal rests on the seabed.", "Sediment covers the shell or its impression.", "More layers build and slowly harden into rock.", "The shell may dissolve while its shape remains as an impression.", "Later erosion may expose the fossil evidence."], "an impression of a shell that lived long ago"),
  fossil("footprint trace", ["An animal walks across soft mud and leaves a footprint.", "Sediment covers the footprint before it is destroyed.", "More layers build and slowly harden into rock.", "The track shape remains preserved as trace evidence.", "Later erosion may expose the fossil track."], "a preserved trace showing an animal moved across soft ground"),
  fossil("plant imprint", ["A leaf falls onto soft sediment.", "More sediment covers the leaf quickly enough to preserve its shape.", "Layers build and slowly form rock over a very long time.", "The leaf material may change or disappear while an imprint remains.", "Later erosion may reveal the imprint."], "a preserved imprint showing a plant lived long ago"),
  fossil("preserved hard part", ["An animal with a hard shell dies in water.", "Sediment buries some of its hard remains.", "More sediment layers build over a very long time.", "The layers harden and some evidence may be preserved in rock.", "Later uplift or erosion may expose the fossil."], "preserved evidence from hard remains of a past living thing"),
];

const soils = [
  soil("P", { rock_particles: 55, organic_matter: 15, water: 15, air_space: 15 }, "many mineral particles with some organic matter and spaces"),
  soil("Q", { rock_particles: 40, organic_matter: 30, water: 20, air_space: 10 }, "more organic matter than sample P"),
  soil("R", { rock_particles: 65, organic_matter: 10, water: 10, air_space: 15 }, "a high proportion of mineral particles"),
  soil("S", { rock_particles: 45, organic_matter: 20, water: 20, air_space: 15 }, "a mixture with visible mineral and organic components"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y3-rocks-and-fossils") throw new Error("This generator only supports the Year 3 rocks-and-fossils pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...groupingCandidates(targets["rock-observation-and-grouping"]),
  ...testCandidates(targets["comparative-rock-property-tests"]),
  ...fossilCandidates(targets["fossil-formation-sequences"]),
  ...soilCandidates(targets["soil-components-and-comparison"]),
  ...retrievalCandidates(targets["rocks-fossils-soils-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 3 rocks, fossils and soils pack with a deterministic 220-variant pilot bank. Four curated variants are unchanged. Generated tasks cover observable rock properties, consistent grouping rules, controlled absorption and comparative scratch tests, evidence-based suitability, simple fossil-formation sequences, fossils as evidence of past living things, soil formation and components, observation versus inference, fair comparisons, misconception repair and spaced transfer. Content deliberately avoids unsupported rock-cycle depth and avoids claiming that pictures alone identify named rocks. Every generated task includes property sorts/tests, evidence choices, fossil sequences or soil models, sensory-safe no-touch SEND routes, visual and alternative inputs, rich feedback and pressure-free geology missions without timers, streaks, lives or loss. Selected narration references ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent science, specimen safety, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-rocks-fossils-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y3-rocks-fossils-bank blueprints=${summary(pack.question_variants, (v) => v.body.variant_blueprint_id)}`);
console.log(`y3-rocks-fossils-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y3-rocks-fossils-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-rocks-fossils-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 rocks/fossils bank is out of date; run generate-y3-rocks-fossils-bank.mjs --write.");
  console.log("y3-rocks-fossils-bank deterministic check passed");
} else console.log("y3-rocks-fossils-bank dry-run; pass --write to update the pack");

function groupingCandidates(count) {
  const modes = ["group_by_grain", "group_by_texture", "group_by_layers", "multiple_valid_rules", "observation_not_inference", "rule_consistency", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const samples = sampleSets[i % sampleSets.length], mode = modes[i % modes.length];
    if (mode === "multiple_valid_rules") {
      const grainGroup = samples.filter((x) => x.grain.includes("visible")).map((x) => x.id), layeredGroup = samples.filter((x) => x.layers.includes("layer")).map((x) => x.id);
      const answer = "Both groupings can be valid if each stated property rule is applied consistently to every sample.";
      return science({ id: `valid-rules-${i + 1}`, format: "classification-rule", blueprint: "rock-observation-and-grouping", band: "secure", concept: mode,
        prompt: `Classification debate ${i + 1}: one geologist groups by visible grains and another by layers. Which conclusion is scientific?`, body: { samples, grouping_a: { rule: "visible grains", ids: grainGroup }, grouping_b: { rule: "layered appearance", ids: layeredGroup }, choices: [answer, "Only one grouping can ever be correct.", "Colour must decide every group."] }, answer,
        hints: ["A useful classification states its rule.", "Check whether the same rule is applied to all samples."], explanation: answer, correct: "Alternative evidence-based grouping rules accepted and checked.", repair: "Write each rule above a separate tray and test every sample description against both rules.", tag: "one_memorised_group_only", hook: "classification-rule-compare" });
    }
    if (mode === "observation_not_inference") {
      const target = samples[i % samples.length], answer = `${target.id} has ${target.grain} grains and a ${target.texture} surface.`;
      return science({ id: `observe-${target.id}-${i + 1}`, format: "classification-rule", blueprint: "rock-observation-and-grouping", band: "developing", concept: mode,
        prompt: `Observation-lens mission ${i + 1}: which statement records only visible evidence about sample ${target.id}?`, body: { sample: target, choices: [answer, `${target.id} definitely formed in a volcano.`, `${target.id} is best for every building.`], observation_fields: ["colour", "grain size", "texture", "layers"] }, answer,
        hints: ["An observation says what is visible or recorded.", "Origin and suitability need further evidence."], explanation: `${answer} It does not make an unsupported claim about origin or use.`, correct: "Observation separated from inference.", repair: "Underline only words present in the sample record and move origin/use claims to NEED MORE EVIDENCE.", tag: "observation_inference_confused", hook: "observation-lens" });
    }
    if (mode === "rule_consistency") {
      const answer = "Apply the same stated property threshold to every sample, including exceptions that do not fit the group.";
      return science({ id: `consistent-rule-${i + 1}`, format: "classification-rule", blueprint: "rock-observation-and-grouping", band: "secure", concept: mode,
        prompt: `Rule-check mission ${i + 1}: which instruction makes a property grouping consistent?`, body: { samples, choices: [answer, "Move a sample whenever its colour looks nicer.", "Use grain size for one sample and texture for another without saying so."], proposed_rule: "rough surface" }, answer,
        hints: ["One grouping needs one clear rule.", "Apply it to every record, not only favourite examples."], explanation: answer, correct: "Consistent classification rule selected.", repair: "Turn the rule into a yes/no question and ask it for each sample in order.", tag: "rule_changes_between_samples", hook: "rule-check" });
    }
    if (mode === "misconception_repair") {
      const answer = "Describe and group by stated observable properties; do not identify a named rock with certainty from colour or one picture.";
      return science({ id: `group-repair-${i + 1}`, format: "classification-rule", blueprint: "rock-observation-and-grouping", band: "expected", concept: mode,
        prompt: `Rock-group repair ${i + 1}: which rule fixes colour-only or name-memory grouping?`, body: { samples, choices: [answer, "All grey samples are the same rock in every property.", "A photograph proves the exact rock name."], property_table: true }, answer,
        hints: ["One colour can occur in different samples.", "Use grain, texture, layers and test evidence."], explanation: answer, correct: "Colour/name misconception repaired with property evidence.", repair: "Hide names and colours, choose one grain/texture/layer rule and apply it to all sample records.", tag: "colour_or_name_only", hook: "rock-group-repair" });
    }
    const property = mode === "group_by_grain" ? "grain" : mode === "group_by_texture" ? "texture" : "layers";
    const targetValue = samples[i % samples.length][property], answer = samples.filter((x) => x[property] === targetValue).map((x) => x.id);
    return science({ id: `${mode}-${slug(targetValue)}-${i + 1}`, format: "classification-rule", blueprint: "rock-observation-and-grouping", band: "intro", concept: mode,
      prompt: `Sample-sort mission ${i + 1}: group every sample whose ${property} is “${targetValue}”.`, body: { samples, grouping_property: property, grouping_value: targetValue, choices: samples.map((x) => x.id), multiple_selection: true }, answer,
      hints: [`Use only the ${property} column for this grouping.`, "Different colours or names do not change the stated rule."], explanation: `Samples ${answer.join(", ")} match the rule ${property} = ${targetValue}.`, correct: "Samples grouped consistently by one observable property.", repair: `Keep the ${property} column visible, cover other columns and check each sample with the same yes/no question.`, tag: "colour_or_name_only", hook: "field-sample-sort", audioScript: i % 5 === 0 ? `Group the rock samples using the property ${property}: ${targetValue}.` : undefined });
  });
}

function testCandidates(count) {
  const modes = ["absorption_compare", "scratch_compare", "fair_test_plan", "identify_tested_property", "suitability_evidence", "results_conclusion", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const samples = sampleSets[i % sampleSets.length], a = samples[i % samples.length], b = samples[(i + 1) % samples.length], mode = modes[i % modes.length];
    if (mode === "fair_test_plan") {
      const answer = "Change only the rock sample; keep drop number, drop size, tested area and waiting time the same.";
      return science({ id: `fair-plan-${i + 1}`, format: "rock-property-lab", blueprint: "comparative-rock-property-tests", band: "secure", concept: mode,
        prompt: `Property-lab planner ${i + 1}: choose a fair water-absorption comparison.`, body: { changed_variable: "rock sample", control_variables: ["drop number", "drop size", "tested area", "waiting time"], choices: [answer, "Use different amounts of water and waiting times.", "Compare colour instead of recording water."], safe_virtual_test: true }, answer,
        hints: ["Change the sample because that is what is compared.", "Keep application and observation conditions alike."], explanation: answer, correct: "Fair comparative-test variables identified.", repair: "Put ROCK SAMPLE in CHANGE and every amount/time/area card in KEEP SAME.", tag: "test_conditions_changed", hook: "fair-test-planner" });
    }
    if (mode === "identify_tested_property") {
      const test = i % 2 ? "equal drops are applied and remaining water is recorded" : "the same comparison tool is used to see which surface scratches more easily";
      const answer = i % 2 ? "water absorption" : "comparative resistance to scratching";
      return science({ id: `tested-property-${i + 1}`, format: "rock-property-lab", blueprint: "comparative-rock-property-tests", band: "developing", concept: mode,
        prompt: `Test-name mission ${i + 1}: which property does this procedure compare?`, body: { procedure: test, choices: [answer, "mass", "colour", "strength in every situation"], classroom_test_limit: "comparison only, not an absolute geological hardness value" }, answer,
        hints: ["Name what the observation actually records.", "Do not claim an untested property."], explanation: `The procedure compares ${answer}; it does not provide evidence about mass, colour or every kind of strength.`, correct: "Test procedure linked to the property it measures.", repair: "Highlight the action and recorded result, then match only the property directly changed or observed.", tag: "property_terms_conflated", hook: "test-property-label" });
    }
    if (mode === "suitability_evidence") {
      const use = i % 2 ? "an outdoor path surface where low water absorption is useful" : "a surface expected to resist simple scratching";
      const chosen = i % 2 ? (a.absorption <= b.absorption ? a : b) : (a.scratchResistance >= b.scratchResistance ? a : b);
      const answer = `Sample ${chosen.id}, because its recorded ${i % 2 ? "water absorption is lower" : "scratch resistance is higher"} in the fair comparison.`;
      return science({ id: `suitability-${a.id}-${b.id}-${i + 1}`, format: "rock-property-lab", blueprint: "comparative-rock-property-tests", band: "secure", concept: mode,
        prompt: `Suitability-from-evidence mission ${i + 1}: choose between ${a.id} and ${b.id} for ${use}.`, body: { samples: [a, b], intended_use: use, relevant_property: i % 2 ? "water absorption" : "comparative scratch resistance", choices: [answer, `Sample ${chosen.id}, because its colour is nicer.`, "Either sample is proven suitable for every possible use."], evidence_limited_claim: true }, answer,
        hints: ["Choose the property relevant to the stated use.", "Do not claim more than the test evidence supports."], explanation: answer, correct: "Simple suitability claim justified by relevant property evidence.", repair: "Underline the use requirement, reveal only the matching test column and write “for this use” in the conclusion.", tag: "suitability_by_colour", hook: "suitability-evidence" });
    }
    if (mode === "misconception_repair") {
      const answer = "Name the tested property and use only that result; hard, heavy, strong and waterproof are not interchangeable.";
      return science({ id: `test-repair-${i + 1}`, format: "rock-property-lab", blueprint: "comparative-rock-property-tests", band: "expected", concept: mode,
        prompt: `Property-language repair ${i + 1}: which rule fixes a conclusion that mixes property terms?`, body: { choices: [answer, "One absorption result proves every property.", "A heavier-looking image must be harder."], evidence_columns: ["absorbed drops", "comparative scratch result"] }, answer,
        hints: ["Each test supports one kind of claim.", "Use precise property words."], explanation: answer, correct: "Property terms separated and evidence scope repaired.", repair: "Match each result column to one property label, then cross out claims about properties that were not tested.", tag: "property_terms_conflated", hook: "property-language-repair" });
    }
    if (mode === "scratch_compare") {
      const answer = a.scratchResistance === b.scratchResistance ? "The samples had the same comparative scratch result." : a.scratchResistance > b.scratchResistance ? `Sample ${a.id} resisted scratching more than ${b.id}.` : `Sample ${b.id} resisted scratching more than ${a.id}.`;
      return science({ id: `scratch-${a.id}-${b.id}-${i + 1}`, format: "rock-property-lab", blueprint: "comparative-rock-property-tests", band: "developing", concept: mode,
        prompt: `Virtual scratch comparison ${i + 1}: interpret the results produced with the same tool and force.`, body: { samples: [a.id, b.id], results: { [a.id]: a.scratchResistance, [b.id]: b.scratchResistance }, controls: ["same virtual tool", "same virtual force", "same area"], choices: [answer, "The result proves which sample is heavier.", "Colour caused the result."], no_real_scratching_required: true }, answer,
        hints: ["Higher recorded resistance means harder to scratch in this comparison.", "This classroom-style test is comparative, not an absolute hardness scale."], explanation: answer, correct: "Comparative scratch result interpreted within its limits.", repair: "Keep the shared test conditions visible and compare only the two result values.", tag: "property_terms_conflated", hook: "virtual-scratch-test" });
    }
    const answer = a.absorption === b.absorption ? "Both samples absorbed the same number of drops." : a.absorption > b.absorption ? `Sample ${a.id} absorbed more water than ${b.id}.` : `Sample ${b.id} absorbed more water than ${a.id}.`;
    return science({ id: `${mode}-${a.id}-${b.id}-${i + 1}`, format: "rock-property-lab", blueprint: "comparative-rock-property-tests", band: mode === "absorption_compare" ? "developing" : "expected", concept: mode,
      prompt: `Equal-drop mission ${i + 1}: interpret the absorption table.`, body: { samples: [a.id, b.id], absorbed_drops: { [a.id]: a.absorption, [b.id]: b.absorption }, controls: ["five equal drops", "same waiting time", "same tested area"], choices: [answer, "The test proves which sample is heavier.", "Both samples have every property in common."], numeric_table_available: true }, answer,
      hints: ["Compare absorbed drops only.", "Do not infer hardness or mass from an absorption test."], explanation: answer, correct: "Absorption conclusion matches the controlled test evidence.", repair: "Cover untested-property choices and compare the two absorbed-drop values under identical conditions.", tag: "property_terms_conflated", hook: "equal-drop-absorption-test" });
  });
}

function fossilCandidates(count) {
  const modes = ["sequence_order", "missing_stage", "fossil_evidence", "trace_or_remain", "observation_inference", "not_every_organism", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = fossilModels[i % fossilModels.length], mode = modes[i % modes.length];
    if (mode === "missing_stage") {
      const gap = 1 + (i % (item.stages.length - 2)), answer = item.stages[gap];
      return science({ id: `fossil-missing-${slug(item.type)}-${gap}-${i + 1}`, format: "fossil-sequence", blueprint: "fossil-formation-sequences", band: "expected", concept: mode,
        prompt: `Fossil-layer gap ${i + 1}: which event belongs between the neighbouring stages?`, body: { fossil_type: item.type, sequence: item.stages.map((x, n) => n === gap ? null : x), choices: [answer, "The fossil forms instantly in open air.", "Every organism becomes a complete fossil."], missing_position: gap + 1 }, answer,
        hints: ["Use what must happen before and after the gap.", "Burial and layer build-up come before later exposure."], explanation: `${item.stages.join(" → ")}`, correct: "Missing fossil-formation event restored causally.", repair: "Keep the two neighbouring cards, ask what process connects them and reduce to two stage choices.", tag: "instant_whole_fossil", hook: "fossil-sequence-gap" });
    }
    if (mode === "fossil_evidence") {
      const answer = `The ${item.type} is ${item.evidence}. It supports an inference about a living thing from long ago.`;
      return science({ id: `evidence-${slug(item.type)}-${i + 1}`, format: "fossil-sequence", blueprint: "fossil-formation-sequences", band: "secure", concept: mode,
        prompt: `Past-life evidence mission ${i + 1}: what can this fossil carefully support?`, body: { fossil_type: item.type, observable_record: item.evidence, choices: [answer, "It proves the exact colour of the whole organism.", "It proves every organism became a fossil."], evidence_limit: true }, answer,
        hints: ["A fossil preserves particular remains, impressions or traces.", "Do not infer features the evidence does not show."], explanation: answer, correct: "Fossil used as bounded evidence of past living things.", repair: "Separate WHAT IS OBSERVED from WHAT CAN BE INFERRED and cross out unsupported colour or completeness claims.", tag: "fossil_tells_every_detail", hook: "fossil-evidence-frame" });
    }
    if (mode === "trace_or_remain") {
      const answer = item.type.includes("footprint") ? "trace fossil evidence" : item.type.includes("impression") || item.type.includes("imprint") ? "impression fossil evidence" : "preserved remain evidence";
      return science({ id: `kind-${slug(item.type)}-${i + 1}`, format: "fossil-sequence", blueprint: "fossil-formation-sequences", band: "developing", concept: mode,
        prompt: `Fossil-kind mission ${i + 1}: which simple description fits ${item.type}?`, body: { fossil_type: item.type, choices: [answer, "the complete original living organism unchanged", "a rock made instantly yesterday"], distinction: ["remain", "impression", "trace"] }, answer,
        hints: ["A track is a trace; a shape pressed into material is an impression.", "Some hard remains may be preserved or changed."], explanation: `${item.type} is ${answer}.`, correct: "Remain, impression and trace distinguished at age-appropriate depth.", repair: "Match footprint to TRACE, pressed shape to IMPRESSION and preserved hard part to REMAIN.", tag: "fossil_is_whole_organism", hook: "fossil-kind-sort" });
    }
    if (mode === "observation_inference") {
      const answer = { observation: `A ${item.type} shape is preserved in a rock layer.`, inference: item.evidence };
      return science({ id: `fossil-observe-${slug(item.type)}-${i + 1}`, format: "fossil-sequence", blueprint: "fossil-formation-sequences", band: "secure", concept: mode,
        prompt: `Fossil reasoning mission ${i + 1}: sort the observation and inference.`, body: { cards: [answer.observation, answer.inference], trays: ["observation", "inference"], expected_groups: answer }, answer,
        hints: ["Observation states what is present in the rock.", "Inference uses that evidence to suggest something about the past."], explanation: `${answer.observation} From this, scientists may infer ${answer.inference}.`, correct: "Fossil observation separated from inference.", repair: "Underline visible/recorded words in one card and past-life reasoning words in the other.", tag: "observation_inference_confused", hook: "fossil-observation-inference" });
    }
    if (mode === "not_every_organism" || mode === "misconception_repair") {
      const answer = "Only some remains, impressions or traces are buried and preserved; fossil formation usually takes a very long time.";
      return science({ id: `${mode}-${slug(item.type)}-${i + 1}`, format: "fossil-sequence", blueprint: "fossil-formation-sequences", band: "secure", concept: mode,
        prompt: `Fossil-model repair ${i + 1}: which statement fixes instant-fossil and every-organism misconceptions?`, body: { choices: [answer, "Every dead organism quickly becomes a complete fossil.", "A fossil is always the whole original organism unchanged."], conditional_language_required: true, long_time_language_required: true }, answer,
        hints: ["Use some and may.", "Include burial, layers and a very long time."], explanation: answer, correct: "Fossil misconception repaired with conditional and long-time language.", repair: "Add SOME/MAY and VERY LONG TIME cards to the sequence, then remove the instant/whole-organism claim.", tag: "instant_whole_fossil", hook: "fossil-model-repair" });
    }
    return science({ id: `sequence-${slug(item.type)}-${i + 1}`, format: "fossil-sequence", blueprint: "fossil-formation-sequences", band: "expected", concept: mode,
      prompt: `Fossil-time mission ${i + 1}: order the simple ${item.type} formation model.`, body: { fossil_type: item.type, cards: rotate(item.stages, i % item.stages.length), conditional_note: "some evidence may be preserved", time_language: "over a very long time" }, answer: item.stages,
      hints: ["Begin with the living thing, remains or trace before burial.", "Layer build-up and rock formation happen before later exposure."], explanation: `${item.stages.join(" → ")}`, correct: "Fossil sequence ordered with burial, long time and possible exposure.", repair: "Anchor first evidence and later discovery, then place burial before layer hardening.", tag: "instant_whole_fossil", hook: "fossil-layer-sequence", audioScript: i % 4 === 0 ? item.stages.join(" Then, ") : undefined });
  });
}

function soilCandidates(count) {
  const modes = ["component_identification", "mixture_claim", "compare_composition", "soil_formation", "air_water_spaces", "settling_model", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const a = soils[i % soils.length], b = soils[(i + 1) % soils.length], mode = modes[i % modes.length];
    if (mode === "component_identification") {
      const answer = ["rock or mineral particles", "organic matter", "water", "air spaces"];
      return science({ id: `components-${a.id}-${i + 1}`, format: "soil-mixture-model", blueprint: "soil-components-and-comparison", band: "developing", concept: mode,
        prompt: `Soil-magnifier mission ${i + 1}: select the component groups shown in sample ${a.id}.`, body: { sample: a, cards: [...answer, "one pure substance"], expected_components: answer, component_definitions: { organic_matter: "decayed material from living things", rock_particles: "mineral grains from rocks" } }, answer,
        hints: ["Soil is a mixture, not one pure substance.", "Organic matter comes from living or once-living material."], explanation: `Sample ${a.id} contains ${answer.join(", ")}. Proportions can vary between soils.`, correct: "Core soil components identified in a mixture model.", repair: "Reveal one labelled component at a time and sort it as mineral, organic, water or air space.", tag: "soil_single_substance", hook: "soil-components-reveal" });
    }
    if (mode === "compare_composition") {
      const key = ["rock_particles", "organic_matter", "water", "air_space"][i % 4], answer = a.components[key] === b.components[key] ? "equal" : a.components[key] > b.components[key] ? `sample ${a.id}` : `sample ${b.id}`;
      return science({ id: `soil-compare-${key}-${i + 1}`, format: "soil-mixture-model", blueprint: "soil-components-and-comparison", band: "secure", concept: mode,
        prompt: `Soil-table mission ${i + 1}: which sample has the greater proportion of ${key.replaceAll("_", " ")}?`, body: { samples: [a, b], comparison_component: key, choices: [`sample ${a.id}`, `sample ${b.id}`, "equal"], table_not_colour_only: true }, answer,
        hints: ["Compare the same component column.", "A greater proportion of one component does not mean every component is greater."], explanation: `${a.id}: ${a.components[key]}%; ${b.id}: ${b.components[key]}%. The result is ${answer}.`, correct: "Soil mixtures compared using one component's evidence.", repair: "Cover other table columns, align the two values and make only the supported relative claim.", tag: "all_soils_same_recipe", hook: "soil-comparison-table" });
    }
    if (mode === "soil_formation") {
      const answer = ["rock is broken into smaller particles over time", "remains of living things decay into organic matter", "particles and organic matter mix", "air and water occupy spaces in the soil"];
      return science({ id: `soil-formation-${i + 1}`, format: "soil-mixture-model", blueprint: "soil-components-and-comparison", band: "expected", concept: mode,
        prompt: `Soil-formation model ${i + 1}: order the simple component-building explanation.`, body: { cards: rotate(answer, i % answer.length), slow_process_language: true, no_full_rock_cycle: true }, answer,
        hints: ["Begin with rock particles and organic material developing over time.", "End with a mixture containing spaces, air and water."], explanation: `${answer.join(" → ")}. This is a simple soil model, not a full rock-cycle explanation.`, correct: "Soil formation connected to rock particles and organic matter.", repair: "Anchor ROCK PARTICLES and ORGANIC MATTER, then combine them before adding AIR/WATER SPACES.", tag: "soil_only_crushed_rock", hook: "soil-formation-model" });
    }
    if (mode === "air_water_spaces") {
      const answer = "Water can occupy some spaces between particles, while other spaces contain air; amounts can change.";
      return science({ id: `spaces-${a.id}-${i + 1}`, format: "soil-mixture-model", blueprint: "soil-components-and-comparison", band: "expected", concept: mode,
        prompt: `Soil-space mission ${i + 1}: which statement fits the labelled model?`, body: { sample: a, choices: [answer, "Soil contains no air because it looks solid.", "Every space is always full of water."], pore_space_model: true }, answer,
        hints: ["Look between particles in the magnified model.", "Water and air amounts can vary after rain or drying."], explanation: answer, correct: "Air and water recognised as variable parts of soil spaces.", repair: "Zoom the particle model and label two spaces AIR and WATER without changing the solid particles.", tag: "soil_has_no_air", hook: "soil-space-model" });
    }
    if (mode === "settling_model") {
      const answer = "The virtual jar can show that different-sized particles settle differently, but the model does not give one fixed recipe for all soils.";
      return science({ id: `settling-${i + 1}`, format: "soil-mixture-model", blueprint: "soil-components-and-comparison", band: "secure", concept: mode,
        prompt: `Settling-model mission ${i + 1}: which conclusion is appropriately limited?`, body: { virtual_jar_layers: ["larger particles settle", "smaller particles settle", "some organic material may float"], choices: [answer, "Every soil in the world has identical layers.", "The jar proves soil is a pure substance."], no_real_unknown_soil_handling: true }, answer,
        hints: ["A model can reveal components and patterns.", "Do not generalise one sample to every soil."], explanation: answer, correct: "Virtual soil model interpreted without overgeneralising.", repair: "Add “this sample” and “can show” to the conclusion, then remove universal claims.", tag: "all_soils_same_recipe", hook: "virtual-soil-jar" });
    }
    if (mode === "misconception_repair") {
      const answer = "Soil is a variable mixture containing rock particles and organic matter, with water and air in spaces.";
      return science({ id: `soil-repair-${i + 1}`, format: "soil-mixture-model", blueprint: "soil-components-and-comparison", band: "secure", concept: mode,
        prompt: `Soil-model repair ${i + 1}: which statement fixes “soil is only dirt or crushed rock”?`, body: { choices: [answer, "Soil is one pure substance.", "Soil is made only of living plants."], samples: [a, b] }, answer,
        hints: ["List more than one component.", "Different soils can contain different proportions."], explanation: answer, correct: "Single-substance soil misconception repaired.", repair: "Build the mixture with one mineral, one organic and one air/water-space card, then compare proportions.", tag: "soil_single_substance", hook: "soil-model-repair" });
    }
    const answer = "Soil is a mixture containing rock particles and organic matter, with water and air spaces.";
    return science({ id: `mixture-${a.id}-${i + 1}`, format: "soil-mixture-model", blueprint: "soil-components-and-comparison", band: "developing", concept: mode,
      prompt: `Mixture-evidence mission ${i + 1}: which description is supported by sample ${a.id}?`, body: { sample: a, description: a.description, choices: [answer, "Soil is only crushed rock.", "Soil is one pure substance."], labelled_component_model: true }, answer,
      hints: ["Name the different materials shown.", "A mixture contains more than one component."], explanation: `${answer} Sample ${a.id} is ${a.description}.`, correct: "Soil identified as a variable mixture from component evidence.", repair: "Highlight mineral particles and organic fragments separately, then locate air/water spaces.", tag: "soil_single_substance", hook: "soil-mixture-model" });
  });
}

function retrievalCandidates(count) {
  const modes = ["rock_group_retrieval", "test_retrieval", "fossil_retrieval", "soil_retrieval", "observation_inference_retrieval", "suitability_transfer", "fair_test_transfer", "misconception_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length], samples = sampleSets[i % sampleSets.length];
    if (mode === "rock_group_retrieval") {
      const answer = samples.filter((x) => x.texture === "rough").map((x) => x.id);
      return retrieve({ id: `group-${i + 1}`, concept: mode, prompt: `Property-sort revisit ${i + 1}: after ${day} days, select every rough sample.`, body: { samples, rule: "rough texture", review_interval_days: day }, answer,
        explanation: `Samples ${answer.join(", ")} match the stated rough-texture rule.`, tag: "colour_or_name_only" });
    }
    if (mode === "test_retrieval" || mode === "fair_test_transfer") {
      const answer = "Change the rock sample; keep the tool or water amount, tested area and observation time the same.";
      return retrieve({ id: `${mode}-${i + 1}`, concept: mode, prompt: `Fair-property revisit ${i + 1}: choose the controlled comparison plan.`, body: { choices: [answer, "Change the sample and every test condition.", "Choose by colour without testing."], review_interval_days: day }, answer,
        explanation: answer, tag: "test_conditions_changed" });
    }
    if (mode === "fossil_retrieval") {
      const item = fossilModels[i % fossilModels.length], answer = item.stages;
      return retrieve({ id: `fossil-${slug(item.type)}-${i + 1}`, concept: mode, prompt: `Fossil-sequence revisit ${i + 1}: rebuild the ${item.type} model.`, body: { cards: rotate(item.stages, i % item.stages.length), review_interval_days: day }, answer,
        explanation: `${item.stages.join(" → ")}`, tag: "instant_whole_fossil" });
    }
    if (mode === "soil_retrieval") {
      const answer = ["rock particles", "organic matter", "water", "air spaces"];
      return retrieve({ id: `soil-${i + 1}`, concept: mode, prompt: `Soil-components revisit ${i + 1}: select the component groups in the model.`, body: { cards: [...answer, "one pure substance"], review_interval_days: day }, answer,
        explanation: `Soil is a mixture containing ${answer.join(", ")}.`, tag: "soil_single_substance" });
    }
    if (mode === "observation_inference_retrieval") {
      const target = samples[i % samples.length], answer = { observation: `Sample ${target.id} has ${target.grain} grains.`, inference: "Its formation or exact name needs more evidence." };
      return retrieve({ id: `observe-${target.id}-${i + 1}`, concept: mode, prompt: `Evidence-language revisit ${i + 1}: separate observation from a cautious inference.`, body: { sample: target, cards: Object.values(answer), trays: ["observation", "inference/need more evidence"], review_interval_days: day }, answer,
        explanation: `${answer.observation} ${answer.inference}`, tag: "observation_inference_confused" });
    }
    if (mode === "suitability_transfer") {
      const [a, b] = samples, chosen = a.absorption <= b.absorption ? a : b, answer = `Sample ${chosen.id}, because it absorbed fewer drops in the fair test.`;
      return retrieve({ id: `suitability-${a.id}-${b.id}-${i + 1}`, concept: mode, prompt: `Suitability revisit ${i + 1}: choose the less absorbent sample for a stated outdoor use.`, body: { samples: [a, b], choices: [answer, "Choose the brightest colour.", "One test proves suitability for every use."], review_interval_days: day }, answer,
        explanation: answer, tag: "suitability_by_colour" });
    }
    const answer = "Use observable properties, controlled-test results, ordered process cards or labelled mixture components—whichever matches the question.";
    return retrieve({ id: `repair-${i + 1}`, concept: mode, prompt: `Geology-toolkit revisit ${i + 1}: which evidence routine avoids guessing?`, body: { choices: [answer, "Use rock colour for every conclusion.", "Assume every dead organism becomes a fossil instantly."], review_interval_days: day }, answer,
      explanation: answer, tag: "geology_evidence_mixed" });
  });
}

function retrieve({ id, concept, prompt, body, answer, explanation, tag }) {
  return science({ id, format: "evidence-explain", blueprint: "rocks-fossils-soils-retrieval", band: "retrieval", concept, prompt, body, answer,
    hints: ["Identify whether this is a property, process or mixture question.", "Choose the matching observation, test, sequence or component evidence."], explanation, correct: `Spaced geology evidence retained. ${explanation}`, repair: "Return to one table, sequence or component model, preserve correct evidence and retry with reduced choices.", tag, hook: "geology-evidence-lock" });
}

function science({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_use_table_text_sequence_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_property_table_sequence_or_soil_model" };
  const sequence = Array.isArray(answer);
  return {
    id: `${prefix}${slug(blueprint)}-${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      interaction_mode: "sort_test_sequence_compare_select_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, run the learner's named virtual test or record an indicated explanation without supplying the science conclusion.",
      property_sort_test_route: "Structured sample descriptions, numeric/categorical test tables and list-based grouping replace colour-only inspection and precise dragging.",
      evidence_choice_route: "Observation, result and inference cards remain separately labelled and can be selected by pointing, keyboard, switch or eye gaze.",
      fossil_sequence_route: "Numbered text/picture cards use explicit before, burial, layers, long-time and exposure language with static stepping.",
      soil_model_route: "Component tables and patterned labelled diagrams show rock particles, organic matter, water and air spaces without a fixed universal recipe.",
      send_support: { one_scientific_construct_per_panel: true, reduced_choice_mode: true, text_and_symbol_labels: true, colour_not_required: true, predictable_card_positions: true, need_more_evidence_option: true },
      sensory_safe_route: "No scraping sounds, dust animation, graphic remains, compulsory specimen handling or sudden movement; static and text modes are complete.",
      no_touch_route: "All tests are virtual or use provided records; no touching, tasting, breaking, collecting or inhaling unknown rock or soil material is required.",
      visual_route: "Low-clutter sample cards, enlarged textures, patterned layers, generous spacing and structured descriptions.",
      processing_route: "Use OBSERVE–TEST–RECORD–COMPARE or ORGANISM/TRACE–BURY–LAYERS–ROCK–EXPOSE, one step at a time with preserved evidence.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed sorting can replace dragging, speech and handwriting.",
      practical_safety: "Teacher-led only if real samples are used; avoid sharp edges and dust, do not taste or break specimens, wash hands after approved handling.",
      low_visual_load: true, reduced_motion: "static_layers_tables_and_instant_card_placement", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "help a calm geology station organise one evidence record", reward: "one field badge mark for a checked group, test, sequence or mixture", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your accurate observations stay. Choose another evidence tool or clue and continue." },
      age_appropriate_scope: "observable_rock_properties_simple_fossil_formation_and_soil_components_no_unsupported_rock_cycle",
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: sequence ? { sequence: answer } : { value: answer }, hints, explanation,
    feedback: { correct, repair, science_evidence: explanation, support_message: "Sorting, virtual testing, sequencing, pointing, eye gaze, AAC and adult-scribed explanations carry equal evidence; speed, handwriting and touching specimens are not scored." },
    difficulty: band === "intro" ? 2 : band === "developing" ? 3 : band === "expected" ? 4 : band === "secure" ? 5 : 4,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated) {
  if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 216) throw new Error("Pilot must contain 4 curated and 216 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body.variant_blueprint_id);
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["group_by_grain", "group_by_texture", "group_by_layers", "multiple_valid_rules", "observation_not_inference", "rule_consistency", "absorption_compare", "scratch_compare", "fair_test_plan", "identify_tested_property", "suitability_evidence", "sequence_order", "missing_stage", "fossil_evidence", "trace_or_remain", "not_every_organism", "component_identification", "mixture_claim", "compare_composition", "soil_formation", "air_water_spaces", "rock_group_retrieval", "fossil_retrieval", "soil_retrieval", "fair_test_transfer"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.send_support?.reduced_choice_mode || !b.property_sort_test_route || !b.evidence_choice_route || !b.fossil_sequence_route || !b.soil_model_route || !b.sensory_safe_route || !b.no_touch_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/sensory route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.science_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.age_appropriate_scope !== "observable_rock_properties_simple_fossil_formation_and_soil_components_no_unsupported_rock_cycle") throw new Error(`Scope failure in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function sample(id, colour, grain, texture, layers, absorption, scratchResistance) { return { id, colour, grain, texture, layers, absorption, scratchResistance }; }
function fossil(type, stages, evidence) { return { type, stages, evidence }; }
function soil(id, components, description) { return { id, components, description }; }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
