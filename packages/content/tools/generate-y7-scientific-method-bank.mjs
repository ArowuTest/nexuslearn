#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y7-scientific-method.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y7-scientific-method-bank-";
const target = 240;
const batch = "y7-scientific-method-depth-pilot-a";
if (write && check) throw new Error("Choose --write or --check, not both.");
const sourceText = await readFile(packPath, "utf8");
const pack = JSON.parse(sourceText);
if (pack.pack_id !== "sc-y7-scientific-method") throw new Error("This generator only supports sc-y7-scientific-method.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected 5 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated.map(removeScienceContract));

const routes = ["row-by-row table", "static planner cards", "described-data list", "low-clutter evidence panel"];
const experiments = [
  E("ramp", "physics", "ramp height", "distance travelled", "cm", "cm", [5, 10, 15, 20], "ruler", 1, ["same toy car", "same ramp surface", "same release point"], "How does ramp height affect the distance a toy car travels?", "As ramp height increases, distance travelled increases because the car transfers more gravitational energy."),
  E("insulation", "materials", "insulation thickness", "temperature decrease in 10 minutes", "mm", "degrees C", [2, 4, 6, 8], "digital thermometer", 0.1, ["same beaker", "same starting temperature", "same time interval"], "How does insulation thickness affect temperature decrease?", "As insulation gets thicker, temperature decrease becomes smaller because energy transfer is reduced."),
  E("dissolving", "chemistry", "water temperature", "dissolving time", "degrees C", "s", [20, 30, 40, 50], "stopwatch", 1, ["same solute mass", "same water volume", "same stirring pattern"], "How does water temperature affect dissolving time?", "As water temperature increases, dissolving time decreases in this test."),
  E("magnet", "physics", "distance from magnet", "number of paper clips lifted", "cm", "paper clips", [1, 2, 3, 4], "ruler and count", 1, ["same magnet", "same paper clips", "same orientation"], "How does magnet distance affect the number of paper clips lifted?", "As distance increases, fewer paper clips are lifted in this setup."),
  E("plant", "biology", "measured water volume per day", "height increase after 14 days", "ml", "mm", [5, 10, 15, 20], "millimetre ruler", 1, ["same plant species and starting size", "same soil", "same light exposure"], "How does daily water volume affect plant height increase over 14 days?", "Plant growth changes with water volume, but the tested range may include an optimum rather than a simple always-more trend."),
];

const generated = [
  ...Array.from({ length: 47 }, (_, i) => buildVariables(i)),
  ...Array.from({ length: 47 }, (_, i) => buildMethod(i)),
  ...Array.from({ length: 47 }, (_, i) => buildPoe(i)),
  ...Array.from({ length: 47 }, (_, i) => buildConclusion(i)),
  ...Array.from({ length: 47 }, (_, i) => buildRetrieval(i)),
];
const enrichedCurated = curated.map(enrichVariant);
const enrichedGenerated = generated.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedGenerated];
pack.version = "0.2.0";
pack.qa = { ...pack.qa, readiness_status: "draft", notes: "Expanded deterministic Year 7 scientific-method pilot bank; generated variants require curriculum, teacher and accessibility review." };
validateBank(pack, enrichedCurated, enrichedGenerated);
if (JSON.stringify(enrichedCurated.map(removeScienceContract)) !== curatedSnapshot) throw new Error("Curated variants changed during generation.");
const output = `${JSON.stringify(pack, null, 2)}\n`;
if (write) { await writeFile(packPath, output, "utf8"); console.log(`Wrote ${relative(packPath)} with ${pack.question_variants.length} variants.`); }
else if (check) { if (sourceText !== output) throw new Error(`${relative(packPath)} is not deterministic; run --write.`); console.log(`Check passed: ${relative(packPath)} is deterministic.`); }
else console.log(`Validated ${generated.length} candidates; use --write or --check.`);
console.log(`Blueprints: ${summary(generated, (v) => v.body.variant_blueprint_id)}`);
console.log(`Formats (total): ${summary(pack.question_variants, (v) => v.format)}`);
console.log(`Audio refs: ${pack.question_variants.filter((v) => v.audio_ref).length}`);

