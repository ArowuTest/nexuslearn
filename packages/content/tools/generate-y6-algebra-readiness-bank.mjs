#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y6-algebra-readiness.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y6-algebra-readiness-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y6-algebra-readiness") throw new Error("This generator only supports the Year 6 algebra-readiness pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const missions = [
  { key: "archive", place: "Cipher Archive", goal: "restore the missing rule index", reward: "logic-key fragment" },
  { key: "observatory", place: "Pattern Observatory", goal: "decode the signal sequence", reward: "signal coordinate" },
  { key: "museum", place: "Equation Museum", goal: "unlock the balanced gallery", reward: "balance seal" },
  { key: "robotics", place: "Function Robotics Lab", goal: "repair the input-output rover", reward: "machine command tile" },
  { key: "island", place: "Variable Island Station", goal: "map the changing quantities", reward: "variable-map marker" },
];

const candidates = [
  ...variableCandidates(30),
  ...unknownCandidates(30),
  ...sequenceCandidates(30),
  ...formulaCandidates(30),
  ...substitutionCandidates(29),
  ...equivalenceCandidates(29),
  ...functionMachineCandidates(29),
  ...misconceptionCandidates(29),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Depth-wave review bank reaches the 240-item pilot target with four preserved curated questions and 236 deterministic candidates covering variables, unknowns, sequences, simple formulae, substitution, equivalence, function machines and misconception repair as a supported bridge to KS3. Generated candidates include concrete-to-pictorial-to-symbolic scaffolds, keyboard/switch/oral and non-drag routes, rich representation/calculation/check feedback and strategic codebreaker missions with no timers, lost lives or streak pressure. Human curriculum, teacher, SEND, accessibility, safeguarding and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, enrichedCandidates);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`algebra-readiness-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`algebra-readiness-bank strands=${summary(candidates, (variant) => variant.body.algebra_strand)}`);
console.log(`algebra-readiness-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`algebra-readiness-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`algebra-readiness-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 algebra-readiness bank is out of date; run generate-y6-algebra-readiness-bank.mjs --write.");
  console.log("algebra-readiness-bank deterministic check passed");
} else {
  console.log("algebra-readiness-bank dry-run; pass --write to update the pack");
}

