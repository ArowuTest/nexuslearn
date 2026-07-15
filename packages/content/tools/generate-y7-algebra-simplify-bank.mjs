#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y7-algebra-simplify-expressions.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y7-algebra-simplify-bank-";
const pilotTarget = 220;
const reviewBatch = "y7-algebra-depth-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y7-algebra-simplify-expressions") throw new Error("This generator only supports the Year 7 simplifying-expressions pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const routes = [
  { key: "tiles", label: "Algebra-tile lab", representation: "labelled positive and negative algebra tiles with a text inventory" },
  { key: "trays", label: "Term-family trays", representation: "patterned family trays and signed coefficient counters" },
  { key: "table", label: "Value-table console", representation: "input-output table beside the symbolic expression" },
  { key: "static", label: "Static puzzle cards", representation: "large-print numbered cards with no movement required" },
];

const explanationCases = [
  { key: "x-x2", prompt: "Why can 4x and 3x^2 not be collected?", answer: "They are unlike terms because x and x^2 have different variable parts.", choices: ["They are unlike terms because x and x^2 have different variable parts.", "Their coefficients add to 7, so they make 7x^2.", "Every term containing x is automatically like.", "The power 2 can be added to the coefficient 4."], explanation: "Like terms must have exactly the same variable part, including powers. Here x and x^2 represent different term families, so adding the coefficients would change the expression's value.", tag: "unlike_terms_combined", strand: "variables_terms_coefficients" },
  { key: "x-y", prompt: "Why can 2x and 5y not be collected?", answer: "The variables differ, so the terms are unlike even though both have coefficients.", choices: ["The variables differ, so the terms are unlike even though both have coefficients.", "Both contain letters, so they make 7xy.", "The coefficient 2 changes x into y.", "Only negative terms can be unlike."], explanation: "The variable part of 2x is x and the variable part of 5y is y. Coefficients count copies of their own variable unit, so two x-units cannot be merged with five y-units.", tag: "different_variables_combined", strand: "variables_terms_coefficients" },
  { key: "constant-x", prompt: "Why does 6 + 2x not simplify to 8x?", answer: "Six is a constant term and 2x is an x term, so their variable parts do not match.", choices: ["Six is a constant term and 2x is an x term, so their variable parts do not match.", "The 6 becomes a coefficient whenever x is nearby.", "Addition signs make all terms like.", "2x means 2 + x, so all three numbers add."], explanation: "A constant has no variable part, whereas 2x means two lots of x. Combining them as 8x would incorrectly turn six fixed units into six extra x-units.", tag: "constant_combined_with_variable", strand: "coefficient_meaning" },
  { key: "negative-like", prompt: "Why can -3x and 8x be collected to make 5x?", answer: "They have the same variable part, and their signed coefficients combine as -3 + 8 = 5.", choices: ["They have the same variable part, and their signed coefficients combine as -3 + 8 = 5.", "The negative sign disappears before the coefficients combine.", "Only the larger coefficient is kept.", "x and -x are different variables."], explanation: "Both terms are multiples of the same x-unit. Keeping the sign attached gives negative three x-units plus eight x-units, leaving five x-units.", tag: "lost_negative_sign", strand: "collecting_like_terms" },
  { key: "xy-x", prompt: "Why are 4xy and 3x unlike terms?", answer: "The first variable part is xy and the second is x, so one includes an extra factor of y.", choices: ["The first variable part is xy and the second is x, so one includes an extra factor of y.", "Both begin with x, so they make 7xy.", "The y can be ignored because its coefficient is hidden.", "Multiplication signs make variables interchangeable."], explanation: "For terms to be like, every variable and power in the variable part must match. The factor y in xy changes the family, even though both terms contain x.", tag: "partial_variable_match", strand: "variables_terms_coefficients" },
  { key: "implicit-one", prompt: "Why does x + x + x simplify to 3x?", answer: "Each x has an implicit coefficient of 1, so 1 + 1 + 1 gives coefficient 3.", choices: ["Each x has an implicit coefficient of 1, so 1 + 1 + 1 gives coefficient 3.", "Three variables multiply to x^3.", "The plus signs become a coefficient.", "A missing coefficient means zero."], explanation: "A written x means one x-unit. Addition collects the three matching units, so the coefficient becomes three; this is not multiplication and does not create x^3.", tag: "implicit_coefficient_zero", strand: "coefficient_meaning" },
  { key: "distribution", prompt: "Why is 2(x + 3) equivalent to 2x + 6?", answer: "The factor 2 multiplies both terms inside the brackets: 2 times x and 2 times 3.", choices: ["The factor 2 multiplies both terms inside the brackets: 2 times x and 2 times 3.", "The 2 multiplies x but the 3 stays unchanged.", "The brackets mean add 2 to every term.", "2x + 6 is equivalent only when x = 3."], explanation: "The distributive law applies the outside factor to every term in the sum. An area model shows two equal groups, each containing one x-unit and three constant units.", tag: "distribution_one_term_only", strand: "distributive_reasoning" },
  { key: "within-expression", prompt: "In 3x + 2 + 5x, why can only 3x and 5x be collected?", answer: "The x terms share variable part x; the constant 2 belongs to a different family.", choices: ["The x terms share variable part x; the constant 2 belongs to a different family.", "The terms beside plus signs all become 10x.", "The constant 2 becomes 2x after reordering.", "Only adjacent terms can be collected."], explanation: "Reordering can place like terms together because addition is commutative, but it cannot change a constant into an x term. The equivalent simplification is 8x + 2.", tag: "constant_combined_with_variable", strand: "collecting_like_terms" },
  { key: "x2-product", prompt: "Why can x^2 and x times x be treated as the same variable part?", answer: "x^2 is notation for x multiplied by x, so both expressions represent the same product.", choices: ["x^2 is notation for x multiplied by x, so both expressions represent the same product.", "The power 2 means add two to x.", "Any two expressions containing x are equivalent.", "x times x always equals 2x."], explanation: "The index notation x^2 abbreviates the product x times x. This structural equivalence is different from the addition x + x, which simplifies to 2x.", tag: "power_confused_with_coefficient", strand: "equivalence" },
  { key: "same-coefficient", prompt: "Why are 2a and 2b unlike terms despite sharing coefficient 2?", answer: "Like terms are matched by their variable parts, not by having the same coefficient.", choices: ["Like terms are matched by their variable parts, not by having the same coefficient.", "Matching coefficients turn a and b into the same variable.", "Both simplify to 4ab.", "Variables never affect term families."], explanation: "The coefficient tells how many copies there are, while the variable identifies what is being counted. Two a-units and two b-units remain different kinds of quantity.", tag: "coefficient_match_means_like", strand: "coefficient_meaning" },
  { key: "test-values", prompt: "Why can a test value disprove equivalence but not prove it for every value?", answer: "One unequal result is a counterexample, but matching once may be coincidence; structural reasoning is still needed.", choices: ["One unequal result is a counterexample, but matching once may be coincidence; structural reasoning is still needed.", "One matching result proves two expressions are always equivalent.", "Substitution cannot be used to check expressions.", "Equivalent expressions must use identical symbols in identical order."], explanation: "If two expressions give different outputs for one allowed input, they cannot be equivalent. A single match is useful evidence but does not replace an algebraic argument that works for every value.", tag: "one_value_proves_equivalence", strand: "equivalence" },
];

