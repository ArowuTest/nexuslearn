#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y6-working-scientifically.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y6-working-scientifically-bank-";
const pilotTarget = 260;
const reviewBatch = "y6-working-scientifically-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y6-working-scientifically") throw new Error("This generator only supports the Year 6 working-scientifically pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const enquiryCases = [
  { key: "cells-brightness", context: "physics/electricity", question: "How does the number of approved cells affect lamp brightness in a safe circuit simulator?", type: "fair/comparative test", reason: "change cell number, measure brightness and control the rest of the circuit", variablesAppropriate: true },
  { key: "dissolving-temperature", context: "chemistry/materials", question: "How does water temperature affect dissolving time for the same mass of sugar in a teacher-controlled model?", type: "fair/comparative test", reason: "change temperature, measure time and control sugar, water volume, stirring and equipment", variablesAppropriate: true },
  { key: "seasonal-tree", context: "environmental observation", question: "How does one labelled tree's leaf cover change from September to December?", type: "observation over time", reason: "record the same tree repeatedly at planned dates without manipulating the season", variablesAppropriate: false },
  { key: "pond-temperature", context: "environmental observation", question: "How do pond-water temperature readings change through one school day?", type: "observation over time", reason: "take repeated readings at stated times using the same safe location and method", variablesAppropriate: false },
  { key: "leaf-light-pattern", context: "biology", question: "Across many naturally growing plants, is leaf area associated with measured light level?", type: "pattern seeking", reason: "collect paired observations and look for an association without claiming light alone caused it", variablesAppropriate: false },
  { key: "shell-habitat-pattern", context: "biology", question: "Across sampled shore zones, is shell thickness associated with wave exposure?", type: "pattern seeking", reason: "compare paired field measurements and seek a pattern rather than controlling the habitat", variablesAppropriate: false },
  { key: "invertebrate-key", context: "biology/classification", question: "Which group does each school-safe invertebrate image belong to using observable legs and body regions?", type: "classification/identification", reason: "apply a branching key to observable features", variablesAppropriate: false },
  { key: "material-identification", context: "chemistry/materials", question: "Which labelled mystery samples are conductors in a low-voltage teacher-approved test?", type: "classification/identification", reason: "use agreed test evidence to sort samples into conductor and insulator groups", variablesAppropriate: false },
  { key: "planet-history", context: "secondary research", question: "How have published explanations of the Solar System changed as new evidence became available?", type: "secondary research", reason: "use reviewed books, museum and science-agency sources rather than recreating historical observations", variablesAppropriate: false },
  { key: "medicine-history", context: "secondary research", question: "What does reviewed scientific evidence say about how vaccination reduced one disease over time?", type: "secondary research", reason: "consult age-appropriate trusted sources and compare their evidence", variablesAppropriate: false },
];