function variableCandidates(count) {
  const cases = [
    { prompt: "In T = 4n + 1, figure number n can take different values. What is n?", answer: "a variable representing the figure number", wrong: ["the letter-name of a tile", "a fixed answer that must always be 4", "an instruction to add the alphabet"] },
    { prompt: "A bag contains b counters, and different bags may contain different amounts. What does b represent?", answer: "a varying number of counters in a bag", wrong: ["the word bag instead of a number", "exactly 2 because b is the second letter", "a multiplication sign"] },
    { prompt: "In p = 2l + 2w, which quantities may vary?", answer: "l and w may vary, and p changes with them", wrong: ["the letters are labels with no values", "only the number 2 may vary", "p must always equal 4"] },
    { prompt: "A rule says y = x + 5. What happens when x changes?", answer: "y changes so that it remains 5 greater than x", wrong: ["x and y are the same unknown forever", "y stays at 5", "the letters are placed in alphabetic order"] },
    { prompt: "A square has side length s. Which expression gives its perimeter?", answer: "4s, because s can represent any chosen side length", wrong: ["s + 4, because the letter means side", "4, because letters cannot have values", "ssss as a word"] },
    { prompt: "In one equation, k has one value that makes the equation true. How is k being used?", answer: "as an unknown to be found in that equation", wrong: ["as a unit label only", "as every number at once", "as a command to multiply"] },
    { prompt: "A table uses d for day number and h for plant height. Which statement is precise?", answer: "d and h represent quantities; their paired values may change by row", wrong: ["d means day as a label and can never be a number", "h must equal 8 because it is the eighth letter", "letters cannot be used in tables"] },
    { prompt: "Why can the same letter have different values in separate unrelated problems?", answer: "a letter's meaning and allowed values are defined by each problem", wrong: ["letters have one secret universal value", "alphabet position decides every value", "the letter is decoration"] },
  ];
  return buildFromCases("variable", count, cases, ({ item, index, mission, id }) => variant({ id, format: "multiple_choice", blueprint: "variables-and-unknowns", band: "intro", strand: "variables", mission, prompt: `Variable decoder ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, concrete: "labelled bags, lengths or changing table cards", visual: "quantity-letter mapping card and value table", symbolic: item.prompt, hints: ["Say the quantity the letter stands for before using a value.", "Decide whether the letter can vary or has one unknown value in this particular statement."], explanation: `${item.answer}. Letters represent numbers or quantities defined by context; they are not alphabet values or merely abbreviated labels.`, tag: "letter_as_label", repair: "Match each letter card to a quantity card, then place two possible numerical values beneath it when variation is allowed." }));
}

function unknownCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 1) % missions.length];
    const mode = index % 5;
    const x = 5 + (index % 11);
    const a = 3 + (index % 6);
    const b = 7 + (index % 8);
    let equation;
    let answer;
    let choices;
    let bar;
    if (mode === 0) { equation = `x + ${b} = ${x + b}`; answer = x; choices = [x, x + b, b, Math.max(0, x - b)]; bar = `whole ${x + b}, known part ${b}, unknown part x`; }
    else if (mode === 1) { equation = `x - ${b} = ${x}`; answer = x + b; choices = [x + b, x, b, x + b * 2]; bar = `starting whole x, subtract ${b}, remainder ${x}`; }
    else if (mode === 2) { equation = `${a}x = ${a * x}`; answer = x; choices = [x, a * x, a, x + a]; bar = `${a} equal groups, each x, total ${a * x}`; }
    else if (mode === 3) { equation = `x ÷ ${a} = ${x}`; answer = x * a; choices = [x * a, x, a, x + a]; bar = `whole x split into ${a} equal groups of ${x}`; }
    else { equation = `${a}x + ${b} = ${a * x + b}`; answer = x; choices = [x, a * x, x + b, a * x + b]; bar = `${a} equal x-parts plus ${b}, total ${a * x + b}`; }
    return variant({ id: `unknown-${mode + 1}-${index + 1}`, format: "symbol-build", blueprint: "missing-number-to-symbol-bridges", band: "developing", strand: "unknowns", mission, prompt: `Unknown vault ${index + 1}: which value of x makes ${equation} true?`, choices, answer, concrete: bar, visual: `balance or bar model for ${equation}`, symbolic: equation, hints: ["Treat x as the missing number that keeps the statement true.", mode === 4 ? `Undo + ${b}, then undo × ${a}.` : "Use the inverse operation and check by substituting the value back."], explanation: `x = ${answer}. Substituting gives ${equation.replaceAll("x", String(answer))}, which confirms both sides have equal value.`, tag: "letter_as_label", repair: "Replace x with an empty box, solve the familiar missing-number model, then return the letter to the box." });
  });
}

function sequenceCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 2) % missions.length];
    const step = 2 + (index % 7);
    const start = 1 + (index % 6);
    const mode = index % 3;
    const terms = Array.from({ length: 5 }, (_, i) => mode === 2 ? start + step * i * i : start + step * i);
    let prompt;
    let answer;
    let choices;
    let rule;
    if (mode === 0) { rule = `add ${step}`; prompt = `The sequence is ${terms.join(", ")}. What is the next term?`; answer = start + step * 5; choices = [answer, answer + step, answer - 1, terms[4] * step]; }
    else if (mode === 1) { const c = start - step; rule = `T = ${step}n ${c >= 0 ? "+" : "-"} ${Math.abs(c)}`; prompt = `The sequence is ${terms.join(", ")}. Which nth-term rule works for term number n?`; answer = rule; choices = [answer, `T = n + ${step}`, `T = ${step}n + ${start}`, `T = ${start}n + ${step}`]; }
    else { const firstDiff = terms.slice(1).map((v, i) => v - terms[i]); rule = "not arithmetic because the first differences change"; prompt = `The sequence is ${terms.join(", ")}. Is one constant add-step enough?`; answer = rule; choices = [answer, `yes, add ${step}`, "yes, every increasing sequence is arithmetic", "no, because sequences cannot contain squares"]; }
    return variant({ id: `sequence-${mode + 1}-${index + 1}`, format: "function-machine", blueprint: "sequence-rule-builds", band: "expected", strand: "sequences", mission, prompt: `Sequence signal ${index + 1}: ${prompt}`, choices, answer, concrete: "term cards arranged by position with equal-jump tiles", visual: `position-value table for ${terms.join(", ")}`, symbolic: rule, hints: ["Compare consecutive terms and record each difference.", mode === 1 ? "Test the rule at n = 1 and another position." : "A constant first difference is required for a simple arithmetic sequence."], explanation: `${answer}. Checking positions and differences distinguishes a repeatable rule from a guess based only on the last term.`, tag: mode === 2 ? "assumes_constant_difference" : "term_value_as_position", repair: "Build terms with counters above numbered position cards, then place difference arrows between neighbouring terms." });
  });
}

function formulaCandidates(count) {
  const cases = [
    { key: "rectangle-perimeter", prompt: "A rectangle has length l and width w. Build a formula for perimeter P.", answer: "P = 2l + 2w", wrong: ["P = l + w", "P = lw", "P = 2 + l + w"] },
    { key: "square-perimeter", prompt: "A square has side s. Build a formula for perimeter P.", answer: "P = 4s", wrong: ["P = s + 4", "P = s²", "P = 4 + 4"] },
    { key: "matchsticks", prompt: "A pattern uses 3 sticks per section plus 2 end sticks. Build a formula for total T from n sections.", answer: "T = 3n + 2", wrong: ["T = 3 + n + 2", "T = 5n", "T = 3n²"] },
    { key: "cost-points", prompt: "Each badge costs c points and there is a fixed 5-point setup. Build total P for n badges.", answer: "P = cn + 5", wrong: ["P = c + n + 5", "P = 5cn", "P = c + 5n"] },
    { key: "temperature", prompt: "A model output y is double input x, then 7 is subtracted. Build the formula.", answer: "y = 2x - 7", wrong: ["y = 2(x - 7)", "y = x - 14", "y = 2 + x - 7"] },
    { key: "rows", prompt: "There are r rows of 8 seats and 3 extra seats. Build total S.", answer: "S = 8r + 3", wrong: ["S = 8 + r + 3", "S = 11r", "S = 8(r + 3)"] },
    { key: "distance", prompt: "A rover travels d metres each minute for t minutes. Build distance D.", answer: "D = dt", wrong: ["D = d + t", "D = d - t", "D = d ÷ t"] },
    { key: "decrease", prompt: "A tank begins with v litres and loses 4 litres. Build remaining amount R.", answer: "R = v - 4", wrong: ["R = 4 - v", "R = 4v", "R = v + 4"] },
  ];
  return buildFromCases("formula", count, cases, ({ item, index, mission, id }) => variant({ id, format: "symbol-build", blueprint: "simple-formula-symbol-builds", band: "expected", strand: "simple_formulae", mission, prompt: `Formula forge ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, concrete: "labelled equal groups, side-length rods or input cards", visual: "bar/shape model with each repeated quantity bracketed", symbolic: item.answer, hints: ["Name what varies and what stays fixed.", "Translate repeated equal groups as multiplication, then preserve the stated operation order."], explanation: `${item.answer}. Each letter retains its defined quantity, and the operations reproduce the concrete or visual structure for any allowed input.`, tag: "letter_as_label", repair: "Build one numerical example, replace each changing number with its quantity letter, then test the formula on a second example." }));
}

function substitutionCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 3) % missions.length];
    const mode = index % 5;
    const x = 3 + (index % 8);
    const a = 2 + (index % 5);
    const b = 4 + (index % 7);
    let formula;
    let value;
    let working;
    if (mode === 0) { formula = `y = ${a}x + ${b}`; value = a * x + b; working = `${a} × ${x} + ${b}`; }
    else if (mode === 1) { formula = `P = 4s`; value = 4 * x; working = `4 × ${x}`; }
    else if (mode === 2) { formula = `T = ${a}n - ${b}`; value = a * x - b; working = `${a} × ${x} - ${b}`; }
    else if (mode === 3) { formula = `A = lw, where l = ${x + 2} and w = ${x}`; value = (x + 2) * x; working = `${x + 2} × ${x}`; }
    else { formula = `C = 2a + 2b, where a = ${x} and b = ${b}`; value = 2 * x + 2 * b; working = `2 × ${x} + 2 × ${b}`; }
    return variant({ id: `substitute-${mode + 1}-${index + 1}`, format: "function-machine", blueprint: "simple-formula-machines", band: "expected", strand: "substitution", mission, prompt: `Substitution lock ${index + 1}: use ${formula}${mode < 3 ? ` when ${mode === 1 ? "s" : mode === 2 ? "n" : "x"} = ${x}` : ""}. Which output is correct?`, choices: [value, value + b, a + x + b, Math.abs(value - a * x)], answer: value, concrete: "input-value card placed over every matching letter token", visual: `staged machine: substitute -> ${working} -> calculate`, symbolic: `${formula}; output ${value}`, hints: ["Replace every occurrence of each letter with its given value.", `Write the numerical calculation ${working} before evaluating it.`], explanation: `Substitution gives ${working} = ${value}. The letter is replaced everywhere before the operations are completed in the formula's order.`, tag: "partial_substitution", repair: "Cover each matching letter with a copy of the input card, then reveal one operation stage at a time." });
  });
}

function equivalenceCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 4) % missions.length];
    const mode = index % 4;
    const x = 4 + (index % 9);
    const a = 10 + (index % 8);
    let prompt;
    let answer;
    let choices;
    if (mode === 0) { prompt = `${a} + ${x} = ${a + 2} + n`; answer = x - 2; choices = [answer, x, a + x, x + 2]; }
    else if (mode === 1) { prompt = `3n + ${a} = ${3 * x + a}`; answer = x; choices = [answer, 3 * x, x + a, 3 * x + a]; }
    else if (mode === 2) { prompt = `2(n + ${a}) = 2n + k`; answer = `k = ${2 * a}`; choices = [answer, `k = ${a}`, "k = 2", `k = ${a + 2}`]; }
    else { prompt = `${a} + n = n + ${a}`; answer = "true for every value of n"; choices = [answer, `true only when n = ${a}`, "false because the letters moved", "n must equal 0"]; }
    return variant({ id: `equivalence-${mode + 1}-${index + 1}`, format: "equation-balance", blueprint: "relational-equality-balances", band: "secure", strand: "equivalence", mission, prompt: `Balance chamber ${index + 1}: which value or statement keeps ${prompt} true?`, choices, answer, concrete: "two-pan balance with identical-value tiles", visual: `left expression | equals balance | right expression: ${prompt}`, symbolic: prompt, hints: ["Treat equals as 'has the same value as', not 'write the answer next'.", "Evaluate, substitute or make the same legal change while preserving both sides."], explanation: `${String(answer)} keeps the relationship true. Equality compares the complete value on each side, including cases that are true for every permitted value.`, tag: "equals_means_answer", repair: "Build each side on separate balance mats, compare totals, then remove or add matching tiles without tipping the model." });
  });
}

function functionMachineCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[index % missions.length];
    const mode = index % 4;
    const input = 2 + (index % 9);
    const a = 2 + (index % 5);
    const b = 3 + (index % 7);
    let prompt;
    let answer;
    let choices;
    let machine;
    if (mode === 0) { machine = `× ${a}, then + ${b}`; answer = input * a + b; prompt = `Input ${input} goes through ${machine}. What is the output?`; choices = [answer, (input + b) * a, input + a + b, input * a]; }
    else if (mode === 1) { machine = `+ ${b}, then × ${a}`; answer = (input + b) * a; prompt = `Input ${input} goes through ${machine}. What is the output?`; choices = [answer, input + b * a, input * a + b, input + a + b]; }
    else if (mode === 2) { machine = `× ${a}, then - ${b}`; const output = input * a - b; answer = input; prompt = `The machine ${machine} gives output ${output}. What input was used?`; choices = [answer, output, output + b, Math.max(0, output - b)]; }
    else { machine = "unknown rule"; const pairs = [[1, a + b], [2, 2 * a + b], [3, 3 * a + b]]; answer = `× ${a}, then + ${b}`; prompt = `The pairs are ${pairs.map(([i, o]) => `${i}->${o}`).join(", ")}. Which rule fits every pair?`; choices = [answer, `+ ${a + b}`, `× ${b}, then + ${a}`, `× ${a + b}`]; }
    return variant({ id: `machine-${mode + 1}-${index + 1}`, format: "function-machine", blueprint: "simple-formula-machines", band: "expected", strand: "function_machines", mission, prompt: `Machine bay ${index + 1}: ${prompt}`, choices, answer, concrete: "input cards travel through two labelled operation boxes", visual: `input -> ${machine} -> output table`, symbolic: machine, hints: ["Complete the operation boxes from left to right, recording the interim value.", mode === 2 ? "To work backwards, undo the last operation first." : "Test a proposed rule against every given input-output pair."], explanation: `${String(answer)} is correct because the operations are applied in the displayed order, or reversed with inverse operations when the input is unknown.`, tag: mode === 1 ? "operation_order_swapped" : "partial_substitution", repair: "Use separate operation cards and an interim-value tray; for reverse problems, physically turn the arrows and swap each operation for its inverse." });
  });
}

function misconceptionCandidates(count) {
  const claims = [
    { key: "letter-label", claim: "In 3n, n just labels the number, so 3n means 3 + n.", answer: "Reject: 3n means 3 multiplied by the numerical value of n.", tag: "letter_as_label" },
    { key: "equals-answer", claim: "The equals sign means the calculation is finished and the answer comes next.", answer: "Reject: equals states that the expressions on both sides have the same value.", tag: "equals_means_answer" },
    { key: "partial", claim: "In 2a + a, substitute the value for only the first a.", answer: "Reject: the same letter in one expression has the same value, so substitute into every occurrence.", tag: "partial_substitution" },
    { key: "order", claim: "A machine that says ×3 then +4 is the same as +4 then ×3.", answer: "Reject: operation order can change the output; test one input through both routes.", tag: "operation_order_swapped" },
    { key: "one-pair", claim: "If one input-output pair fits a rule, the rule is proven.", answer: "Reject: test the rule against every given pair because different rules can match one example.", tag: "single_example_proves_rule" },
    { key: "single-solution", claim: "The equation a + b = 8 has only one non-negative whole-number solution pair.", answer: "Reject: enumerate systematically; several ordered or constrained pairs may satisfy the equation.", tag: "single_solution_assumption" },
    { key: "sequence", claim: "Every increasing sequence has one constant add-step.", answer: "Reject: compare all first differences; an increasing sequence can have changing differences.", tag: "assumes_constant_difference" },
    { key: "balance-one-side", claim: "To solve an equation, subtract from one side only because x is on that side.", answer: "Reject: use a balance-preserving equivalent move or reason from both complete side values.", tag: "one_sided_change" },
  ];
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 2) % missions.length];
    const item = claims[index % claims.length];
    const pairMode = index % 3 === 0;
    const format = pairMode ? "multiple_choice" : "symbol-build";
    const blueprint = pairMode ? "two-unknown-solution-pairs" : "algebra-readiness-retrieval";
    const band = pairMode ? "stretch" : "retrieval";
    return variant({ id: `misconception-${item.key}-${index + 1}`, format, blueprint, band, strand: "misconceptions", mission, prompt: `Code review ${index + 1}: a learner says, '${item.claim}' Which response repairs the reasoning?`, choices: [item.answer, "Accept the rule because it uses an algebra word.", "Say it is wrong without showing a representation or check.", "Replace every letter with its alphabet position."], answer: item.answer, concrete: "counterexample built with bags, counters or balance tiles", visual: "before/after misconception map and one checking example", symbolic: item.claim, hints: ["Test the claim with a small allowed value or a balance model.", "State a replacement rule that will also work on the next problem."], explanation: `${item.answer} The repair connects notation to quantity and includes a checkable strategy suitable for the transition into KS3 algebra.`, tag: item.tag, repair: "Choose a concrete model, table, balance or function-machine route, then teach back the corrected rule using one new value." });
  });
}