const misconceptionCases = [
  { key: "coefficient", prompt: "What does the coefficient 5 mean in 5x?", answer: "Five multiplied by x, or five equal x-units", choices: ["Five multiplied by x, or five equal x-units", "The separate sum 5 + x", "x raised to power 5", "A variable named 5x"], explanation: "In 5x, multiplication is implied: the coefficient 5 counts five copies of the variable quantity x. It does not add five or create a power.", tag: "coefficient_as_addend", strand: "coefficient_meaning" },
  { key: "term-count", prompt: "How many terms are in 3x - 2 + y?", answer: "Three terms: 3x, -2 and y", choices: ["Three terms: 3x, -2 and y", "Five terms because every symbol counts", "Two terms because only variables count", "One term because there is one expression"], explanation: "Addition and subtraction separate an expression into signed terms. The minus sign remains attached to 2, so the three terms are 3x, -2 and y.", tag: "symbol_count_as_term_count", strand: "variables_terms_coefficients" },
  { key: "collect", prompt: "Simplify 4x + 3 + 2x - 5.", answer: "6x - 2", choices: ["6x - 2", "4x", "6x + 8", "10x"], explanation: "Collect the x terms to get 6x and collect the constants using their signs to get 3 - 5 = -2. The two families remain separate.", tag: "constant_combined_with_variable", strand: "collecting_like_terms" },
  { key: "substitute", prompt: "Find 3x + 2 when x = 4.", answer: "14", choices: ["14", "9", "18", "324"], explanation: "Substitution replaces x with 4 while preserving multiplication: 3 times 4 plus 2 equals 12 plus 2, which is 14.", tag: "substitution_ignores_multiplication", strand: "substitution" },
  { key: "form", prompt: "A ticket costs £4 and there is one £3 booking fee. Which expression gives the cost of x tickets?", answer: "4x + 3", choices: ["4x + 3", "7x", "4 + 3x", "12x"], explanation: "The repeated cost is four pounds for each of x tickets, giving 4x. The booking fee is charged once, so it remains the constant 3.", tag: "constant_made_repeated", strand: "forming_expressions" },
  { key: "equivalent-collect", prompt: "Which expression is equivalent to 2x + 3x for every x?", answer: "5x", choices: ["5x", "5x^2", "6x", "2x + 3"], explanation: "Both terms have variable part x, so their coefficients add: two x-units plus three x-units make five x-units for every value of x.", tag: "addition_made_power", strand: "equivalence" },
  { key: "not-square", prompt: "Which statement correctly compares x + x and x^2?", answer: "x + x is 2x, while x^2 is x multiplied by x; they are not generally equivalent", choices: ["x + x is 2x, while x^2 is x multiplied by x; they are not generally equivalent", "Both are always 2x", "Both are always x^2", "They differ only when x is positive"], explanation: "Repeated addition and repeated multiplication are different operations. A value such as x = 3 gives 6 and 9, providing a counterexample to general equivalence.", tag: "addition_made_power", strand: "equivalence" },
  { key: "distribute", prompt: "Expand 3(x + 2).", answer: "3x + 6", choices: ["3x + 6", "3x + 2", "5x", "6x"], explanation: "Three multiplies every term inside the brackets. An area or grouping model shows three x-units and three groups of two constants, making 3x + 6.", tag: "distribution_one_term_only", strand: "distributive_reasoning" },
  { key: "subtract-bracket", prompt: "Simplify 5x - (2x + 3).", answer: "3x - 3", choices: ["3x - 3", "3x + 3", "7x + 3", "3x"], explanation: "Subtracting the bracket subtracts both terms: 5x - 2x - 3. Collecting the x terms gives 3x, and the constant remains -3.", tag: "minus_not_distributed", strand: "distributive_reasoning" },
  { key: "equivalent-expand", prompt: "Which expression is equivalent to 4(x + 1)?", answer: "4x + 4", choices: ["4x + 4", "4x + 1", "5x", "8x"], explanation: "The factor four applies to x and to one. Four equal groups of x + 1 contain four x-units and four constant units.", tag: "distribution_one_term_only", strand: "equivalence" },
  { key: "negative-substitute", prompt: "Find 2x + 5 when x = -3.", answer: "-1", choices: ["-1", "11", "-11", "1"], explanation: "Use brackets around the substituted negative value: 2(-3) + 5 = -6 + 5 = -1. The negative sign belongs to the value of x.", tag: "negative_substitution_sign", strand: "substitution" },
];