const variableCases = [
  { key: "cells", context: "physics/electricity", question: "How does approved cell number affect lamp brightness?", change: "number of matching approved cells", measure: "brightness-meter reading (lux)", controls: ["same rated lamp", "same wires", "same closed switch", "same sensor position"], prediction: "If cell number increases within the safe rated model, brightness may increase because supplied voltage increases.", safety: "Use only the low-voltage simulator or teacher-approved equipment; never use mains electricity." },
  { key: "shadow-distance", context: "physics/light", question: "How does object distance from a small light source affect relative shadow width?", change: "source-to-object distance (cm)", measure: "shadow width on the screen (cm)", controls: ["same source", "same opaque object", "same screen position", "same alignment"], prediction: "If the object moves closer to the source, the shadow may become wider in the aligned model.", safety: "Use a cool classroom light or simulation; do not stare into a bright source." },
  { key: "sugar-temperature", context: "chemistry/materials", question: "How does water temperature affect sugar dissolving time?", change: "water temperature (°C)", measure: "time until no crystals are visible (s)", controls: ["same sugar mass", "same water volume", "same grain size", "same stirring method"], prediction: "Warmer water may reduce dissolving time in the tested range.", safety: "Use a simulation or teacher-controlled warm water; no tasting or learner handling of hot water." },
  { key: "material-conductivity", context: "chemistry/materials", question: "How does sample material affect current in a low-voltage test circuit?", change: "labelled material sample", measure: "current reading (mA) or complete/not-complete result", controls: ["same sample dimensions", "same low-voltage circuit", "same contacts", "same meter"], prediction: "Metal samples may give higher current than plastic samples in this test.", safety: "Use only teacher-approved low-voltage samples and equipment; no mains or unknown materials." },
  { key: "plant-water", context: "biology", question: "How does water volume affect seedling height increase over one week?", change: "daily water volume (mL)", measure: "height increase (mm)", controls: ["same plant type and starting stage", "same soil", "same light", "same pot size"], prediction: "Within the tested safe range, water volume may affect height increase.", safety: "Use classroom plants, avoid mould contact and wash hands after handling soil." },
  { key: "enzyme-model", context: "biology/simulation", question: "How does temperature affect the rate in an approved enzyme simulation?", change: "model temperature setting (°C)", measure: "model reaction time (s)", controls: ["same simulated enzyme amount", "same substrate amount", "same endpoint", "same model"], prediction: "Rate may change with temperature across the tested range rather than increase forever.", safety: "Use the simulation only; no biological samples or unsafe chemicals are required." },
  { key: "surface-friction", context: "physics", question: "How does surface type affect the pull force needed to move the same block?", change: "surface type", measure: "pull force (N)", controls: ["same block and mass", "same pull direction", "same speed rule", "same force meter"], prediction: "Rougher tested surfaces may require a greater pull force.", safety: "Use small classroom masses, clear the path and keep hands away from falling equipment." },
  { key: "evaporation-area", context: "environmental/materials", question: "How does exposed water-surface area affect evaporation in a safe model?", change: "exposed surface area (cm²)", measure: "mass of water lost after a fixed time (g)", controls: ["same starting water mass", "same time", "same room location", "same container material"], prediction: "A larger exposed area may increase water loss over the fixed time.", safety: "Use room-temperature water in stable containers; wipe spills promptly." },
  { key: "parachute-area", context: "physics", question: "How does canopy area affect fall time in a safe simulator?", change: "canopy area (cm²)", measure: "fall time (s)", controls: ["same mass", "same material", "same drop height", "same release method"], prediction: "A larger canopy may increase fall time in the tested range.", safety: "Use a simulation or a clear low-height drop zone supervised by an adult." },
  { key: "insulation", context: "physics/materials", question: "How does wrapping material affect cooling in a teacher-approved model?", change: "wrapping material", measure: "temperature decrease after 10 min (°C)", controls: ["same container", "same starting temperature", "same liquid volume", "same time and room position"], prediction: "Better thermal insulators may produce a smaller temperature decrease.", safety: "Use a simulation or teacher-managed warm water and covered containers; learners do not handle hot liquids." },
];

const graphCases = [
  { key: "categories", context: "biology", dataType: "categorical_counts", xLabel: "habitat category", yLabel: "organisms counted", unit: "organisms", answer: "bar chart with category labels and a frequency axis", wrong: ["line graph implying continuous change between categories", "scatter graph with no paired variables", "unlabelled decorative chart"] },
  { key: "time", context: "environment", dataType: "continuous_over_time", xLabel: "time (h)", yLabel: "temperature (°C)", unit: "°C", answer: "line graph with time on the x-axis and temperature (°C) on the y-axis", wrong: ["classification key", "unlabelled bar blocks", "scatter graph with category names as numbers"] },
  { key: "paired", context: "environment", dataType: "paired_continuous", xLabel: "light level (lux)", yLabel: "leaf area (cm²)", unit: "cm²", answer: "scatter graph with one point per paired observation and both axes labelled", wrong: ["line graph joining plants in collection order", "pie chart without a whole", "table with units removed"] },
  { key: "raw-repeats", context: "physics", dataType: "repeat_measurements", xLabel: "surface type", yLabel: "pull force (N)", unit: "N", answer: "results table with one row per surface and separate repeat columns before any summary graph", wrong: ["erase repeats and keep only a favourite value", "line graph joining unrelated surface categories", "diagram with no numerical labels"] },
  { key: "classification", context: "biology", dataType: "observable_features", xLabel: "specimen", yLabel: "observed features", unit: "feature record", answer: "labelled feature table and branching classification key", wrong: ["line graph of specimen names", "scatter graph with no continuous variables", "bar chart that removes the identifying features"] },
  { key: "paired-correlation", context: "biology", dataType: "paired_continuous", xLabel: "stem diameter (mm)", yLabel: "plant height (cm)", unit: "cm", answer: "scatter graph to inspect association, while avoiding a claim that one variable caused the other", wrong: ["line graph proving causation", "pie chart because percentages look scientific", "bar chart with no units"] },
];