function variant({ id, format, blueprint, band, strand, mission, prompt, choices, answer, concrete, visual, symbolic, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const choiceSet = [...new Set(choices)];
  for (let offset = 1; choiceSet.length < 4; offset += 1) {
    const fallback = typeof answer === "number" ? answer + offset * 10 : `No valid value: distractor ${offset}`;
    if (!choiceSet.includes(fallback)) choiceSet.push(fallback);
  }
  const uniqueChoices = rotate(choiceSet, fullId.length % choiceSet.length);
  const richExplanation = `${explanation} The result remains linked to the defined quantities and can be checked in the original concrete, visual or symbolic representation.`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: uniqueChoices,
      algebra_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_represent_reason_check`,
      variant_blueprint_id: blueprint,
      review_batch: "depth-wave",
      concrete_visual_symbolic: { concrete, visual, symbolic, route_order: ["concrete", "visual", "symbolic"], any_route_may_be_revisited: true },
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, add_remove_buttons: true, undo_available: true },
      scaffold_options: { symbol_density_control: true, one_operation_stage_at_a_time: true, persistent_given_values: true, notation_read_aloud_script: true, worked_first_example: true, bar_balance_or_table_choice: true },
      colour_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      codebreaker_mission: {
        place: mission.place,
        objective: mission.goal,
        strategic_unlock: "represent the rule, test a value, then explain why the code remains true",
        reward: `add one ${mission.reward} to the shared decoding board`,
        loss_on_error: false,
        streak_pressure: false,
        retry_message: "That test exposed a useful code clue. Keep the representation, change one step, and test again when ready.",
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation: richExplanation,
    feedback: { correct: `Code segment verified. ${richExplanation}`, representation_feedback: "Credit a correct concrete, visual or symbolic representation independently from arithmetic accuracy.", calculation_repair: "Keep the rule fixed, locate the first incorrect substitution or operation, and repair only that stage.", check_prompt: "Substitute the result, compare both sides, or test another input before locking the code.", misconception_repair: repair },
    difficulty: { intro: 2, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "function-machine" ? "substitution-step-lock" : format === "equation-balance" ? "equation-balance-undo" : format === "multiple_choice" ? "solution-pair-tester" : "unknown-box-reveal",
  };
}

function buildFromCases(label, count, cases, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = cases[index % cases.length];
    const mission = missions[Math.floor(index / cases.length) % missions.length];
    return builder({ item, index, mission, id: `${label}-${item.key ?? index % cases.length}-${mission.key}` });
  });
}

function ensureBlueprints(currentPack) {
  const additions = [
    { id: "variables-and-unknowns", format: "multiple_choice", count: 260, difficulty_band: "intro", misconception_tag: "letter_as_label", purpose: "Distinguish a varying quantity from a fixed unknown in a stated context.", generation_pattern: "quantity context + letter role + variable/unknown explanation", review_notes: "Keep notation linked to named quantities and avoid alphabet-value tricks except as distractors.", source: "ai_drafted_teacher_reviewed" },
    { id: "sequence-rule-builds", format: "function-machine", count: 280, difficulty_band: "expected", misconception_tag: "term_value_as_position", purpose: "Continue, describe and test arithmetic sequence rules using position-value tables.", generation_pattern: "term cards + difference arrows + next-term or nth-term rule test", review_notes: "Include non-arithmetic sequences only to test whether differences are constant.", source: "ai_drafted_teacher_reviewed" },
    { id: "simple-formula-symbol-builds", format: "symbol-build", count: 280, difficulty_band: "expected", misconception_tag: "letter_as_label", purpose: "Construct simple formulae from repeated quantities and fixed adjustments.", generation_pattern: "concrete or pictorial structure + quantity labels + formula choices + second-value check", review_notes: "Use juxtaposition only with an explicit multiplication reading scaffold.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected four curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  for (const item of currentPack.question_variants) {
    if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}.`);
    ids.add(item.id);
    const signature = `${item.format}|${normalise(item.body?.prompt)}|${normalise(item.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${item.id}.`);
    signatures.add(signature);
  }
  for (const item of currentPack.question_variants.filter((variant) => variant.format === "equation-balance")) validateBuilderContract(item);
  for (const item of generated) {
    const blueprint = blueprints.get(item.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== item.format || blueprint.difficulty_band !== item.body.difficulty_band) throw new Error(`${item.id} does not match its blueprint format and band.`);
    if (!formats.has(item.format) || item.status !== "review") throw new Error(`${item.id} has unsupported format or status.`);
    const routes = item.body.concrete_visual_symbolic;
    if (!routes?.concrete || !routes?.visual || !routes?.symbolic || routes.route_order?.join("|") !== "concrete|visual|symbolic") throw new Error(`${item.id} lacks concrete/visual/symbolic scaffolds.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.scaffold_options?.symbol_density_control || !item.body.scaffold_options?.one_operation_stage_at_a_time || !item.body.scaffold_options?.persistent_given_values || !item.body.scaffold_options?.bar_balance_or_table_choice) throw new Error(`${item.id} lacks SEND scaffolds.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.codebreaker_mission?.loss_on_error !== false || item.body.codebreaker_mission?.streak_pressure !== false || !item.body.codebreaker_mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable codebreaker gamification.`);
    if (!item.feedback?.correct || !item.feedback?.representation_feedback || !item.feedback?.calculation_repair || !item.feedback?.check_prompt || !item.feedback?.misconception_repair || item.hints.length < 2 || item.explanation.length < 90) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.algebra_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["variables", "unknowns", "sequences", "simple_formulae", "substitution", "equivalence", "function_machines", "misconceptions"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function enrichVariant(variant) {
  if (variant.format !== "equation-balance") return variant;
  const body = variant.body ?? {};
  const authoredExpressions = body.left_expression !== undefined && body.right_expression !== undefined;
  return {
    ...variant,
    body: {
      ...body,
      builder_contract: {
        kind: "equation_balance",
        mode: authoredExpressions ? "explicit_sides" : "symbolic_source",
        left_expression_key: authoredExpressions ? "left_expression" : null,
        right_expression_key: authoredExpressions ? "right_expression" : null,
        symbolic_source: authoredExpressions ? null : "concrete_visual_symbolic.symbolic",
        preserve_equivalence: true,
        allowed_operations: ["add", "subtract", "multiply", "divide"],
        drag_required: false,
        response_modes: ["tap", "keyboard", "switch", "eye_gaze", "aac"],
      },
    },
  };
}

function validateBuilderContract(variant) {
  const body = variant.body ?? {};
  const contract = body.builder_contract;
  const requiredResponseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  if (!contract || contract.kind !== "equation_balance" || contract.preserve_equivalence !== true || contract.drag_required !== false || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) {
    throw new Error(`${variant.id} lacks a complete accessible equation-balance contract.`);
  }
  if (contract.mode === "explicit_sides") {
    if (!body[contract.left_expression_key] || !body[contract.right_expression_key]) throw new Error(`${variant.id} lacks explicit balance sides.`);
  } else if (contract.mode === "symbolic_source") {
    if (!body.concrete_visual_symbolic?.symbolic) throw new Error(`${variant.id} lacks its symbolic balance source.`);
  } else {
    throw new Error(`${variant.id} has an unknown equation-balance mode.`);
  }
  if (JSON.stringify(contract.allowed_operations) !== JSON.stringify(["add", "subtract", "multiply", "divide"])) throw new Error(`${variant.id} has incomplete equivalence operations.`);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