function buildVariables(i) {
  const exp = experiments[i % experiments.length];
  const nonTest = i % 6 === 5;
  if (nonTest) {
    const enquiry = ["observation over time", "pattern seeking", "secondary-data enquiry"][i % 3];
    const setup = enquiry === "observation over time" ? "Record the first flowering date of the same marked plants each week without changing conditions." : enquiry === "pattern seeking" ? "Measure leaf length and width in a sample, looking for an association without changing either." : "Use a cited weather dataset to compare monthly rainfall and river level.";
    const answer = `Use ${enquiry}; do not invent an independent variable because nothing is deliberately changed`;
    return item({ i, exp, id: `variables-non-test-${i + 1}`, format: "variable-sort", blueprint: "variable-role-sorts", band: "intro", tag: "variables_forced_on_non_test", prompt: "Choose the enquiry type and variable language.", setup, answer, choices: [answer, "Call every recorded quantity an independent variable", "Use a fair test and keep the observed change the same", "A dependent variable must be deliberately changed"], explanation: `${setup} This is ${enquiry}. Recorded or compared variables can be named, but formal independent-variable language is inappropriate when the investigator does not manipulate a variable.`, integrity: { kind: "variables", enquiry_type: enquiry, fair_test: false, iv: null, dv: null, controls: [], operational_definition: setup, expected_answer: answer } });
  }
  const answer = `IV: ${exp.iv}; DV: ${exp.dv}; controls: ${exp.controls.join(", ")}`;
  return item({ i, exp, id: `variables-${exp.key}-${i + 1}`, format: "variable-sort", blueprint: "variable-role-sorts", band: "intro", tag: i % 2 ? "independent_dependent_confusion" : "everything_same_including_iv", prompt: "Assign the variable roles.", setup: `${exp.question} Measure ${exp.dv} as ${exp.operational}.`, answer, choices: [answer, `IV: ${exp.dv}; DV: ${exp.iv}; controls: ${exp.controls.join(", ")}`, `Keep ${exp.iv} the same and change ${exp.dv}`, `Change ${exp.iv} and ${exp.controls[0]} together`], explanation: `${exp.iv} is deliberately changed across ${exp.values.join(", ")} ${exp.ivUnit}; ${exp.dv} is measured in ${exp.dvUnit}. Controls make the comparison valid without keeping the IV unchanged.`, integrity: { kind: "variables", enquiry_type: "fair/comparative test", fair_test: true, iv: exp.iv, dv: exp.dv, controls: exp.controls, iv_values: exp.values, iv_unit: exp.ivUnit, dv_unit: exp.dvUnit, operational_definition: exp.operational, expected_answer: answer } });
}

function buildMethod(i) {
  const exp = experiments[i % experiments.length];
  const values = shiftedValues(exp.values, i);
  const steps = [`Set ${exp.iv} to ${values[0]} ${exp.ivUnit}`, `Measure ${exp.dv} with a ${exp.instrument} to ${exp.resolution} ${exp.dvUnit}`, "Record the result in the labelled table", "Repeat three times at this setting", `Repeat for ${values.slice(1).join(", ")} ${exp.ivUnit}`, "Calculate a mean but retain and inspect every reading"];
  const answer = `Use ${values.join(", ")} ${exp.ivUnit}; ${exp.instrument}, resolution ${exp.resolution} ${exp.dvUnit}; three repeats; keep ${exp.controls.join(", ")}`;
  return item({ i, exp, id: `method-${exp.key}-${i + 1}`, format: "investigation-planner", blueprint: "method-planner-builds", band: "expected", tag: i % 3 === 0 ? "fair_test_everything_same" : i % 3 === 1 ? "precision_equals_accuracy" : "delete_anomalies", prompt: "Select the reproducible, safe plan.", setup: exp.question, answer, choices: [answer, `Change ${exp.iv} and ${exp.controls[0]}; take one unlabelled reading`, `Keep ${exp.iv} unchanged so the test is fair`, `Use the most precise-looking instrument, delete unusual values and omit units`], explanation: `The plan uses a sensible ordered range with consistent intervals, defines ${exp.dv} operationally, states instrument, unit and resolution, controls relevant variables, repeats measurements and retains anomalies for investigation. Precision does not guarantee accuracy.`, integrity: { kind: "method", enquiry_type: "fair/comparative test", question: exp.question, iv: exp.iv, dv: exp.dv, controls: exp.controls, values, interval: values[1] - values[0], unit: exp.ivUnit, instrument: exp.instrument, measurement_unit: exp.dvUnit, resolution: exp.resolution, repeats: 3, steps, safe: true, risk_controls: riskFor(exp.key), expected_answer: answer } });
}