const transferCases = [
  { key: "sub-4x", prompt: "Evaluate 4x - 3 when x = 5.", answer: "17", choices: ["17", "8", "23", "45 - 3"], explanation: "Replace x by 5 and preserve the multiplication: 4 times 5 minus 3 equals 20 minus 3, so the value is 17.", tag: "substitution_ignores_multiplication", strand: "substitution", model: "function machine with input 5, multiply-by-4 stage and subtract-3 stage" },
  { key: "sub-two-vars", prompt: "Evaluate 2a + 3b when a = 4 and b = 2.", answer: "14", choices: ["14", "18", "9", "24"], explanation: "Substitute each value into its own term: 2 times 4 plus 3 times 2 equals 8 plus 6, giving 14.", tag: "variables_given_same_value", strand: "substitution", model: "two-column substitution table linking each variable to its value" },
  { key: "sub-power", prompt: "Evaluate p^2 + 2 when p = 3.", answer: "11", choices: ["11", "8", "25", "32"], explanation: "Substitution gives 3 squared plus 2. Since 3 squared is 3 times 3, the value is 9 + 2 = 11.", tag: "power_as_multiplication_by_index", strand: "substitution", model: "square array for p by p beside two unit counters" },
  { key: "form-notebooks", prompt: "A notebook costs £3 and delivery costs £2 once. Form an expression for n notebooks.", answer: "3n + 2", choices: ["3n + 2", "5n", "3 + 2n", "6n"], explanation: "The notebook cost repeats n times, producing 3n. Delivery is one fixed charge, so it is represented by the constant +2.", tag: "constant_made_repeated", strand: "forming_expressions", model: "n equal £3 groups beside one separate £2 fee card" },
  { key: "form-perimeter", prompt: "A rectangle has length x + 2 and width x. Form and simplify its perimeter.", answer: "4x + 4", choices: ["4x + 4", "2x + 2", "2x + 4", "x^2 + 2x"], explanation: "Perimeter adds two lengths and two widths: 2(x + 2) + 2x. Distributing and collecting gives 2x + 4 + 2x = 4x + 4.", tag: "perimeter_as_area", strand: "forming_expressions", model: "labelled rectangle outline with each side shown and no area shading" },
  { key: "equiv-collect", prompt: "Simplify 3x + 2x - 4 without changing its value.", answer: "5x - 4", choices: ["5x - 4", "5x", "x - 4", "5x - 8"], explanation: "The two x terms are like, so coefficients 3 and 2 combine to 5. The constant -4 is unlike and remains attached with its sign.", tag: "constant_combined_with_variable", strand: "equivalence", model: "five x-tiles and four negative unit counters with a signed inventory" },
  { key: "equiv-three-x", prompt: "Build an equivalent expression for x + x + x.", answer: "3x", choices: ["3x", "x^3", "3 + x", "xxx"], explanation: "Each x has implicit coefficient one. Collecting the three matching terms adds coefficients to produce 3x; it does not multiply the variables.", tag: "addition_made_power", strand: "equivalence", model: "three identical x-bars grouped under a coefficient brace labelled 3" },
  { key: "dist-positive", prompt: "Expand 4(x + 3).", answer: "4x + 12", choices: ["4x + 12", "4x + 3", "7x", "12x"], explanation: "Four multiplies both terms inside the brackets: 4 times x gives 4x and 4 times 3 gives 12. The area model contains both regions.", tag: "distribution_one_term_only", strand: "distributive_reasoning", model: "partitioned rectangle with side 4 and widths x and 3" },
  { key: "dist-binomial", prompt: "Expand 2(3x - 1).", answer: "6x - 2", choices: ["6x - 2", "6x - 1", "5x", "6x + 2"], explanation: "Multiply both terms by two: two lots of 3x make 6x, and two lots of negative one make negative two. The sign remains attached.", tag: "distribution_loses_negative", strand: "distributive_reasoning", model: "two identical groups, each containing three x-counters and one negative unit" },
  { key: "dist-counterexample", prompt: "A learner says 5(x + 2) equals 5x + 2. Which equivalent expression repairs the claim?", answer: "5x + 10", choices: ["5x + 10", "5x + 2", "7x", "10x"], explanation: "Five must multiply x and 2, giving 5x + 10. For example, x = 1 gives 15 for both correct forms but only 7 for 5x + 2.", tag: "distribution_one_term_only", strand: "distributive_reasoning", model: "five rows, each containing one x-bar and two unit counters" },
];