const claimCases = [
  { key: "fertiliser", context: "biology", question: "Did fertiliser affect height increase in this controlled classroom test?", evidence: "matched seedlings averaged 24 mm increase without fertiliser and 31 mm with fertiliser across three repeats", answer: "Supported for this test: the fertiliser group had a 7 mm greater mean increase, but this does not prove the same effect for every plant or condition.", wrong: ["Proved for every plant everywhere.", "Refuted because both groups grew.", "Insufficient because numerical repeats can never support a claim."], judgement: "support" },
  { key: "correlation", context: "environment", question: "Does greater light cause larger leaves?", evidence: "paired field observations show higher light readings were associated with larger leaves, but plant type, water and age were not controlled", answer: "Insufficient for causation: the data show an association, but other variables could explain it.", wrong: ["Supported as proof that light alone caused every difference.", "Refuted because scatter graphs cannot show patterns.", "Delete any point that weakens the pattern."], judgement: "insufficient" },
  { key: "cells", context: "physics/electricity", question: "Did two cells increase brightness in the matched safe simulator?", evidence: "one cell: 110, 112, 111 lux; two cells: 184, 182, 183 lux", answer: "Supported in this simulator: all two-cell readings were higher and the matched repeats were consistent.", wrong: ["Proved that unlimited cells are always safe.", "Refuted because readings were not identical.", "Insufficient because repeats cannot contribute evidence."], judgement: "support" },
  { key: "anomaly", context: "physics", question: "Is the surprising 9.8 s reading certainly wrong?", evidence: "other repeats were 5.0, 5.1 and 4.9 s; the method log does not explain 9.8 s", answer: "Insufficient to delete it: retain the record, check the method and equipment, then repeat to investigate the anomaly.", wrong: ["Delete it immediately because it differs.", "Use only 9.8 s because it is most interesting.", "Repeats prove the true value with certainty."], judgement: "insufficient" },
  { key: "material", context: "chemistry/materials", question: "Is Sample B an electrical insulator?", evidence: "Three matched low-voltage tests found no current with B; a reference conductor completed the same circuit.", answer: "Supported for the tested sample and conditions, with the working reference check strengthening the evidence.", wrong: ["Proved that every material with the same colour is an insulator.", "Refuted because no current always means the meter is broken.", "Insufficient because classification can never use repeated tests."], judgement: "support" },
  { key: "season", context: "environment", question: "Did day length alone cause the observed leaf loss?", evidence: "leaf cover and day length both decreased from September to December; temperature, wind and rainfall also changed", answer: "Insufficient for a single cause: the observations show change over time but several environmental factors changed together.", wrong: ["Supported as proof that day length alone caused leaf loss.", "Refuted because observations over time have no value.", "Delete weather records to simplify the claim."], judgement: "insufficient" },
  { key: "refute", context: "materials", question: "Do all tested materials transmit some visible light?", evidence: "clear acrylic and tracing paper transmitted light; cardboard gave no detected transmission in the matched test", answer: "Refuted for the tested set: cardboard is a counterexample because no transmitted light was detected.", wrong: ["Supported because two materials transmitted light.", "Proved for all materials outside the test.", "Insufficient because one counterexample cannot refute an all claim."], judgement: "refute" },
  { key: "research", context: "secondary research", question: "Is one anonymous web post enough to establish a scientific claim?", evidence: "the post gives no author, sources, method or date", answer: "Insufficient evidence: compare current, reviewed sources with identifiable authorship and referenced evidence.", wrong: ["Supported because the post sounds confident.", "Refuted because all online sources are false.", "Proved if the post is repeated three times."], judgement: "insufficient" },
  { key: "limit", context: "physics", question: "Will the model result apply to every parachute?", evidence: "only two canopy areas and one material were tested in a simulator", answer: "Insufficient for an universal claim; report the tested pattern and next test more areas or materials one variable at a time.", wrong: ["Supported for every parachute because two points form a pattern.", "Refuted because models never provide evidence.", "Delete the limitation from the conclusion."], judgement: "insufficient" },
  { key: "reliability", context: "chemistry/materials", question: "Do close repeat values prove the explanation true?", evidence: "three dissolving times are 42, 43 and 42 s with the same method", answer: "The repeats improve confidence in measurement consistency, but they do not by themselves prove the causal explanation true.", wrong: ["Yes, repeats prove every explanation.", "No, repeats should always be discarded.", "Delete one of the matching values as anomalous."], judgement: "support_with_limit" },
];