function buildPoe(i) {
  const exp = experiments[i % experiments.length];
  const table = makeTable(exp, i, i % 4 === 0);
  const judgement = table.trend === exp.direction ? "supported" : table.trend === "unclear" ? "insufficient" : "refuted";
  const answer = `${judgement}: compare the means ${table.rows.map((r) => `${r.mean} ${exp.dvUnit}`).join(", ")}; retain and investigate the readings`;
  return item({ i, exp, id: `poe-${exp.key}-${i + 1}`, format: "prediction-observation-explanation", blueprint: "poe-evidence-cycles", band: "developing", tag: i % 3 === 0 ? "prediction_equals_conclusion" : i % 3 === 1 ? "one_result_proves" : "delete_anomalies", prompt: "Judge the prediction after revealing the data.", setup: `${exp.question} Prediction: ${exp.prediction}`, answer, choices: [answer, "proved: the prediction was written before testing", "supported: one preferred reading is enough", "refuted: delete any reading that differs"], explanation: `A prediction is a reasoned statement made before data; a conclusion follows the evidence. The repeat means are ${table.rows.map((r) => r.mean).join(", ")} ${exp.dvUnit}, with ranges ${table.rows.map((r) => r.range).join(", ")}. The correct judgement is ${judgement}; unusual readings remain visible and prompt checking, not automatic deletion.`, integrity: { kind: "data", enquiry_type: "fair/comparative test", iv: exp.iv, dv: exp.dv, iv_unit: exp.ivUnit, dv_unit: exp.dvUnit, table, prediction: exp.prediction, canonical_judgement: judgement, expected_answer: answer } });
}

function buildConclusion(i) {
  const exp = experiments[(i + 2) % experiments.length];
  const table = makeTable(exp, i + 11, i % 5 === 0);
  const first = table.rows[0].mean;
  const last = table.rows.at(-1).mean;
  const difference = round(last - first, exp.resolution);
  const judgement = table.trend === exp.direction ? "supports" : table.trend === "unclear" ? "is insufficient to decide" : "refutes";
  const improvement = table.has_anomaly ? `repeat the anomalous setting and check ${exp.instrument} technique while retaining the original value` : `test one extra ${exp.iv} value within the safe range using the same controls and repeats`;
  const answer = `The evidence ${judgement} the prediction: the mean changed from ${first} to ${last} ${exp.dvUnit} (difference ${difference}); ${improvement}`;
  return item({ i, exp, id: `conclusion-${exp.key}-${i + 1}`, format: "conclusion-evidence-match", blueprint: "conclusion-evidence-matches", band: "secure", tag: i % 4 === 0 ? "conclusion_from_preference" : i % 4 === 1 ? "repeats_guarantee_truth" : i % 4 === 2 ? "correlation_means_causation" : "one_result_proves", prompt: "Choose the bounded conclusion and linked improvement.", setup: `${exp.question} Use the repeat table; no reading is hidden.`, answer, choices: [answer, "My preferred result proves the hypothesis for every situation", "Three repeats guarantee the conclusion is true and valid", "Delete variation, then claim the independent variable caused every change"], explanation: `The conclusion compares actual means (${first} and ${last} ${exp.dvUnit}) and reports the exact difference ${difference}. It uses ${judgement} rather than 'proves', keeps variation visible, and links the next step to ${table.has_anomaly ? "the anomalous setting" : "the limited tested range"}. Reliability concerns consistency; validity concerns whether the method answers the intended question.`, integrity: { kind: "conclusion", enquiry_type: "fair/comparative test", iv: exp.iv, dv: exp.dv, iv_unit: exp.ivUnit, dv_unit: exp.dvUnit, table, first_mean: first, last_mean: last, difference, canonical_judgement: judgement, limitation: table.has_anomaly ? "anomalous repeat" : "limited tested range", improvement, improvement_link: table.has_anomaly ? "anomaly" : "range", expected_answer: answer } });
}