const termSortCandidates = Array.from({ length: 44 }, (_, index) => buildTermSort(index));
const signedBuildCandidates = Array.from({ length: 44 }, (_, index) => buildSignedExpression(index));
const explanationCandidates = cross(explanationCases, routes, (item, route, index) => candidate({
  id: `explain-${item.key}-${route.key}`, format: "short-response", blueprint: "unlike-term-explanations", band: "secure", strand: item.strand,
  coverage: ["variables_terms_coefficients", item.strand, "misconceptions"], prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate(item.choices, index % 4), explanation_stem: "These terms can or cannot be combined because ___", accepted_response: "equivalent age-appropriate wording using the variable-part relationship", representation: route.representation }, answer: item.answer,
  hints: ["Compare the complete variable part of each term, including every variable and power.", "Then describe what the coefficient counts and keep each sign attached."], explanation: item.explanation, tag: item.tag,
  concrete: item.strand === "distributive_reasoning" ? "partitioned area card with every region labelled" : "signed counters placed in patterned variable-family trays",
  repair: "Say or select the variable part first, then complete the scaffold: they are like/unlike because ___. Exact model wording is not required.", index,
}));
const probeCandidates = cross(misconceptionCases, routes, (item, route, index) => candidate({
  id: `probe-${item.key}-${route.key}`, format: "multiple_choice", blueprint: "multiple-choice-misconception-probes", band: "mixed", strand: item.strand,
  coverage: [item.strand, "misconceptions", "equivalence"], prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate(item.choices, index % 4), representation: route.representation }, answer: item.answer,
  hints: ["Name each operation and keep signs attached before calculating.", "Check the choice with a concrete model, structure or one carefully substituted value."], explanation: item.explanation, tag: item.tag,
  concrete: concreteFor(item.strand), repair: `Rebuild the step using ${concreteFor(item.strand)}, then compare the misconception choice with the invariant meaning of the expression.`, index,
}));
const transferCandidates = cross(transferCases, routes, (item, route, index) => candidate({
  id: `transfer-${item.key}-${route.key}`, format: "symbol-build", blueprint: "retrieval-and-transfer-expressions", band: "retrieval", strand: item.strand,
  coverage: [item.strand, "equivalence", "retrieval_transfer"], prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate(item.choices, index % 4), representation: route.representation, substitution_brackets_available: item.strand === "substitution", move_history_available: true }, answer: item.answer,
  hints: ["Translate one operation or relationship at a time and keep an unchanged copy of the original expression visible.", "Verify with the supplied model or a test value, remembering that one matching value alone does not prove general equivalence."], explanation: item.explanation, tag: item.tag,
  concrete: item.model, repair: `Use the static model: ${item.model}. Record one justified move at a time and undo any move that changes the value.`, index,
}));