const candidates = [
  ...expand("enquiry", 51, enquiryCases, buildEnquiry),
  ...expand("variables", 51, variableCases, buildVariables),
  ...Array.from({ length: 51 }, (_, index) => buildResults(index)),
  ...expand("graph", 51, graphCases, buildGraph),
  ...expand("claim", 51, claimCases, buildClaim),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 6 working-scientifically pilot reaches 260 variants with five curated questions preserved semantically unchanged and 255 deterministic review candidates, balanced 51 per blueprint. Coverage spans enquiry-type selection, investigable questions and predictions, variables only where appropriate, safe ordered methods, equipment precision, structured observations, repeats/anomalies, tables and bar/line/scatter representations, labelled units and text equivalents, summaries, conclusions, limitations, reliability, improvements and support/refute/insufficient judgements across biology, materials, physics/electricity and environmental contexts. Generated items explicitly reject every-enquiry-is-a-fair-test, repeats-prove-truth, delete-anomalies and correlation-causes misconceptions. All four formats provide direct select, keyboard/switch/no-drag, row-by-row tables, simplified subsets, speech-to-text placeholders with adult review and static low-sensory routes. Selected optional narration/sonification references require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent science, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates, curatedSnapshot);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`working-scientifically-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`working-scientifically-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`working-scientifically-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`working-scientifically-bank contexts=${summary(candidates, (variant) => variant.body.science_context)}`);
console.log(`working-scientifically-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`working-scientifically-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 working-scientifically bank is out of date; run generate-y6-working-scientifically-bank.mjs --write.");
  console.log("working-scientifically-bank deterministic check passed");
} else {
  console.log("working-scientifically-bank dry-run; pass --write to update the pack");
}

function buildEnquiry(item, index, id) {
  const answer = `${item.type} — ${item.reason}.`;
  return candidate({ id, index, format: "fair-test-plan", blueprint: "enquiry-type-selection", band: index < 16 ? "intro" : "developing", context: item.context, prompt: `Enquiry selector ${index + 1}: ${item.question}`, choices: [answer, ...["fair/comparative test", "observation over time", "pattern seeking", "classification/identification", "secondary research"].filter((type) => type !== item.type).slice(0, 3).map((type) => `${type} — choose this regardless of the question.`)], answer, hints: ["Ask whether the question needs a deliberate change, repeated time observations, paired observations, feature sorting or existing published evidence.", "Do not force change/measure/control variables onto an enquiry that does not manipulate a variable."], explanation: `${answer} The enquiry type matches the evidence needed rather than assuming every science question is a fair test.`, tag: item.variablesAppropriate ? "changes_everything" : "every_enquiry_fair_test", body: { question: item.question, enquiry_type: item.type, variables_appropriate: item.variablesAppropriate, variable_slots: item.variablesAppropriate ? ["change", "measure", "control"] : [], integrity: { type: "enquiry", key: item.key, enquiryType: item.type, variablesAppropriate: item.variablesAppropriate, expected: answer } }, repair: "Use five enquiry cards with short definitions; hide variable slots unless a deliberate comparative change is needed." });
}

function buildVariables(item, index, id) {
  const answer = `Change ${item.change}; measure ${item.measure}; keep ${item.controls.join(", ")} the same. ${item.safety}`;
  return candidate({ id, index, format: "fair-test-plan", blueprint: "variable-control-plans", band: index < 16 ? "developing" : "expected", context: item.context, prompt: `Method planner ${index + 1}: ${item.question} Select the valid variable and safety plan.`, choices: [answer, `Change ${item.change} and ${item.measure} together; controls are unnecessary.`, `Measure ${item.change} and deliberately change ${item.controls[0]}.`, "Use any available equipment, including unsafe or unapproved sources, to get a clearer result."], answer, hints: ["The changed variable is deliberately altered; the measured variable is the outcome recorded with a unit.", "Lock important controls, order the safe method and state a testable if-because prediction before revealing results."], explanation: `${answer} Prediction: ${item.prediction} This isolates one relationship within a safe school or simulation context.`, tag: "changes_everything", body: { question: item.question, changed_variable: item.change, measured_variable: item.measure, control_variables: item.controls, prediction: item.prediction, safety_boundary: item.safety, method_order: ["check approved equipment and safety boundary", "set controls", "set changed variable", "measure outcome with stated unit", "repeat matched settings", "record every result"], integrity: { type: "variables", key: item.key, change: item.change, measure: item.measure, controls: item.controls, safe: true, expected: answer } }, repair: "Use CHANGE / MEASURE / KEEP SAME / SAFETY / PREDICT cards with one card visible per slot and a numbered no-drag method list." });
}

function buildResults(index) {
  const family = index % 6;
  const base = 20 + Math.floor(index / 6) * 3;
  let prompt;
  let answer;
  let choices;
  let rows;
  let unit;
  let integrity;
  let context;
  if (family === 0) {
    rows = [{ condition: "smooth surface", repeats: [base, base + 1, base - 1] }, { condition: "rough surface", repeats: [base + 8, base + 7, base + 9] }];
    unit = "N"; context = "physics";
    answer = "Use columns for surface, repeat 1 (N), repeat 2 (N), repeat 3 (N) and a checked summary.";
    prompt = "Which table structure records the repeated pull-force measurements clearly?";
    choices = [answer, "Put every value in one unlabelled box.", "Record only the largest repeat.", "Remove units because the numbers are enough."];
    integrity = { type: "record_table", rows, unit, expected: answer };
  } else if (family === 1) {
    rows = [{ condition: "same setting", repeats: [base, base + 1, base + 12, base - 1] }];
    unit = "s"; context = "physics/simulation";
    answer = `Keep the ${base + 12} s result marked as a possible anomaly, check method/equipment and repeat the setting before deciding how to summarise it.`;
    prompt = `Repeated times are ${rows[0].repeats.join(", ")} s. What should happen next?`;
    choices = [answer, `Delete ${base + 12} s immediately.`, `Use only ${base + 12} s because it is unusual.`, "Claim repeats prove the prediction true."];
    integrity = { type: "anomaly", readings: rows[0].repeats, candidate: base + 12, expected: answer };
  } else if (family === 2) {
    const readings = [base - 1, base, base + 1];
    rows = [{ condition: "matched setting", repeats: readings }]; unit = "mm"; context = "biology";
    answer = `${base} mm`;
    prompt = `Height increases are ${readings.join(", ")} mm. Calculate the mean as a simple summary.`;
    choices = labelledNumberChoices(base, unit);
    integrity = { type: "mean", readings, unit, expected: answer };
  } else if (family === 3) {
    const a = [base - 1, base, base + 1];
    const b = [base + 3, base + 4, base + 5];
    rows = [{ condition: "A", repeats: a }, { condition: "B", repeats: b }]; unit = "lux"; context = "physics/electricity";
    answer = `Condition B's mean is ${base + 4} lux, which is 4 lux higher than Condition A's mean of ${base} lux.`;
    prompt = `Compare repeats A: ${a.join(", ")} lux and B: ${b.join(", ")} lux using their means.`;
    choices = [answer, "The conditions have equal means.", "Use only the highest reading from each condition.", "Condition A is higher because it is listed first."];
    integrity = { type: "compare_means", first: a, second: b, unit, expected: answer };
  } else if (family === 4) {
    const readings = [base - 2, base, base + 3];
    rows = [{ condition: "repeat set", repeats: readings }]; unit = "°C"; context = "environment";
    answer = `The range is 5 °C, from ${base - 2} °C to ${base + 3} °C.`;
    prompt = `Find and interpret the range of ${readings.join(", ")} °C.`;
    choices = [answer, `The range is ${base + 3} °C.`, `The range is ${base} °C.`, "A range proves the cause of variation."];
    integrity = { type: "range", readings, unit, expected: answer };
  } else {
    rows = [{ condition: "object length", repeats: [42, 42, 43] }]; unit = "mm"; context = "materials";
    answer = "Use a millimetre ruler with a clear zero point, align the object correctly and record repeated readings in mm.";
    prompt = "Which equipment and precision choice best measures an object about 42 mm long?";
    choices = [answer, "Use a metre stick marked only every 10 cm.", "Estimate by eye and report 42.00000 mm.", "Start from a damaged ruler edge without checking zero."];
    integrity = { type: "precision", readings: rows[0].repeats, unit, expected: answer };
  }
  return candidate({ id: `results-${String(index + 1).padStart(3, "0")}-${family}`, index, format: "observation-record", blueprint: "results-recording-and-repeats", band: family < 2 ? "developing" : family < 5 ? "secure" : "expected", context, prompt: `Results recorder ${index + 1}: ${prompt}`, choices, answer, hints: ["Keep every original reading, its condition and unit visible before calculating a summary.", family === 1 ? "An anomaly is investigated, not automatically deleted; check method and repeat the matched condition." : "Use repeated measurements to assess consistency, but do not say repeats prove a claim true."], explanation: resultsExplanation(integrity), tag: family === 1 ? "delete_anomaly" : "one_result_as_proof", body: { table_columns: ["condition", `repeat 1 (${unit})`, `repeat 2 (${unit})`, `repeat 3 (${unit})`], rows, row_by_row_reading: true, integrity }, repair: "Use a row-by-row table reader, preserve original readings and add CALCULATE / CHECK ANOMALY / REPEAT METHOD cards without deleting evidence." });
}

function buildGraph(item, index, id) {
  const answer = item.answer;
  const sample = graphData(item.dataType, index);
  return candidate({ id, index, format: "graph-table-investigation", blueprint: "table-graph-evidence-links", band: item.dataType === "paired_continuous" ? "secure" : "expected", context: item.context, prompt: `Representation lab ${index + 1}: data type—${item.dataType}; question labels—${item.xLabel} and ${item.yLabel}. Which representation fits?`, choices: [answer, ...item.wrong], answer, hints: ["Categorical counts suit bars; continuous change over time suits lines; paired continuous values suit scatter; repeats belong in a table before summary.", "Every graph needs meaningful axis labels, units and a text-table equivalent; scatter association does not prove causation."], explanation: `${answer}. The representation matches the variable and data types, keeps labels and units, and supports the question without implying more than the data show.`, tag: item.key === "paired-correlation" ? "correlation_proves_causation" : "impressive_graph_choice", body: { data_type: item.dataType, recommended_representation: representationFor(item.dataType), x_axis_label: item.xLabel, y_axis_label: item.yLabel, y_unit: item.unit, data_table: sample, text_table_equivalent: true, integrity: { type: "graph", key: item.key, dataType: item.dataType, representation: representationFor(item.dataType), labels: [item.xLabel, item.yLabel], unit: item.unit, expected: answer } }, repair: "Use DATA TYPE → QUESTION → DISPLAY cards, then complete x-label, y-label and unit fields before viewing the high-contrast graph and equivalent table." });
}

function buildClaim(item, index, id) {
  return candidate({ id, index, format: "claim-evidence-explain", blueprint: "claim-evidence-conclusions", band: item.judgement === "support" ? "expected" : "secure", context: item.context, prompt: `Evidence tribunal ${index + 1}: question—${item.question} Evidence—${item.evidence}`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Match the conclusion to the actual method, values, units, repeats and sample limits.", "Choose support, refute or insufficient evidence; association does not prove causation and repeats do not prove truth."], explanation: `${item.answer} The conclusion answers the stated question, cites the evidence strength and includes the necessary limitation or next test.`, tag: item.key === "correlation" ? "correlation_proves_causation" : item.key === "anomaly" ? "delete_anomaly" : item.key === "reliability" ? "repeats_prove_truth" : "unsupported_conclusion", body: { question: item.question, evidence: item.evidence, judgement: item.judgement, integrity: { type: "claim", key: item.key, judgement: item.judgement, expected: item.answer }, next_test_required: ["insufficient", "support_with_limit"].includes(item.judgement) }, repair: "Use CLAIM / EXACT EVIDENCE / JUDGEMENT / LIMITATION / NEXT TEST sentence frames and retain the source table beside the conclusion." });
}

function candidate({ id, index, format, blueprint, band, context, prompt, choices, answer, hints, explanation, tag, body, repair }) {
  const fullId = `${prefix}${id}`;
  const rotatedChoices = rotate([...new Set(choices)], index % choices.length);
  const fullExplanation = explanation.length >= 110 ? explanation : `${explanation} The enquiry type, evidence and limitation remain explicit.`;
  const useAudio = ["observation-record", "graph-table-investigation"].includes(format) && index % 10 === 0;
  const audio = useAudio ? { audio_optional: true, audio_asset_id: `data-summary-${fullId}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, audio_route: "reviewed_table_row_or_graph_point_summary" } : { audio_required: false };
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotatedChoices,
      ...body,
      science_context: context,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_enquiry_cycle_reasoning`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "direct_select_keyboard_switch_eye_gaze_aac_or_adult_reviewed_text",
      supported_interaction: "Use direct select, keyboard, switch scanning, eye-gaze dwell, AAC/pointing, or a speech-to-text placeholder reviewed by an adult; numbered positions and buttons replace dragging and handwriting.",
      interaction_route: { direct_select: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, speech_to_text_placeholder: true, adult_review_required: true, drag_required: false, handwriting_required: false, speech_required: false },
      accessibility_support: { row_by_row_table_reading: true, simplified_data_subset: true, same_reasoning_in_simplified_view: true, static_low_sensory_presentation: true, text_equivalent_for_every_display: true, one_enquiry_phase_at_a_time: true, correct_work_preserved: true },
      prediction_before_reveal: true,
      reduced_visual_load: true,
      no_flicker: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      speed_rewards_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "complete one calm enquiry-expedition phase", reward: "an evidence badge for method quality or justified conclusion", timer: false, speed_reward: false, streak: false, lives: false, loss_on_error: false, retry_message: "That result gives the expedition useful evidence. Keep correct method and data cards, open one enquiry clue and retry without losing progress." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The enquiry method and evidence support the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Check question, enquiry type, variables when appropriate, safe method, data with units, representation and evidence-bound conclusion. Accepted response: ${answer}`,
      misconception_check: tag,
      check_prompt: format === "fair-test-plan" ? "Does the enquiry type fit, and are change/measure/control variables used only where appropriate?" : format === "observation-record" ? "Are all readings, units, repeats and possible anomalies retained and checked?" : format === "graph-table-investigation" ? "Does the representation fit the data type with labelled axes, units and a text equivalent?" : "Do the evidence and limitations support, refute or leave the claim insufficient?",
      support_message: "Use direct select, row-by-row tables, simplified subsets, static panels, keyboard, switch, eye gaze, AAC/pointing or adult-reviewed speech-to-text. No timer, speed reward, speech, handwriting or drag is required.",
      retry: "Correct question, method and evidence cards remain visible. Use one enquiry-phase clue, then retry without penalty.",
    },
    difficulty: { intro: 3, developing: 4, expected: 6, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "fair-test-plan" ? "method-plan-build" : format === "observation-record" ? "data-format-bridge" : format === "graph-table-investigation" ? "data-format-bridge" : "evidence-row-highlight",
  };
}