function buildRetrieval(i) {
  const exp = experiments[i % experiments.length];
  const cases = [
    ["everything_same_including_iv", "What makes a fair comparison?", "Change the independent variable, measure the dependent variable and control other relevant variables", ["Keep every variable including the IV the same", "Make all outcomes equal", "Change the IV and DV deliberately"], "Fair means a controlled comparison, not identical settings or equal outcomes."],
    ["independent_dependent_confusion", "Which role statement is correct?", "The IV is deliberately changed; the DV is operationally measured", ["The DV is deliberately changed", "Every recorded value is a control", "IV and DV are interchangeable"], "Variable roles follow the planned action, not where a card appears in a table."],
    ["prediction_equals_conclusion", "How do prediction and conclusion differ?", "A prediction is made before data; a conclusion evaluates actual evidence", ["A conclusion repeats the prediction", "A prediction is corrected after seeing results", "Both are preferences"], "A reasoned prediction can be unsupported; the conclusion must respond to the collected evidence."],
    ["one_result_proves", "What can one result establish?", "It is one piece of evidence and cannot by itself prove a general claim", ["It proves the hypothesis", "It guarantees accuracy", "It should replace all repeats"], "Generalisations require sufficient relevant evidence; one reading may also reflect variation or error."],
    ["delete_anomalies", "What should happen to an anomalous reading?", "Retain, flag and investigate it; repeat or check technique before deciding how to summarise", ["Delete it immediately", "Change it to the mean", "Use only it"], "Anomalies are evidence about variation or method and must remain traceable."],
    ["precision_equals_accuracy", "Which statement is valid?", "Resolution describes instrument increments; precision is closeness of repeats; neither alone guarantees accuracy", ["More decimal places guarantee accuracy", "Precise repeats prove validity", "Accuracy and resolution are identical"], "A systematic bias can produce precise but inaccurate values."],
    ["repeats_guarantee_truth", "What do repeats improve?", "They reveal variation and can improve confidence in a summary, but do not guarantee truth or validity", ["They prove causation", "They remove every uncertainty", "They make controls unnecessary"], "Repeated measurements help assess consistency; a flawed method can repeat consistently."],
    ["fair_means_equal_outcomes", "What does fair mean in a fair test?", "Relevant controls are held constant so outcomes can differ because the IV changed", ["Every result must be equal", "The IV must stay constant", "Participants choose preferred outcomes"], "Fairness concerns the comparison method, not forcing equal results."],
    ["correlation_means_causation", "A secondary dataset shows two variables rise together. What follows?", "There is an association; causation needs further evidence and alternative explanations", ["One variable definitely causes the other", "A fair test has already occurred", "No variables may be discussed"], "Pattern evidence can motivate a hypothesis but confounding factors or coincidence remain possible."],
    ["reliability_validity_confusion", "Which distinction is correct?", "Reliability concerns consistency; validity concerns whether the method answers the intended question", ["Reliability means the preferred result", "Validity means many repeats", "They are identical"], "A method may be repeatable yet invalid if it measures the wrong outcome or fails to control a relevant factor."],
  ];
  const [tag, prompt, answer, distractors, explanation] = cases[i % cases.length];
  return item({ i, exp, id: `retrieval-${i + 1}`, format: "variable-sort", blueprint: "working-scientifically-retrieval", band: "retrieval", tag, prompt, setup: `Retrieval audit in ${exp.domain}: select the precise scientific-method statement.`, answer, choices: [answer, ...distractors], explanation, integrity: { kind: "concept", enquiry_type: i % cases.length === 8 ? "secondary-data enquiry" : "method vocabulary", canonical_claim: answer, concept_code: tag, expected_answer: answer } });
}