const generated = [...termSortCandidates, ...signedBuildCandidates, ...explanationCandidates, ...probeCandidates, ...transferCandidates];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Year 7 simplifying expressions reaches the 220-item pilot target with four preserved curated variants and 216 deterministic review candidates. The depth bank covers variable, term and coefficient meaning; collecting like terms; substitution; forming expressions; equivalence; distributive reasoning; and misconception diagnosis. Every generated item offers concrete and symbolic scaffolds, static text alternatives, keyboard, switch, eye-gaze, AAC, oral and partner-mediated routes, rich strategy feedback, and private puzzle-mission progress without timers, streak loss, lives, leaderboards or peer comparison. Independent mathematics, teacher, SEND, accessibility, safeguarding, renderer and pilot review remain required before promotion.";

validateBank(pack, curated, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`algebra-simplify-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`algebra-simplify-bank blueprints=${summary(generated, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`algebra-simplify-bank strands=${summary(generated, (variant) => variant.body.algebra_strand)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`algebra-simplify-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 7 algebra simplify bank is out of date; run generate-y7-algebra-simplify-bank.mjs --write.");
  console.log("algebra-simplify-bank deterministic check passed");
} else {
  console.log("algebra-simplify-bank dry-run; pass --write to update the pack");
}

function buildTermSort(index) {
  const route = routes[index % routes.length];
  const level = index % 4;
  const a = 2 + (index % 7);
  const b = 1 + ((index * 3) % 6);
  const c = 2 + ((index * 5) % 8);
  const d = 1 + ((index * 7) % 9);
  const familySets = [
    { terms: [`${a}x`, `-${b}`, `-${c}x`, `${d}`], trays: ["x terms", "constant terms"] },
    { terms: [`${a}x`, `-${b}y`, `${c}`, `-${d}x`, `${b}y`, `-${a}`], trays: ["x terms", "y terms", "constant terms"] },
    { terms: [`${a}x^2`, `-${b}x`, `${c}`, `-${d}x^2`, `${b}x`, `-${a}`], trays: ["x^2 terms", "x terms", "constant terms"] },
    { terms: [`${a}x`, `-${b}y`, `${c}x^2`, `-${d}`, `-${b}x`, `${a}y`, `-${c}x^2`, `${d}`], trays: ["x terms", "y terms", "x^2 terms", "constant terms"] },
  ];
  const set = familySets[level];
  const terms = rotate(set.terms, index % set.terms.length);
  const answer = set.trays.map((tray) => `${tray}: ${set.terms.filter((term) => familyOf(term) === tray).join(", ")}`);
  return candidate({
    id: `sort-${index + 1}-${route.key}`, format: "term-sort", blueprint: "term-family-sorting", band: "intro", strand: index % 3 === 0 ? "coefficient_meaning" : "variables_terms_coefficients",
    coverage: ["variables_terms_coefficients", "coefficient_meaning", "collecting_like_terms"], prompt: `${route.label} ${index + 1}: sort each signed term by its complete variable part.`, body: { terms, trays: set.trays, role_labels: terms.map((term) => `${term}: coefficient ${coefficientOf(term)}, variable part ${variablePartOf(term)}`), representation: route.representation }, answer,
    hints: ["Keep the sign attached and ignore coefficient size when choosing a family.", "Constants have no variable part; x and x^2 are different families."],
    explanation: `The families are determined by the complete variable part, not by coefficient size or sign. ${answer.join("; ")}. Sorting first protects equivalence before any coefficients are collected.`,
    tag: level > 1 ? "power_family_confusion" : "unlike_terms_combined", concrete: "patterned family trays with detachable signed coefficient counters and text labels", repair: "Use the text-only tray list or place one signed counter at a time; say the variable part before choosing a tray.", index,
  });
}

function buildSignedExpression(index) {
  const route = routes[index % routes.length];
  const a = 2 + (index % 7);
  const b = 1 + ((index * 2) % 5);
  const signedB = index % 3 === 0 ? -b : b;
  const c = 1 + ((index * 3) % 6);
  const d = 1 + ((index * 5) % 4);
  const signedD = index % 2 === 0 ? d : -d;
  const coefficient = a + signedB;
  const constant = c + signedD;
  const expression = `${a}x ${signedTerm(signedB, "x")} + ${c} ${signedNumber(signedD)}`;
  const answer = formatLinear(coefficient, constant, "x");
  const choices = uniqueChoices(answer, [formatLinear(a + Math.abs(signedB), c + Math.abs(signedD), "x"), formatLinear(coefficient + constant, 0, "x"), formatLinear(a - signedB, c - signedD, "x"), `${coefficient} + x ${signedNumber(constant)}`]);
  return candidate({
    id: `signed-${index + 1}-${route.key}`, format: "symbol-build", blueprint: "signed-symbol-builds", band: "expected", strand: "collecting_like_terms",
    coverage: ["collecting_like_terms", "coefficient_meaning", "equivalence", "misconceptions"], prompt: `${route.label} ${index + 1}: simplify ${expression} while keeping every sign attached.`, body: { expression, choices: rotate(choices, index % 4), tokens: expression.split(" "), move_history_available: true, equivalence_check_values: [-2, 0, 3], representation: route.representation }, answer,
    hints: ["Sort the x terms and constants, carrying each sign with its term.", `Combine signed coefficients separately from signed constants, then rebuild the expression.`],
    explanation: `The signed x coefficients combine as ${a} ${signedNumber(signedB)} = ${coefficient}, while the constants combine as ${c} ${signedNumber(signedD)} = ${constant}. Therefore ${expression} is equivalent to ${answer}.`,
    tag: signedB < 0 || signedD < 0 ? "lost_negative_sign" : "constant_combined_with_variable", concrete: "signed x-tiles and positive or negative unit counters grouped on separate inventory rails", repair: "Return to the static signed inventory, total one family at a time, and use undo if a sign or family changes.", index,
  });
}

function candidate({ id, format, blueprint, band, strand, coverage, prompt, body, answer, hints, explanation, tag, concrete, repair, index }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...body,
      algebra_strand: strand,
      coverage_tags: coverage,
      evidence_purpose: `${strand}_structure_and_equivalence`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      difficulty_band: band,
      response_mode: "tap_keyboard_switch_eye_gaze_aac_oral_partner_or_adult_scribed",
      supported_interactions: ["tap", "keyboard", "switch_scan", "eye_gaze", "aac", "oral_response", "partner_scan", "adult_scribed"],
      interaction_support: { keyboard: true, switch_scan: true, touch: true, eye_gaze: true, aac: true, oral_or_partner_response: true, precision_drag_required: false, select_move_up_down_alternative: true, direct_symbol_entry: true, undo_available: true },
      concrete_scaffold: concrete,
      visual_scaffold: "variable families use labels, shapes and patterns as well as colour; signs remain physically and textually attached to terms",
      symbolic_scaffold: "original expression remains visible beside a signed term inventory and a one-move-at-a-time history",
      manipulative_alternative: "same task with large-print magnetic term cards and signed coefficient counters",
      static_alternative: "numbered text list, family table or labelled area model containing all information without animation",
      reduced_motion_alternative: "instant state changes and persistent outlines with no snapping, bouncing, countdown or flashing",
      reduced_visual_load: true,
      one_family_or_operation_per_screen_option: true,
      sentence_stems: ["The coefficient ___ means ___.", "These terms are like/unlike because ___.", "This move preserves the value because ___."],
      timed: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      peer_comparison_allowed: false,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Puzzle route verified. ${explanation}`,
      try_again: `No speed score and no lost progress. ${hints[0]}`,
      misconception: `Test the '${tag.replaceAll("_", " ")}' route against the signed model, then use the second hint.`,
      strategy: repair,
      equivalence_check: "A legal simplification or expansion must keep the same output for every allowed value; a counterexample disproves equivalence.",
    },
    gamification: {
      mission: missionFor(strand),
      objective: "Unlock one algebra bridge node by justifying a value-preserving move.",
      reward: `private_strategy_crystal_${(index % 8) + 1}`,
      strategic_choice: "Choose tiles, family trays, a value table or symbols; route choice is not scored.",
      individual_progress_only: true,
      no_timer: true,
      no_lost_lives: true,
      no_streak_pressure: true,
      leaderboard: false,
      peer_comparison: false,
      retry_encouraged: true,
    },
    difficulty: { intro: 3, expected: 6, secure: 8, mixed: 6, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: hookFor(strand),
  };
}

function validateBank(currentPack, authored, candidates) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}.`);
  if (candidates.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const formats = new Set(currentPack.practice.formats);
  const requiredCoverage = new Set(["variables_terms_coefficients", "coefficient_meaning", "collecting_like_terms", "substitution", "forming_expressions", "equivalence", "distributive_reasoning", "misconceptions"]);
  const actualCoverage = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of candidates) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || blueprint.difficulty_band !== variant.body.difficulty_band) throw new Error(`${variant.id} does not match its blueprint.`);
    if (!formats.has(variant.format) || variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} has unsupported format, status or provenance.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || !variant.body.interaction_support?.eye_gaze || !variant.body.interaction_support?.aac || variant.body.interaction_support?.precision_drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.concrete_scaffold || !variant.body.visual_scaffold || !variant.body.symbolic_scaffold || !variant.body.static_alternative || !variant.body.manipulative_alternative || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND concrete or visual scaffolds.`);
    if (variant.body.timed || variant.body.timer_allowed || variant.body.speed_score_allowed || variant.body.leaderboard_allowed || variant.body.peer_comparison_allowed) throw new Error(`${variant.id} introduces speed or social pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.try_again || !variant.feedback?.misconception || !variant.feedback?.strategy || !variant.feedback?.equivalence_check || variant.hints.length < 2 || variant.explanation.length < 80) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!variant.gamification?.individual_progress_only || !variant.gamification?.no_timer || !variant.gamification?.no_lost_lives || !variant.gamification?.no_streak_pressure || variant.gamification?.leaderboard || variant.gamification?.peer_comparison) throw new Error(`${variant.id} has unsuitable gamification.`);
    if (Array.isArray(variant.expected_answer.value)) {
      if (variant.format !== "term-sort" || variant.expected_answer.value.length !== variant.body.trays.length) throw new Error(`${variant.id} has an invalid structured answer.`);
    } else if (!Array.isArray(variant.body.choices) || new Set(variant.body.choices).size !== variant.body.choices.length || variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) {
      throw new Error(`${variant.id} must offer its answer exactly once.`);
    }
    for (const tag of variant.body.coverage_tags) actualCoverage.add(tag);
    actualFormats.add(variant.format);
    actualBlueprints.add(variant.body.variant_blueprint_id);
  }
  requireCoverage("content", requiredCoverage, actualCoverage);
  requireCoverage("formats", formats, actualFormats);
  requireCoverage("blueprints", new Set(blueprints.keys()), actualBlueprints);
  const allocation = countBy(candidates, (variant) => variant.body.variant_blueprint_id);
  const expectedAllocation = { "term-family-sorting": 44, "signed-symbol-builds": 44, "unlike-term-explanations": 44, "multiple-choice-misconception-probes": 44, "retrieval-and-transfer-expressions": 40 };
  for (const [id, expected] of Object.entries(expectedAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
}

function familyOf(term) { const part = variablePartOf(term); return part === "constant" ? "constant terms" : `${part} terms`; }
function variablePartOf(term) { const match = term.match(/[a-z](?:\^[0-9]+)?(?:[a-z](?:\^[0-9]+)?)*/i); return match?.[0] ?? "constant"; }
function coefficientOf(term) { const variable = variablePartOf(term); if (variable === "constant") return term; const prefixPart = term.slice(0, term.indexOf(variable)); if (prefixPart === "" || prefixPart === "+") return "1"; if (prefixPart === "-") return "-1"; return prefixPart; }
function signedTerm(value, variable) { return value < 0 ? `- ${Math.abs(value)}${variable}` : `+ ${value}${variable}`; }
function signedNumber(value) { return value < 0 ? `- ${Math.abs(value)}` : `+ ${value}`; }
function formatLinear(coefficient, constant, variable) { const variableTerm = coefficient === 0 ? "" : coefficient === 1 ? variable : coefficient === -1 ? `-${variable}` : `${coefficient}${variable}`; if (constant === 0) return variableTerm || "0"; if (!variableTerm) return String(constant); return `${variableTerm} ${signedNumber(constant)}`; }
function uniqueChoices(answer, distractors) { const choices = [answer]; for (const item of distractors) if (!choices.includes(item)) choices.push(item); for (const fallback of ["0", "x", "x + 1", "2x"]) if (choices.length < 4 && !choices.includes(fallback)) choices.push(fallback); return choices.slice(0, 4); }
function concreteFor(strand) { return { coefficient_meaning: "equal x-bars grouped under a numbered coefficient brace", variables_terms_coefficients: "signed term cards separated at addition and subtraction boundaries", collecting_like_terms: "patterned family trays with signed coefficient counters", substitution: "function machine and input-value table with substitution brackets", forming_expressions: "bar model separating repeated groups from one-off constants", equivalence: "two expression panels linked to the same value table and reversible move history", distributive_reasoning: "partitioned area model with every product region labelled" }[strand] ?? "signed term cards and a labelled operation history"; }
function missionFor(strand) { return { coefficient_meaning: "Decode the Coefficient Vault", variables_terms_coefficients: "Calibrate the Term Scanner", collecting_like_terms: "Stabilise the Like-Term Reactor", substitution: "Power the Input Machine", forming_expressions: "Blueprint the Expression Bridge", equivalence: "Guard the Equivalence Core", distributive_reasoning: "Map the Distribution Grid" }[strand] ?? "Repair the Algebra Lab"; }
function hookFor(strand) { return { coefficient_meaning: "coefficient-brace-reveal", variables_terms_coefficients: "term-trays-light", collecting_like_terms: "signed-tiles-combine", substitution: "input-machine-trace", forming_expressions: "expression-blueprint-build", equivalence: "equivalence-balance-lock", distributive_reasoning: "area-model-distribute" }[strand] ?? "expression-lock-in"; }
function cross(items, routeItems, builder) { const variants = []; for (const item of items) for (const route of routeItems) variants.push(builder(item, route, variants.length)); return variants; }
function requireCoverage(label, required, actual) { const missing = [...required].filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = countBy(items, keyFor); return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