function expand(label, count, items, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    return builder(item, index, `${label}-${String(index + 1).padStart(3, "0")}-${item.key}`);
  });
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 5 || JSON.stringify(currentPack.question_variants.slice(0, 5)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 255 || currentPack.question_variants.length !== pilotTarget) throw new Error("Expected 255 generated and 260 total variants.");
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
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || !formats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateIntegrity(variant);
    if (variant.body.choices.length !== 4 || !variant.body.choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} has an invalid answer set.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 100) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.direct_select || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.speech_to_text_placeholder || !route?.adult_review_required || route.drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
    if (!variant.body.accessibility_support?.row_by_row_table_reading || !variant.body.accessibility_support?.simplified_data_subset || !variant.body.accessibility_support?.same_reasoning_in_simplified_view || !variant.body.accessibility_support?.static_low_sensory_presentation || variant.body.no_flicker !== true) throw new Error(`${variant.id} lacks SEND/static support.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.speed_rewards_allowed !== false || variant.body.gamification?.speed_reward !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure or speed reward.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.audio_route !== "reviewed_table_row_or_graph_point_summary" || !["observation-record", "graph-table-investigation"].includes(variant.format))) throw new Error(`${variant.id} has invalid optional audio metadata.`);
  }
  for (const format of currentPack.practice.formats) if (!generated.some((variant) => variant.format === format)) throw new Error(`Declared format ${format} is unused.`);
  for (const blueprint of currentPack.variant_blueprints) {
    const count = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint.id).length;
    if (count !== 51) throw new Error(`${blueprint.id} expected 51 generated variants, found ${count}.`);
  }
}

function validateIntegrity(variant) {
  const i = variant.body.integrity;
  if (i.expected !== variant.expected_answer.value) throw new Error(`${variant.id} changed its canonical answer.`);
  if (i.type === "enquiry") {
    const source = enquiryCases.find((item) => item.key === i.key);
    if (!source || source.type !== i.enquiryType || source.variablesAppropriate !== i.variablesAppropriate) throw new Error(`${variant.id} has invalid enquiry selection.`);
    if (!i.variablesAppropriate && variant.body.variable_slots.length !== 0) throw new Error(`${variant.id} forces variables onto a non-fair enquiry.`);
  } else if (i.type === "variables") {
    const source = variableCases.find((item) => item.key === i.key);
    if (!source || source.change !== i.change || source.measure !== i.measure || JSON.stringify(source.controls) !== JSON.stringify(i.controls) || !i.safe || i.controls.length < 3) throw new Error(`${variant.id} has invalid variable or safety plan.`);
    if (variant.body.method_order.length < 6 || !/safety/.test(variant.body.method_order[0])) throw new Error(`${variant.id} has an unsafe or incomplete method order.`);
  } else if (["record_table", "anomaly", "mean", "compare_means", "range", "precision"].includes(i.type)) {
    validateResults(variant, i);
  } else if (i.type === "graph") {
    const source = graphCases.find((item) => item.key === i.key);
    if (!source || i.representation !== representationFor(i.dataType) || i.labels.some((label) => !label) || !i.unit || variant.body.text_table_equivalent !== true) throw new Error(`${variant.id} has invalid graph/table metadata.`);
  } else if (i.type === "claim") {
    const source = claimCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.judgement !== i.judgement) throw new Error(`${variant.id} has invalid conclusion-evidence integrity.`);
  } else throw new Error(`${variant.id} has unknown integrity type ${i.type}.`);
}

function validateResults(variant, i) {
  if (i.type === "record_table" && (!i.rows.length || !i.unit)) throw new Error(`${variant.id} has an invalid results table.`);
  if (i.type === "anomaly") {
    if (!i.readings.includes(i.candidate) || !/Keep/.test(i.expected) || !/repeat/i.test(i.expected)) throw new Error(`${variant.id} mishandles the anomaly.`);
  } else if (i.type === "mean") {
    const actual = i.readings.reduce((sum, value) => sum + value, 0) / i.readings.length;
    if (`${actual} ${i.unit}` !== i.expected) throw new Error(`${variant.id} has invalid mean arithmetic.`);
  } else if (i.type === "compare_means") {
    const first = mean(i.first); const second = mean(i.second);
    if (!i.expected.includes(`${second} ${i.unit}`) || !i.expected.includes(`${first} ${i.unit}`)) throw new Error(`${variant.id} has invalid repeat comparison.`);
  } else if (i.type === "range") {
    const range = Math.max(...i.readings) - Math.min(...i.readings);
    if (!i.expected.includes(`range is ${range} ${i.unit}`)) throw new Error(`${variant.id} has invalid range arithmetic.`);
  } else if (i.type === "precision" && (!i.unit || i.readings.some((value) => !Number.isFinite(value)))) throw new Error(`${variant.id} has invalid precision evidence.`);
  const allReadings = i.readings ?? i.rows?.flatMap((row) => row.repeats) ?? [...(i.first ?? []), ...(i.second ?? [])];
  if (allReadings.some((value) => !Number.isFinite(value))) throw new Error(`${variant.id} contains invalid measurements.`);
}

function resultsExplanation(i) {
  if (i.type === "record_table") return `${i.expected} The original repeats remain auditable before any mean, range or graph is chosen.`;
  if (i.type === "anomaly") return `${i.expected} An unusual result is evidence to investigate, not a value to delete automatically.`;
  if (i.type === "mean") return `${i.readings.join(" + ")} = ${i.readings.reduce((sum, value) => sum + value, 0)}; dividing by ${i.readings.length} gives ${i.expected}.`;
  if (i.type === "compare_means") return `${i.expected} Means summarise the matched repeats but do not by themselves prove a causal explanation.`;
  if (i.type === "range") return `${i.expected} Range describes spread and should be interpreted alongside the original readings.`;
  return `${i.expected} Equipment resolution and correct alignment should match the precision reported.`;
}

function graphData(dataType, index) {
  const base = 10 + index;
  if (dataType === "categorical_counts") return [{ category: "A", count: base }, { category: "B", count: base + 4 }, { category: "C", count: base + 2 }];
  if (dataType === "continuous_over_time") return [{ time_h: 0, value: base }, { time_h: 1, value: base + 2 }, { time_h: 2, value: base + 5 }];
  if (dataType === "paired_continuous") return [{ x: 2, y: base }, { x: 4, y: base + 3 }, { x: 6, y: base + 4 }];
  if (dataType === "repeat_measurements") return [{ condition: "A", r1: base, r2: base + 1, r3: base - 1 }];
  return [{ specimen: "A", features: ["six legs", "three body parts"] }, { specimen: "B", features: ["eight legs", "two body regions"] }];
}
function representationFor(dataType) { return { categorical_counts: "bar chart", continuous_over_time: "line graph", paired_continuous: "scatter graph", repeat_measurements: "results table", observable_features: "feature table and classification key" }[dataType]; }
function labelledNumberChoices(answer, unit) { return [`${answer} ${unit}`, `${answer + 1} ${unit}`, `${Math.max(0, answer - 1)} ${unit}`, `${answer * 3} ${unit}`]; }
function mean(values) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