function item({ i, exp, id, format, blueprint, band, tag, prompt, setup, answer, choices, explanation, integrity }) {
  const values = unique(choices);
  if (values.length !== 4 || values.filter((v) => same(v, answer)).length !== 1) throw new Error(`${id} choices invalid.`);
  const rotated = rotate(values, i % 4);
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt: `${blueprint} mission ${i + 1}: ${prompt}`,
      setup,
      choices: rotated,
      domain: exp.domain,
      method_integrity: integrity,
      variant_blueprint_id: blueprint,
      review_batch: batch,
      difficulty_band: band,
      coverage_tags: coverageFor(tag, integrity),
      misconception_choice_map: misconceptionMap(rotated, answer, tag),
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_recorded",
      supported_interactions: ["touch_select", "keyboard", "switch_scan", "eye_gaze", "aac", "point", "adult_recorded"],
      interaction_support: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac: true, point_or_partner_scan: true, adult_recorded: true, precision_drag_required: false, handwriting_required: false, speech_required: false, undo_available: true },
      row_by_row_table: integrity.table ? integrity.table.rows.map((r) => ({ setting: `${r.iv} ${integrity.iv_unit}`, readings: r.readings.map((x) => `${x} ${integrity.dv_unit}`), mean: `${r.mean} ${integrity.dv_unit}`, range: `${r.range} ${integrity.dv_unit}` })) : [],
      equivalent_simplified_view: "Show one decision or one data row at a time with the same variables, values and evidence demand; no scientific reasoning is removed.",
      static_text_alternative: `Setup: ${setup} Choices: ${rotated.join(" | ")}. Data are available row by row with units and headings.`,
      low_sensory: true,
      reduced_motion: true,
      colour_independent: true,
      safety_note: integrity.safe === false ? "Use secondary data or simulation only." : "Use the supplied safe simulation or a teacher-approved classroom plan with stated risk controls; no tasting, mains electricity, flames, unknown chemicals or unsafe launches.",
      timed: false,
      timer_allowed: false,
      speed_score_allowed: false,
      streak_required: false,
      lost_lives_allowed: false,
      leaderboard_allowed: false,
      browser_tts_allowed: false,
      audio_policy: "Audio is optional. Any future narration or sonification must use a produced, human-reviewed ElevenLabs asset and have a complete text equivalent; browser TTS is prohibited.",
      spaced_retrieval: { interval: ["same_session", "next_session", "3_days", "7_days"][i % 4], access_route_can_change: true },
    },
    expected_answer: { value: answer },
    hints: [hintOne(integrity), hintTwo(integrity)],
    explanation,
    feedback: {
      correct: `Evidence audit complete. ${explanation}`,
      try_again: `No time or progress is lost. ${hintOne(integrity)}`,
      misconception: `The '${tag.replaceAll("_", " ")}' route conflicts with the enquiry design or evidence. ${hintTwo(integrity)}`,
      evidence: evidenceFor(integrity),
      uncertainty: "Keep all original readings visible. Describe variation, flag anomalies and investigate them; do not silently delete or alter data.",
      improvement_check: "A useful improvement names a limitation, changes a specific method feature and explains how that improves reliability or validity.",
      support: "Use row-by-row data, static text, keyboard, switch scan, eye gaze, AAC/pointing or adult-recorded response with identical reasoning.",
    },
    gamification: { mission: "Calm Evidence Observatory", objective: "Log one defensible method or evidence decision before reveal.", reward: `private_evidence_badge_${(i % 9) + 1}`, no_timer: true, no_speed_reward: true, no_loss: true, no_streak_pressure: true, leaderboard: false, retry_encouraged: true },
    difficulty: { intro: 3, developing: 5, expected: 6, secure: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "prediction-observation-explanation" ? "poe-static-evidence-reveal" : format === "investigation-planner" ? "method-order-audit" : "evidence-card-lock",
  };
}

