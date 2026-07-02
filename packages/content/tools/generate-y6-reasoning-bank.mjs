#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y6-reasoning.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y6-reasoning-bank-";
const pilotTarget = 240;
const reviewBatch = "y6-reasoning-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y6-reasoning") throw new Error("This generator only supports the Year 6 reasoning pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const candidates = [
  ...Array.from({ length: 47 }, (_, index) => buildAnswerReason(index)),
  ...Array.from({ length: 47 }, (_, index) => buildAlwaysSometimesNever(index)),
  ...Array.from({ length: 47 }, (_, index) => buildCounterexample(index)),
  ...Array.from({ length: 47 }, (_, index) => buildProofCritique(index)),
  ...Array.from({ length: 47 }, (_, index) => buildRetrieval(index)),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 6 reasoning pilot reaches 240 variants with five curated questions preserved semantically unchanged and 235 deterministic review candidates. All five declared interaction formats are used across answer-reason matching, domain-explicit always/sometimes/never claims, counterexamples, reason chains, proof-strength critique and retrieval. Number, fractions, ratio, geometry and algebra are interleaved within Year 6 scope. Generated items distinguish examples from proof, validate counterexamples, require precise domains and repair plausible but weak explanations. Reduced-card, sentence-stem, dyscalculia/SEND, colour-independent static and alternative-input routes support pressure-free claim-lab missions. Selected narration references require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent mathematics, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates, curatedSnapshot);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`reasoning-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`reasoning-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`reasoning-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`reasoning-bank domains=${summary(candidates, (variant) => variant.body.maths_domain)}`);
console.log(`reasoning-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`reasoning-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 reasoning bank is out of date; run generate-y6-reasoning-bank.mjs --write.");
  console.log("reasoning-bank deterministic check passed");
} else {
  console.log("reasoning-bank dry-run; pass --write to update the pack");
}

function buildAnswerReason(index) {
  const family = index % 5;
  const round = Math.floor(index / 5);
  let domain;
  let prompt;
  let answer;
  let wrong;
  let check;
  if (family === 0) {
    const number = 1200 + round * 111 + ((3 - ((1200 + round * 111) % 3)) % 3);
    const digitSum = String(number).split("").reduce((sum, digit) => sum + Number(digit), 0);
    domain = "number";
    prompt = `Which answer-reason pair correctly decides whether ${number} is divisible by 3?`;
    answer = `${number} is divisible by 3 because its digit sum is ${digitSum}, a multiple of 3.`;
    wrong = [`${number} is divisible by 3 because it has four digits.`, `${number} is not divisible by 3 because it does not end in 3.`, `${number} is divisible by 3 because it is greater than 3.`];
    check = { type: "divisibility_3", number, digitSum, expected: answer };
  } else if (family === 1) {
    const k = 2 + round % 7;
    domain = "fractions";
    prompt = `Which reason proves that ${k}/${k + 1} is greater than ${k - 1}/${k}?`;
    answer = `${k}/${k + 1} is greater because ${k} × ${k} = ${k * k}, while ${k - 1} × ${k + 1} = ${(k - 1) * (k + 1)}.`;
    wrong = [`It is greater because ${k + 1} is a larger denominator.`, `It is greater because both fractions are less than 1.`, `The fractions are equal because their numerators differ by 1.`];
    check = { type: "fraction_cross_product", left: [k, k + 1], right: [k - 1, k], expected: answer };
  } else if (family === 2) {
    const a = 2 + round % 8;
    const b = a + 3;
    const scale = 2 + round % 5;
    domain = "ratio";
    prompt = `Which reason proves that ${a}:${b} and ${a * scale}:${b * scale} are equivalent ratios?`;
    answer = `Both parts of ${a}:${b} are multiplied by the same factor ${scale}, giving ${a * scale}:${b * scale}.`;
    wrong = [`Only the first part was checked, so the ratios must be equivalent.`, `The parts differ by ${b - a}, so every ratio with that difference is equivalent.`, `Both ratios contain even numbers, which proves equivalence.`];
    check = { type: "ratio_scale", a, b, scale, expected: answer };
  } else if (family === 3) {
    const length = 4 + round % 8;
    const width = 3 + (round * 2) % 6;
    domain = "geometry";
    prompt = `Which answer-reason pair gives the perimeter of a ${length} cm by ${width} cm rectangle?`;
    answer = `${2 * (length + width)} cm, because perimeter is ${length} + ${width} + ${length} + ${width}.`;
    wrong = [`${length * width} cm, because perimeter is length × width.`, `${length + width} cm, because only two sides count.`, `${2 * length + width} cm, because one width is hidden.`];
    check = { type: "rectangle_perimeter", length, width, expected: answer };
  } else {
    const n = 2 + round % 9;
    const coefficient = 3 + round % 5;
    const constant = 2 + (round * 2) % 7;
    domain = "algebra";
    prompt = `Which reason correctly evaluates ${coefficient}n + ${constant} when n = ${n}?`;
    answer = `${coefficient * n + constant}, because ${coefficient} × ${n} + ${constant} = ${coefficient * n} + ${constant}.`;
    wrong = [`${coefficient * (n + constant)}, because n and ${constant} must be added first.`, `${coefficient + n + constant}, because the coefficient is added to n.`, `${coefficient * n}, because constants can be ignored.`];
    check = { type: "substitution", n, coefficient, constant, expected: answer };
  }
  return candidate({ index, family: `answer-${family}`, format: "reason-chain", blueprint: "answer-reason-matches", band: index < 15 ? "developing" : "expected", domain, prompt: `Answer-reason chain ${index + 1}: ${prompt}`, domainStatement: domainDescription(domain), choices: [answer, ...wrong], answer, check, hints: ["Check the answer and every sentence of its reason separately.", "Use a because-therefore chain that names the relevant relationship, not just the calculation result."], explanation: `${answer} The reason supplies the mathematical relationship that makes the answer necessary, rather than merely repeating it.`, tag: "answer_without_reason", repair: "Use ANSWER / BECAUSE / THEREFORE cards, verify one equality or property at a time and keep the original question visible." });
}

function buildAlwaysSometimesNever(index) {
  const family = index % 10;
  const cases = [
    { domain: "integers", claim: "The sum of two even integers is even.", answer: "Always true", reason: "Write the integers as 2a and 2b: their sum is 2(a + b), so it is even.", key: "even_plus_even" },
    { domain: "integers", claim: "The sum of two odd integers is odd.", answer: "Never true", reason: "(2a + 1) + (2b + 1) = 2(a + b + 1), which is even.", key: "odd_plus_odd_odd" },
    { domain: "integers including zero", claim: "The product of two integers is positive.", answer: "Sometimes true", reason: "It is positive for two non-zero integers with the same sign, but can be zero or negative in other cases.", key: "integer_product_positive" },
    { domain: "positive fractions with the same numerator", claim: "The fraction with the larger denominator is smaller.", answer: "Always true", reason: "The same numerator counts equal numbers of parts; dividing the whole into more equal parts makes each part smaller.", key: "same_numerator" },
    { domain: "rectangles with whole-number side lengths", claim: "Rectangles with the same area have the same perimeter.", answer: "Sometimes true", reason: "Some congruent or side-swapped rectangles do, but 3 × 4 and 2 × 6 both have area 12 and have different perimeters.", key: "area_perimeter" },
    { domain: "triangles drawn in the Euclidean plane", claim: "The interior angles total 180°.", answer: "Always true", reason: "A line through one vertex parallel to the opposite side links the three angles to a straight angle of 180°.", key: "triangle_sum" },
    { domain: "integers", claim: "n + n is even.", answer: "Always true", reason: "n + n = 2n, which is a multiple of 2 for every integer n.", key: "double_even" },
    { domain: "integers", claim: "n² is greater than n.", answer: "Sometimes true", reason: "It is true for n = 2, equal for n = 0 or 1, and behaves differently for other integers.", key: "square_greater" },
    { domain: "ratios with positive whole-number parts", claim: "Multiplying both parts by the same positive whole number gives an equivalent ratio.", answer: "Always true", reason: "Both quantities are scaled by the same factor, so their multiplicative relationship is unchanged.", key: "ratio_equivalent" },
    { domain: "prime whole numbers", claim: "A prime number is odd.", answer: "Sometimes true", reason: "Every prime except 2 is odd; 2 is an even prime.", key: "prime_odd" },
  ];
  const item = cases[family];
  const answer = `${item.answer} — ${item.reason}`;
  return candidate({ index, family: `claim-${family}`, format: "claim-tester", blueprint: "always-sometimes-never-claims", band: family < 4 ? "expected" : "secure", domain: domainGroup(item.domain), prompt: `Claim laboratory ${index + 1}: within the stated domain, classify “${item.claim}”`, domainStatement: item.domain, choices: [answer, `Always true — one successful example proves every case.`, `Never true — no cases need to be tested.`, `Not enough information — mathematical domains cannot be stated.`], answer, check: { type: "classification", key: item.key, classification: item.answer, expected: answer }, hints: ["Read the domain before testing the claim.", "For always, seek a general reason; for sometimes, provide a true and false case; for never, explain why no case works."], explanation: `${answer} The classification and explanation both depend on the explicitly stated domain.`, tag: "pattern_as_rule", repair: "Show DOMAIN / TRUE CASE / FALSE CASE / GENERAL REASON slots, with sentence stems for always, sometimes and never." });
}

function buildCounterexample(index) {
  const family = index % 9;
  const round = Math.floor(index / 9);
  let domain;
  let claim;
  let answer;
  let wrong;
  let key;
  let parameters = {};
  if (family === 0) {
    const m = 2 + round % 7;
    answer = String(m * 3);
    claim = `Every multiple of ${m} is also a multiple of ${2 * m}.`;
    wrong = [String(m * 2), String(m * 4), String(m * 6)];
    domain = "positive whole numbers"; key = "multiple_double"; parameters = { m };
  } else if (family === 1) {
    answer = "3 × 1/2 = 3/2, which is smaller than 3";
    claim = "Multiplying a positive number by a positive fraction always makes it larger.";
    wrong = ["3 × 2 = 6", "1 × 3 = 3", "2 × 2 = 4"];
    domain = "positive numbers and positive fractions"; key = "fraction_multiplier";
  } else if (family === 2) {
    answer = "3/10 has a larger numerator than 2/3 but is smaller";
    claim = "The fraction with the larger numerator is always larger.";
    wrong = ["3/4 is greater than 2/4", "5/8 is greater than 3/8", "7/10 is greater than 6/10"];
    domain = "positive proper fractions"; key = "numerator_only";
  } else if (family === 3) {
    const area = 12 + round * 12;
    const pairA = [3, area / 3];
    const pairB = [2, area / 2];
    answer = `${pairA[0]} × ${pairA[1]} and ${pairB[0]} × ${pairB[1]} have area ${area} but perimeters ${2 * (pairA[0] + pairA[1])} and ${2 * (pairB[0] + pairB[1])}`;
    claim = "Rectangles with the same area always have the same perimeter.";
    wrong = [`${pairA[0]} × ${pairA[1]} and ${pairA[1]} × ${pairA[0]}`, "Two identical rectangles", "One rectangle checked twice"];
    domain = "rectangles with positive whole-number side lengths"; key = "same_area"; parameters = { area, pairA, pairB };
  } else if (family === 4) {
    answer = "2 is prime and even";
    claim = "Every prime whole number is odd.";
    wrong = ["3 is prime and odd", "5 is prime and odd", "7 is prime and odd"];
    domain = "prime whole numbers"; key = "even_prime";
  } else if (family === 5) {
    answer = "18 is divisible by 6 but not by 12";
    claim = "Every multiple of 6 is a multiple of 12.";
    wrong = ["12 is a multiple of both", "24 is a multiple of both", "36 is a multiple of both"];
    domain = "positive whole numbers"; key = "multiple_6_12";
  } else if (family === 6) {
    answer = "2:3 becomes 3:4 after adding 1 to both parts, but 2/3 ≠ 3/4";
    claim = "Adding the same positive number to both parts always makes an equivalent ratio.";
    wrong = ["2:3 becomes 4:6 by multiplying both parts by 2", "3:5 becomes 6:10 by scaling", "1:4 becomes 3:12 by scaling"];
    domain = "ratios with positive parts"; key = "ratio_add";
  } else if (family === 7) {
    answer = "a = -1 and b = -2: a > b, but a² = 1 < 4 = b²";
    claim = "If integer a > integer b, then a² > b².";
    wrong = ["a = 3 and b = 2", "a = 5 and b = 1", "a = 2 and b = 0"];
    domain = "integers"; key = "square_order";
  } else {
    answer = "2 × 8 and 4 × 4 both have perimeter 20 but areas 16 and 16—this does not break the claim";
    claim = "Rectangles with the same perimeter always have the same area.";
    answer = "1 × 9 and 4 × 6 both have perimeter 20 but areas 9 and 24";
    wrong = ["2 × 8 and 4 × 4 both have perimeter 20 but both have area 16", "Two 3 × 5 rectangles", "One square measured twice"];
    domain = "rectangles with positive whole-number side lengths"; key = "same_perimeter";
  }
  return candidate({ index, family: `counter-${family}`, format: "counterexample-hunt", blueprint: "counterexample-hunts", band: family < 3 ? "expected" : "secure", domain: domainGroup(domain), prompt: `Counterexample hunt ${index + 1}: in the domain ${domain}, disprove “${claim}”`, domainStatement: domain, choices: [answer, ...wrong], answer, check: { type: "counterexample", key, parameters, expected: answer }, hints: ["The counterexample must satisfy the claim's starting condition.", "It must then make the claimed conclusion fail; a supporting example does not disprove an always claim."], explanation: `${answer}. This one valid case satisfies the starting condition and breaks the conclusion, so it disproves the always claim.`, tag: "one_example_as_proof", repair: "Use CONDITION GATE / CONCLUSION GATE cards and accept a tile only when it passes the first gate but fails the second." });
}

function buildProofCritique(index) {
  const family = index % 8;
  const round = Math.floor(index / 8);
  const cases = [
    { domain: "number", claim: "The sum of two even integers is even.", evidence: "Let the numbers be 2a and 2b. Their sum is 2(a + b), a multiple of 2.", answer: "Proves the claim", key: "parity_general" },
    { domain: "fractions", claim: "Multiplying a positive fraction by 2 makes it larger.", evidence: `${round + 2}/${round + 5} × 2 was larger in one tested case.`, answer: "Supports but does not prove", key: "one_fraction_example" },
    { domain: "geometry", claim: "Rectangles with area 12 always have perimeter 14.", evidence: "A 2 × 6 rectangle has area 12 and perimeter 16.", answer: "Disproves the claim", key: "rectangle_counter" },
    { domain: "algebra", claim: "2(n + 3) = 2n + 6 for every number n.", evidence: "The distributive law multiplies both n and 3 by 2, giving 2n + 6.", answer: "Proves the claim", key: "distribution" },
    { domain: "ratio", claim: "2:3 and 4:6 are equivalent.", evidence: "Both parts were multiplied by 2.", answer: "Proves the claim", key: "ratio_scale_proof" },
    { domain: "number", claim: "Every multiple of 5 is odd.", evidence: "15 and 25 are odd multiples of 5.", answer: "Supports but does not prove", key: "support_not_proof" },
    { domain: "geometry", claim: "The marked angle is exactly 60°.", evidence: "It looks like 60° in a diagram explicitly labelled not to scale.", answer: "Insufficient or flawed evidence", key: "not_to_scale" },
    { domain: "algebra", claim: "Dividing both sides of 0 × n = 0 by 0 proves every n equals 1.", evidence: "The explanation divides by zero.", answer: "Insufficient or flawed evidence", key: "divide_zero" },
  ];
  const item = cases[family];
  return candidate({ index, family: `proof-${family}`, format: "proof-sort", blueprint: "proof-sort-critiques", band: family < 2 ? "expected" : "stretch", domain: item.domain, prompt: `Proof-strength desk ${index + 1}: Claim—${item.claim} Explanation—${item.evidence} How strong is it?`, domainStatement: domainDescription(item.domain), choices: [item.answer, ...["Proves the claim", "Supports but does not prove", "Disproves the claim", "Insufficient or flawed evidence"].filter((value) => value !== item.answer)], answer: item.answer, check: { type: "proof_critique", key: item.key, expected: item.answer }, hints: ["Check each equality, condition and inference before judging fluency.", "One successful example supports; a general reason may prove; one valid counterexample disproves; a broken step is insufficient."], explanation: `${item.answer}. The evidence is judged by whether it covers the stated domain, breaks the claim with a valid case, or contains an unchecked step.`, tag: "unchecked_plausible_explanation", repair: "Reveal one sentence at a time and label it VALID, EXAMPLE ONLY, COUNTEREXAMPLE or BROKEN STEP before choosing proof strength." });
}

function buildRetrieval(index) {
  const family = index % 10;
  const cases = [
    { domain: "number", prompt: "Which statement describes a counterexample?", answer: "A case that meets a claim's condition but makes its conclusion false", wrong: ["Any example where the claim works", "A repeated calculation", "A guess outside the domain"], key: "counter_definition" },
    { domain: "fractions", prompt: "A pupil tests one pair and says all fractions with larger numerators are larger. What is the strongest repair?", answer: "State denominator conditions or use a counterexample such as 3/10 < 2/3", wrong: ["Test the same pair again", "Remove the denominators", "Call the pattern a proof"], key: "fraction_condition" },
    { domain: "ratio", prompt: "Which change guarantees an equivalent ratio with positive parts?", answer: "Multiply or divide both parts by the same non-zero factor", wrong: ["Add the same number to both parts", "Change one part only", "Swap one part with an unrelated number"], key: "ratio_rule" },
    { domain: "geometry", prompt: "A diagram is not to scale. Which evidence can prove an angle value?", answer: "Given angle labels and valid angle relationships", wrong: ["How wide it looks", "The colour of the arc", "One person's estimate alone"], key: "geometry_evidence" },
    { domain: "algebra", prompt: "Which is a general reason that n + n is even for integer n?", answer: "n + n = 2n, a multiple of 2", wrong: ["It worked for n = 4", "Most examples look even", "n has one letter"], key: "algebra_general" },
    { domain: "number", prompt: "What does one successful example do for an always claim?", answer: "It supports the claim but does not prove every case", wrong: ["It proves the claim", "It disproves the claim", "It removes the need for a domain"], key: "example_strength" },
    { domain: "fractions", prompt: "Which language is precise when comparing 5/8 and 3/4?", answer: "5/8 = 10/16 and 3/4 = 12/16, therefore 5/8 < 3/4", wrong: ["3 is smaller than 5 so 3/4 is smaller", "Eighths sound bigger", "They are nearly equal so they are equal"], key: "fraction_precision" },
    { domain: "geometry", prompt: "Which pair disproves 'same area means same perimeter'?", answer: "3 × 4 and 2 × 6 rectangles", wrong: ["3 × 4 and 4 × 3", "Two 5 × 5 squares", "One rectangle drawn twice"], key: "geometry_counter" },
    { domain: "algebra", prompt: "Why is testing n = 1 not proof that 3(n + 2) = 3n + 6 for all n?", answer: "It checks one value; the distributive law supplies the general reason", wrong: ["One value always proves an identity", "Letters cannot be tested", "The equality is false"], key: "identity_proof" },
    { domain: "ratio", prompt: "Evidence is missing the domain and checks one case. Which category fits?", answer: "Insufficient or flawed evidence", wrong: ["Proves the claim", "Disproves every possible claim", "Always true"], key: "insufficient" },
  ];
  const item = cases[family];
  return candidate({ index, family: `retrieval-${family}`, format: "multiple_choice", blueprint: "reasoning-retrieval", band: index % 5 === 0 ? "retrieval" : "developing", domain: item.domain, prompt: `Reasoning retrieval ${index + 1}: ${item.prompt}`, domainStatement: domainDescription(item.domain), choices: [item.answer, ...item.wrong], answer: item.answer, check: { type: "retrieval", key: item.key, expected: item.answer }, hints: ["Name whether the task needs an example, counterexample, general reason or evidence critique.", "Use the stated domain and precise because-therefore language."], explanation: `${item.answer}. This choice uses the correct reasoning standard rather than treating a plausible example as a proof.`, tag: family === 5 || family === 8 ? "one_example_as_proof" : "reasoning_language_imprecision", repair: "Use a reduced four-card board labelled EXAMPLE / COUNTEREXAMPLE / GENERAL REASON / INSUFFICIENT and complete one sentence stem." });
}

function candidate({ index, family, format, blueprint, band, domain, prompt, domainStatement, choices, answer, check, hints, explanation, tag, repair }) {
  const id = `${prefix}${blueprint}-${String(index + 1).padStart(3, "0")}-${family}`;
  const rotatedChoices = rotate([...new Set(choices)], index % choices.length);
  const fullExplanation = explanation.length >= 100 ? explanation : `${explanation} The stated domain and evidence standard remain explicit.`;
  const audio = index % 18 === 0 ? { audio_optional: true, audio_asset_id: `narration-${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true } : { audio_required: false };
  return {
    id,
    format,
    body: {
      prompt,
      choices: rotatedChoices,
      domain: domainStatement,
      maths_domain: domain,
      integrity: check,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_claim_test_justify`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_or_adult_scribed_choice",
      supported_interaction: "Select claims, examples, chain positions or proof-strength labels by touch, keyboard, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult scribing; numbered positions replace fine dragging and speech or handwriting is optional.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_scribed: true, fine_drag_required: false, handwriting_required: false, speech_required: false },
      send_support: { reduced_card_count_option: true, one_reasoning_step_at_a_time: true, because_therefore_stems: true, persistent_claim_and_domain: true, glossary_popovers: true, correct_chain_links_preserved: true },
      dyscalculia_support: { concrete_or_diagram_option: true, calculation_check_table: true, symbols_read_in_words: true, examples_and_general_rule_separated: true },
      reduced_visual_load: true,
      colour_independent_markers: true,
      static_route_available: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "test one claim in the calm proof laboratory", reward: "a proof-chain link for precise evidence", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That test gives the lab useful evidence. Keep valid chain links, open one domain clue and revise without losing progress." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The domain and mathematical evidence support the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Check the claim's condition, domain and conclusion, then label the evidence as example, counterexample, general reason or insufficient. Accepted response: ${answer}`,
      misconception_check: tag,
      check_prompt: format === "counterexample-hunt" ? "Does the case satisfy the starting condition and make the conclusion fail?" : format === "proof-sort" ? "Does the reasoning cover the whole domain, check one case, break the claim, or contain a faulty step?" : "Which exact mathematical relationship makes the conclusion follow?",
      support_message: "Use reduced cards, diagrams, sentence stems and static colour-independent routes. Respond by touch, keyboard, switch, eye gaze, AAC/pointing or adult scribing; no timer, speech, handwriting or fine drag is required.",
      retry: "Valid examples and chain links remain visible. Use one domain or evidence clue, then retry without penalty.",
    },
    difficulty: { developing: 4, expected: 6, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "reason-chain" ? "answer-reason-lock" : format === "claim-tester" ? "claim-tester-gates" : format === "counterexample-hunt" ? "counterexample-gate-break" : format === "proof-sort" ? "proof-strength-meter" : "reasoning-retrieval-card",
  };
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 5 || JSON.stringify(currentPack.question_variants.slice(0, 5)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 235 || currentPack.question_variants.length !== pilotTarget) throw new Error("Expected 235 generated and 240 total variants.");
  const blueprintMap = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const declaredFormats = new Set(currentPack.practice.formats);
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
    const retrievalException = blueprint?.id === "reasoning-retrieval" && variant.format === "multiple_choice";
    if (!blueprint || (!retrievalException && blueprint.format !== variant.format) || !declaredFormats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateMaths(variant);
    if (!variant.body.domain || !variant.body.maths_domain) throw new Error(`${variant.id} lacks an explicit domain.`);
    if (variant.body.choices.length !== 4 || !variant.body.choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} has an invalid answer set.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.touch || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_scribed || route.fine_drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
    if (!variant.body.send_support?.reduced_card_count_option || !variant.body.send_support?.because_therefore_stems || variant.body.reduced_visual_load !== true || variant.body.colour_independent_markers !== true || variant.body.static_route_available !== true) throw new Error(`${variant.id} lacks SEND/static support.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true)) throw new Error(`${variant.id} has unreviewed audio metadata.`);
  }
  for (const format of currentPack.practice.formats) if (!generated.some((variant) => variant.format === format)) throw new Error(`Declared format ${format} is unused.`);
  for (const blueprint of currentPack.variant_blueprints) {
    const count = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint.id).length;
    if (count !== 47) throw new Error(`${blueprint.id} expected 47 generated variants, found ${count}.`);
  }
}

function validateMaths(variant) {
  const i = variant.body.integrity;
  if (i.expected !== variant.expected_answer.value) throw new Error(`${variant.id} changed its canonical answer.`);
  if (i.type === "divisibility_3") {
    const sum = String(i.number).split("").reduce((total, digit) => total + Number(digit), 0);
    if (sum !== i.digitSum || i.number % 3 !== 0 || i.digitSum % 3 !== 0) throw new Error(`${variant.id} has invalid divisibility reasoning.`);
  } else if (i.type === "fraction_cross_product") {
    if (i.left[0] * i.right[1] <= i.right[0] * i.left[1]) throw new Error(`${variant.id} has an invalid fraction comparison.`);
  } else if (i.type === "ratio_scale") {
    if (i.a * i.scale <= 0 || i.b * i.scale <= 0) throw new Error(`${variant.id} has invalid ratio scaling.`);
  } else if (i.type === "rectangle_perimeter") {
    if (!i.expected.startsWith(String(2 * (i.length + i.width)))) throw new Error(`${variant.id} has invalid perimeter reasoning.`);
  } else if (i.type === "substitution") {
    if (!i.expected.startsWith(String(i.coefficient * i.n + i.constant))) throw new Error(`${variant.id} has invalid substitution.`);
  } else if (i.type === "classification") {
    const expected = { even_plus_even: "Always true", odd_plus_odd_odd: "Never true", integer_product_positive: "Sometimes true", same_numerator: "Always true", area_perimeter: "Sometimes true", triangle_sum: "Always true", double_even: "Always true", square_greater: "Sometimes true", ratio_equivalent: "Always true", prime_odd: "Sometimes true" }[i.key];
    if (i.classification !== expected || !i.expected.startsWith(expected)) throw new Error(`${variant.id} has an invalid classification.`);
  } else if (i.type === "counterexample") {
    if (!validCounterexample(i)) throw new Error(`${variant.id} has an invalid counterexample.`);
  } else if (i.type === "proof_critique") {
    const expected = { parity_general: "Proves the claim", one_fraction_example: "Supports but does not prove", rectangle_counter: "Disproves the claim", distribution: "Proves the claim", ratio_scale_proof: "Proves the claim", support_not_proof: "Supports but does not prove", not_to_scale: "Insufficient or flawed evidence", divide_zero: "Insufficient or flawed evidence" }[i.key];
    if (i.expected !== expected) throw new Error(`${variant.id} has an invalid proof-strength judgement.`);
  } else if (i.type === "retrieval") {
    const known = ["counter_definition", "fraction_condition", "ratio_rule", "geometry_evidence", "algebra_general", "example_strength", "fraction_precision", "geometry_counter", "identity_proof", "insufficient"];
    if (!known.includes(i.key)) throw new Error(`${variant.id} has an unknown retrieval rule.`);
  } else throw new Error(`${variant.id} has unknown maths integrity type ${i.type}.`);
}

function validCounterexample(i) {
  if (i.key === "multiple_double") { const n = Number(i.expected); return n % i.parameters.m === 0 && n % (2 * i.parameters.m) !== 0; }
  if (i.key === "fraction_multiplier") return 3 * 0.5 < 3;
  if (i.key === "numerator_only") return 3 > 2 && 3 / 10 < 2 / 3;
  if (i.key === "same_area") { const { pairA, pairB } = i.parameters; return pairA[0] * pairA[1] === pairB[0] * pairB[1] && 2 * (pairA[0] + pairA[1]) !== 2 * (pairB[0] + pairB[1]); }
  if (i.key === "even_prime") return true;
  if (i.key === "multiple_6_12") return 18 % 6 === 0 && 18 % 12 !== 0;
  if (i.key === "ratio_add") return 2 / 3 !== 3 / 4;
  if (i.key === "square_order") return -1 > -2 && (-1) ** 2 < (-2) ** 2;
  if (i.key === "same_perimeter") return 2 * (1 + 9) === 2 * (4 + 6) && 1 * 9 !== 4 * 6;
  return false;
}

function domainGroup(value) {
  if (/fraction/.test(value)) return "fractions";
  if (/ratio/.test(value)) return "ratio";
  if (/rectangle|triangle|angle/.test(value)) return "geometry";
  if (/integer n|a >|n²/.test(value)) return "algebra";
  return "number";
}
function domainDescription(domain) { return { number: "whole numbers or integers as stated in the prompt", fractions: "positive Year 6 fractions under the stated conditions", ratio: "positive ratio parts and stated scale factors", geometry: "Year 6 Euclidean geometry with stated measurements", algebra: "integers and Year 6 expressions under the stated conditions" }[domain]; }
function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