function validateBank(current, authored, candidates) {
  if (authored.length !== 5 || candidates.length !== 235 || current.question_variants.length !== target) throw new Error("Count validation failed.");
  const blueprints = new Map(current.variant_blueprints.map((b) => [b.id, b]));
  const formats = new Set(current.practice.formats);
  const ids = new Set(), signatures = new Set(), actualB = new Set(), actualF = new Set(), coverage = new Set();
  for (const v of current.question_variants) { if (ids.has(v.id)) throw new Error(`Duplicate id ${v.id}.`); ids.add(v.id); const s = `${v.format}|${normalise(v.body?.prompt)}|${JSON.stringify(v.expected_answer)}`; if (signatures.has(s)) throw new Error(`Duplicate signature ${v.id}.`); signatures.add(s); validateScienceContract(v); }
  for (const v of candidates) {
    const bp = blueprints.get(v.body.variant_blueprint_id);
    if (!bp || bp.format !== v.format || !formats.has(v.format) || v.status !== "review") throw new Error(`${v.id} blueprint/format/status mismatch.`);
    if (v.body.prompt.length > 180) throw new Error(`${v.id} prompt exceeds 180 characters.`);
    if (!v.body.setup || !v.body.static_text_alternative || !v.body.equivalent_simplified_view || !v.body.safety_note) throw new Error(`${v.id} lacks setup/access/safety.`);
    if (!v.body.interaction_support?.keyboard || !v.body.interaction_support?.switch_scan || !v.body.interaction_support?.eye_gaze || !v.body.interaction_support?.aac || v.body.interaction_support.precision_drag_required !== false || v.body.interaction_support.handwriting_required !== false || v.body.interaction_support.speech_required !== false) throw new Error(`${v.id} lacks alternate inputs.`);
    if (v.body.timer_allowed || v.body.speed_score_allowed || v.body.streak_required || v.body.lost_lives_allowed || v.body.leaderboard_allowed || v.body.browser_tts_allowed !== false) throw new Error(`${v.id} introduces pressure or browser TTS.`);
    if (!v.feedback?.correct || !v.feedback?.try_again || !v.feedback?.misconception || !v.feedback?.evidence || !v.feedback?.uncertainty || !v.feedback?.improvement_check || v.explanation.length < 50) throw new Error(`${v.id} lacks rich feedback.`);
    if (v.body.choices.length !== 4 || new Set(v.body.choices.map(serialise)).size !== 4 || v.body.choices.filter((x) => same(x, v.expected_answer.value)).length !== 1 || Object.keys(v.body.misconception_choice_map).length !== 3) throw new Error(`${v.id} answer/distractor integrity failed.`);
    validateScience(v);
    actualB.add(v.body.variant_blueprint_id); actualF.add(v.format); for (const x of v.body.coverage_tags) coverage.add(x);
  }
  requireAll("blueprints", new Set(blueprints.keys()), actualB); requireAll("formats", formats, actualF);
  requireAll("coverage", new Set(["formal_variables", "non_test_enquiries", "operational_definitions", "range_intervals", "reproducibility", "instrument_units_resolution", "repeats_means_ranges", "variation_anomalies", "safety", "structured_tables", "poe", "evidence_conclusions", "support_refute_insufficient", "reliability_validity", "correlation_not_causation", "specific_improvements", "misconceptions", "spaced_retrieval"]), coverage);
  const bc = countBy(candidates, (v) => v.body.variant_blueprint_id); for (const id of blueprints.keys()) if (bc[id] !== 47) throw new Error(`${id} expected 47, found ${bc[id] ?? 0}.`);
  const fc = countBy(current.question_variants, (v) => v.format); const expected = { "variable-sort": 96, "investigation-planner": 48, "prediction-observation-explanation": 48, "conclusion-evidence-match": 48 }; for (const [k, n] of Object.entries(expected)) if (fc[k] !== n) throw new Error(`${k} expected ${n}, found ${fc[k] ?? 0}.`);
  if (candidates.some((v) => v.audio_ref || /browser tts allowed/i.test(JSON.stringify(v)))) throw new Error("Unexpected audio/browser-TTS state.");
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  return {
    ...variant,
    body: {
      ...body,
      scientific_method_contract: {
        kind: "scientific_method_evidence",
        evidence_steps: ["define_question_and_variables", "control_or_describe_conditions", "record_repeated_data", "judge_claim_with_uncertainty"],
        response_modes: ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"],
        row_by_row_data_supported: true,
        safety_review_required: true,
        precision_drag_required: false,
        timed: false,
        preserve_correct_work: true,
      },
    },
  };
}

function validateScienceContract(variant) {
  const contract = variant.body?.scientific_method_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  const requiredSteps = ["define_question_and_variables", "control_or_describe_conditions", "record_repeated_data", "judge_claim_with_uncertainty"];
  if (!contract || contract.kind !== "scientific_method_evidence" || contract.row_by_row_data_supported !== true || contract.safety_review_required !== true || contract.precision_drag_required !== false || contract.timed !== false || contract.preserve_correct_work !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode)) || requiredSteps.some((step) => !contract.evidence_steps?.includes(step))) throw new Error(`${variant.id} lacks an accessible scientific-method contract.`);
}

function removeScienceContract(variant) {
  const { scientific_method_contract: _scienceContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function validateScience(v) {
  const m = v.body.method_integrity;
  if (!m?.kind || v.expected_answer.value !== m.expected_answer) throw new Error(`${v.id} canonical answer mismatch.`);
  if (m.kind === "variables") { if (m.fair_test && (!m.iv || !m.dv || m.controls.length < 2 || !m.iv_values?.length || !m.operational_definition)) throw new Error(`${v.id} incomplete formal variables.`); if (!m.fair_test && (m.iv !== null || m.dv !== null)) throw new Error(`${v.id} forces variables on non-test enquiry.`); }
  else if (m.kind === "method") { if (!m.iv || !m.dv || m.controls.length < 2 || m.values.length < 4 || !equalIntervals(m.values, m.interval) || !m.instrument || !m.measurement_unit || !(m.resolution > 0) || m.repeats < 3 || m.steps.length < 6 || !m.safe || !m.risk_controls.length) throw new Error(`${v.id} method integrity failed.`); }
  else if (m.kind === "data" || m.kind === "conclusion") { validateTable(v.id, m.table); if (!m.canonical_judgement) throw new Error(`${v.id} missing evidence judgement.`); if (m.kind === "conclusion") { const first = m.table.rows[0].mean, last = m.table.rows.at(-1).mean; if (m.first_mean !== first || m.last_mean !== last || m.difference !== round(last - first, m.table.resolution) || !m.improvement || !m.improvement_link) throw new Error(`${v.id} conclusion arithmetic/link failed.`); } }
  else if (m.kind !== "concept" || !m.canonical_claim) throw new Error(`${v.id} concept integrity failed.`);
}

function E(key, domain, iv, dv, ivUnit, dvUnit, values, instrument, resolution, controls, question, prediction) {
  const direction = key === "plant" ? "optimum" : ["insulation", "dissolving", "magnet"].includes(key) ? "decreasing" : "increasing";
  return { key, domain, iv, dv, ivUnit, dvUnit, values, instrument, resolution, controls, question, prediction, direction, operational: `${dv} recorded with ${instrument} to the nearest ${resolution} ${dvUnit} after the stated interval` };
}
function makeTable(exp, seed, anomaly) {
  const pattern = seed % 6;
  let centres = exp.values.map((x, index) => baseValue(exp, x, index));
  if (pattern === 1) centres = [...centres].reverse();
  if (pattern === 2) centres = centres.map(() => centres[0]);
  const rows = exp.values.map((iv, index) => {
    const c = centres[index];
    const isAnomaly = anomaly && index === 1;
    const readings = isAnomaly ? [round(c - exp.resolution, exp.resolution), c, round(c + 4 * exp.resolution, exp.resolution)] : [round(c - exp.resolution, exp.resolution), c, round(c + exp.resolution, exp.resolution)];
    const mean = round(readings.reduce((a, b) => a + b, 0) / readings.length, exp.resolution);
    const range = round(Math.max(...readings) - Math.min(...readings), exp.resolution);
    return { iv, readings, mean, range, anomaly_flag: isAnomaly };
  });
  return { headings: [`${exp.iv} (${exp.ivUnit})`, `repeat 1 (${exp.dvUnit})`, `repeat 2 (${exp.dvUnit})`, `repeat 3 (${exp.dvUnit})`, `mean (${exp.dvUnit})`, `range (${exp.dvUnit})`], rows, resolution: exp.resolution, repeats: 3, has_anomaly: anomaly, trend: classifyTrend(rows.map((r) => r.mean), exp.direction) };
}
function baseValue(exp, x, index) { if (exp.key === "ramp") return 18 + index * 9; if (exp.key === "insulation") return round(9 - index * 1.5, exp.resolution); if (exp.key === "dissolving") return 90 - index * 15; if (exp.key === "magnet") return 10 - index * 2; return [4, 8, 11, 7][index]; }
function classifyTrend(values, expected) { const first = values[0], last = values.at(-1); if (expected === "optimum") { const max = Math.max(...values), interior = Math.max(...values.slice(1, -1)); if (interior === max && interior > first && interior > last) return "optimum"; if (new Set(values).size === 1) return "unclear"; return "different"; } if (new Set(values).size === 1) return "unclear"; if (last > first) return "increasing"; if (last < first) return "decreasing"; return "unclear"; }
function validateTable(id, table) { if (!table?.headings?.every((x) => /\(.+\)/.test(x)) || table.rows.length !== 4 || table.repeats !== 3 || !(table.resolution > 0)) throw new Error(`${id} table metadata invalid.`); for (const row of table.rows) { if (row.readings.length !== 3) throw new Error(`${id} repeat count invalid.`); const mean = round(row.readings.reduce((a, b) => a + b, 0) / 3, table.resolution); const range = round(Math.max(...row.readings) - Math.min(...row.readings), table.resolution); if (row.mean !== mean || row.range !== range) throw new Error(`${id} mean/range mismatch.`); } if (table.has_anomaly !== table.rows.some((r) => r.anomaly_flag)) throw new Error(`${id} anomaly flag mismatch.`); }
function shiftedValues(values, i) { const add = i % 3; return values.map((v) => v + add * (values[1] - values[0])); }
function equalIntervals(values, interval) { return values.every((v, i) => i === 0 || v - values[i - 1] === interval); }
function round(value, resolution) { const decimals = String(resolution).includes(".") ? String(resolution).split(".")[1].length : 0; return Number((Math.round(value / resolution) * resolution).toFixed(decimals)); }
function riskFor(key) { return ({ ramp: ["use a low ramp", "keep the landing zone clear", "release rather than throw"], insulation: ["use warm, not boiling, water", "use stable containers", "wipe spills"], dissolving: ["use a safe simulation or teacher-provided substances", "do not taste materials", "use warm, not hot, water"], magnet: ["use small classroom magnets", "keep away from devices and medical implants", "no projectiles"], plant: ["use a tray for spills", "wash hands after soil handling", "offer a no-touch image/data route"] })[key]; }
function hintOne(m) { if (m.kind === "variables") return "Ask what is deliberately changed, what is operationally measured, and whether this enquiry manipulates anything at all."; if (m.kind === "method") return "Check question, variable range, ordered steps, instrument, unit, resolution, controls, repeats and risks."; if (m.table) return "Read one row at a time; recompute each mean and range while retaining every reading."; return "Use the precise scientific-method definition, not a slogan."; }
function hintTwo(m) { if (m.kind === "variables") return "A fair test changes the IV; observations and secondary-data enquiries may have no manipulated IV."; if (m.kind === "method") return "Reproducibility needs enough detail for another person to repeat the same settings and measurements safely."; if (m.table) return "Judge support, refutation or insufficiency from comparative evidence; repeats do not prove truth and correlation alone is not causation."; return "Test the claim with a counterexample and separate reliability from validity."; }
function evidenceFor(m) { if (m.kind === "variables") return m.fair_test ? `The plan explicitly changes ${m.iv}, measures ${m.dv}, and controls ${m.controls.join(", ")}.` : `${m.enquiry_type} records or compares evidence without a deliberately manipulated independent variable.`; if (m.kind === "method") return `${m.values.length} ordered settings use interval ${m.interval} ${m.unit}; ${m.repeats} repeats use ${m.instrument} at resolution ${m.resolution} ${m.measurement_unit}.`; if (m.table) return `Recomputed row means are ${m.table.rows.map((r) => r.mean).join(", ")} and ranges are ${m.table.rows.map((r) => r.range).join(", ")}; judgement: ${m.canonical_judgement}.`; return `The canonical definition is: ${m.canonical_claim}`; }
function coverageFor(tag, m) { const base = ["misconceptions", "spaced_retrieval", "reliability_validity", "correlation_not_causation"]; const byKind = { variables: ["formal_variables", "non_test_enquiries", "operational_definitions"], method: ["formal_variables", "range_intervals", "reproducibility", "instrument_units_resolution", "safety", "structured_tables", "repeats_means_ranges", "variation_anomalies"], data: ["structured_tables", "poe", "repeats_means_ranges", "variation_anomalies", "support_refute_insufficient", "evidence_conclusions"], conclusion: ["structured_tables", "repeats_means_ranges", "variation_anomalies", "evidence_conclusions", "support_refute_insufficient", "specific_improvements"], concept: ["formal_variables", "non_test_enquiries", "operational_definitions", "range_intervals", "reproducibility", "instrument_units_resolution", "repeats_means_ranges", "variation_anomalies", "safety", "structured_tables", "poe", "evidence_conclusions", "support_refute_insufficient", "specific_improvements"] }; return [...new Set([...base, ...(byKind[m.kind] ?? []), tag])]; }
function misconceptionMap(choices, answer, tag) { const map = {}, labels = [tag, "method_or_variable_role_error", "evidence_overclaim_or_data_handling_error"]; let i = 0; for (const choice of choices) if (!same(choice, answer)) map[serialise(choice)] = labels[i++]; return map; }
function unique(values) { const seen = new Set(); return values.filter((v) => { const key = serialise(v); if (seen.has(key)) return false; seen.add(key); return true; }); }
function same(a, b) { return serialise(a) === serialise(b); }
function serialise(v) { return JSON.stringify(v); }
function rotate(values, n) { const k = n % values.length; return values.slice(k).concat(values.slice(0, k)); }
function requireAll(label, required, actual) { const missing = [...required].filter((x) => !actual.has(x)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(values, fn) { const out = {}; for (const v of values) { const key = fn(v); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(values, fn) { return Object.entries(countBy(values, fn)).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}:${n}`).join(", "); }
function normalise(v) { return String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
