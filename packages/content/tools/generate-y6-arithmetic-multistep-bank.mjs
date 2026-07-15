#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y6-arithmetic-multi-step.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y6-arithmetic-multistep-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y6-arithmetic-multi-step") throw new Error("This generator only supports the Year 6 multi-step arithmetic pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const missions = [
  { key: "observatory", place: "Skyline observatory", goal: "calibrate the telescope array", reward: "star-map coordinate" },
  { key: "reef", place: "Blue Reef research base", goal: "prepare the habitat survey", reward: "reef evidence tile" },
  { key: "museum", place: "Discovery museum", goal: "open the mathematics archive", reward: "archive mechanism piece" },
  { key: "forest", place: "Canopy field station", goal: "complete the wildlife route", reward: "field-map marker" },
  { key: "robotics", place: "Community robotics lab", goal: "program the supply rover", reward: "rover command module" },
  { key: "island", place: "Island weather station", goal: "restore the forecast network", reward: "weather-link beacon" },
];

const candidates = [
  ...operationChoiceCandidates(30),
  ...stepOrderCandidates(30),
  ...estimationCandidates(30),
  ...inverseCheckCandidates(30),
  ...multiStepContextCandidates(30),
  ...hiddenInformationCandidates(29),
  ...efficiencyCandidates(29),
  ...misconceptionCandidates(29),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Cross-year review bank reaches the 240-item pilot target with three preserved curated questions and 237 deterministic candidates spanning operation choice, step order, estimation, inverse checking, multi-step contexts, hidden information, efficient calculation and misconception repair. Every generated candidate includes a visual KNOW-GOAL-PLAN-SOLVE-CHECK route, SEND scaffolds, keyboard/switch/oral and non-drag interactions, layered feedback and strategic mission progress earned through planning and checking rather than speed. Human curriculum, teacher, SEND, accessibility, safeguarding and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`arithmetic-multistep-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`arithmetic-multistep-bank strands=${summary(candidates, (variant) => variant.body.maths_strand)}`);
console.log(`arithmetic-multistep-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`arithmetic-multistep-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`arithmetic-multistep-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 arithmetic multi-step bank is out of date; run generate-y6-arithmetic-multistep-bank.mjs --write.");
  console.log("arithmetic-multistep-bank deterministic check passed");
} else {
  console.log("arithmetic-multistep-bank dry-run; pass --write to update the pack");
}

function operationChoiceCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[index % missions.length];
    const a = 120 + index * 7;
    const b = 35 + (index % 9) * 4;
    const groups = 4 + (index % 7);
    const each = 18 + (index % 8) * 3;
    const mode = index % 6;
    const cases = [
      { prompt: `${a} survey records are complete and ${b} more arrive. Which operation finds the new total?`, answer: `addition, because two quantities are combined: ${a} + ${b}`, wrong: [`subtraction, because every problem with 'more' subtracts`, `multiplication, because there are two numbers`, `division, because the records must be shared`] },
      { prompt: `The target is ${a + b} route markers and ${a} are ready. Which operation finds how many are still needed?`, answer: `subtraction, because the known part is removed from the target: ${a + b} - ${a}`, wrong: [`addition, because all targets require adding`, `multiplication, because the target is large`, `division, because there are two quantities`] },
      { prompt: `${groups} sensor kits each need ${each} clips. Which operation finds the total clips?`, answer: `multiplication, because there are ${groups} equal groups of ${each}`, wrong: [`addition of ${groups} and ${each}`, `subtraction, because clips leave storage`, `division, because equal groups always mean sharing`] },
      { prompt: `${groups * each} data cards are shared equally among ${groups} teams. Which operation finds cards per team?`, answer: `division, because one total is shared into ${groups} equal groups`, wrong: [`multiplication, because teams are groups`, `addition, because each team gets more`, `subtraction, because cards leave the pile`] },
      { prompt: `${groups} crates hold ${each} parts each, then ${b} parts are used. Which operation must come first?`, answer: `multiplication first, to find the starting total in ${groups} equal crates`, wrong: [`subtract ${b} from ${each} before finding the total`, `divide ${b} by ${groups}`, `add every number because they appear in one problem`] },
      { prompt: `${groups * each + b} samples are packed into trays of ${each}. Which operation finds the number of full trays and whether any remain?`, answer: `division, because the total is grouped into equal sets of ${each}`, wrong: [`addition, because a remainder may appear`, `subtraction once only`, `multiplication, because trays contain equal groups`] },
    ];
    const item = cases[mode];
    return variant({ id: `operation-${mode + 1}-${index + 1}`, format: "reason-choice", blueprint: "operation-choice-warmups", band: "intro", strand: "operation_choice", mission, prompt: `Operation scanner ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, knowns: [a, b, groups, each].slice(0, mode < 2 ? 2 : 3), goal: "choose an operation from the quantity relationship", plan: ["name what each number represents", "describe how the quantities are related", "choose the matching operation"], hints: ["Ignore isolated keywords and describe what happens to the quantities.", "Ask whether the situation combines, compares, groups equally or shares."], explanation: `${item.answer}. The operation follows the structure of the quantities, not a single word in the prompt.`, tag: "keyword_only_operation_choice", repair: "Build the situation with labelled bars or counters, then say the relationship before seeing operation symbols." });
  });
}

function stepOrderCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 1) % missions.length];
    const groups = 3 + (index % 7);
    const each = 24 + (index % 6) * 5;
    const change = 11 + (index % 8) * 3;
    const mode = index % 5;
    const cases = [
      { prompt: `${groups} boxes hold ${each} components each. ${change} components are used.`, answer: `1) ${groups} × ${each}; 2) subtract ${change}`, wrong: [`1) ${each} - ${change}; 2) × ${groups}`, `1) ${change} × ${groups}; 2) add ${each}`, `1) ${each} ÷ ${groups}; stop`] },
      { prompt: `${groups} teams record ${each} readings each, and a central sensor adds ${change} readings.`, answer: `1) ${groups} × ${each}; 2) add ${change}`, wrong: [`1) ${each} + ${change}; 2) ÷ ${groups}`, `1) subtract ${change}; 2) × ${groups}`, `1) add ${groups} + ${each} + ${change}`] },
      { prompt: `${groups * each} tiles are shared among ${groups} zones, then each zone receives ${change} extra tiles.`, answer: `1) ${groups * each} ÷ ${groups}; 2) add ${change}`, wrong: [`1) ${groups} + ${change}; 2) divide by ${each}`, `1) subtract ${change}; 2) multiply by ${groups}`, `1) ${groups * each} × ${groups}; stop`] },
      { prompt: `${groups} routes each need ${each} markers. ${change} markers are already available.`, answer: `1) ${groups} × ${each}; 2) subtract ${change} from the total needed`, wrong: [`1) ${each} - ${change}; 2) multiply`, `1) divide ${change} by ${groups}`, `1) add the routes to the markers`] },
      { prompt: `A store has ${groups * each + change} parts. It packs ${groups} equal kits, then puts the ${change} leftover parts in reserve.`, answer: `1) subtract the ${change} reserve parts; 2) divide by ${groups}`, wrong: [`1) divide everything by ${groups}; 2) add ${change} to each kit`, `1) multiply by ${groups}; 2) subtract ${change}`, `1) add ${change}; 2) divide by ${each}`] },
    ];
    const item = cases[mode];
    return variant({ id: `order-${mode + 1}-${index + 1}`, format: "step-planner", blueprint: "two-step-planner-orders", band: "expected", strand: "step_order", mission, prompt: `Route planner ${index + 1}: ${item.prompt} Which ordered plan answers the question?`, choices: [item.answer, ...item.wrong], answer: item.answer, knowns: [groups, each, change], goal: "order the dependent calculations", plan: item.answer.split("; "), hints: ["Find the quantity that does not exist yet but is needed by the final step.", "Draw arrows from the first result into the second calculation."], explanation: `${item.answer}. The second step depends on the total or equal share created by the first step, so number order alone cannot determine the plan.`, tag: "number_order_not_structure", repair: "Use two numbered step cards and an arrow showing that step 1's answer becomes step 2's input." });
  });
}

function estimationCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 2) % missions.length];
    const mode = index % 4;
    let calculation;
    let exact;
    let estimate;
    let proposed;
    if (mode === 0) {
      const a = 194 + index * 3;
      const b = 4 + (index % 5);
      calculation = `${a} × ${b}`;
      exact = a * b;
      estimate = `${Math.round(a / 100) * 100} × ${b} = ${Math.round(a / 100) * 100 * b}`;
      proposed = exact * 10 + 7;
    } else if (mode === 1) {
      const divisor = 4 + (index % 4);
      const rounded = 200 * divisor;
      const dividend = rounded + divisor * ((index % 3) - 1);
      calculation = `${dividend} ÷ ${divisor}`;
      exact = dividend / divisor;
      estimate = `${rounded} ÷ ${divisor} = 200`;
      proposed = exact * 10;
    } else if (mode === 2) {
      const a = 3980 + index * 7;
      const b = 2010 + index * 3;
      calculation = `${a} + ${b}`;
      exact = a + b;
      estimate = `4,000 + 2,000 = 6,000`;
      proposed = exact + 10000;
    } else {
      const a = 8010 + index * 5;
      const b = 3970 + index * 2;
      calculation = `${a} - ${b}`;
      exact = a - b;
      estimate = `8,000 - 4,000 = 4,000`;
      proposed = Math.max(10, exact - 3500);
    }
    const answer = `No; ${estimate}, so ${formatNumber(proposed)} is unreasonable`;
    return variant({ id: `estimate-${mode + 1}-${index + 1}`, format: "reason-choice", blueprint: "estimate-reasonableness-checks", band: "secure", strand: "estimation", mission, prompt: `Estimate checkpoint ${index + 1}: a rover reports ${formatNumber(proposed)} for ${calculation}. Is the report reasonable?`, choices: [answer, `Yes; exact answers do not need to be near an estimate`, `Yes; a larger written answer is safer`, `No; every answer should be below 100`], answer, knowns: [calculation, proposed], goal: "judge reasonableness with a useful approximation", plan: ["round to friendly numbers", "calculate an approximate size", "compare the proposed answer's magnitude"], hints: ["Round enough to reveal the size of the answer, not to reproduce it exactly.", `Compare ${formatNumber(proposed)} with the benchmark ${estimate}.`], explanation: `${estimate}, while the exact answer is ${formatNumber(exact)}. The proposed ${formatNumber(proposed)} is far outside the reasonable range, so the estimate catches the error.`, tag: "no_reasonableness_check", repair: "Place the estimate and proposed answer on a magnitude line, then compare thousands, hundreds and tens." });
  });
}

function inverseCheckCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 3) % missions.length];
    const mode = index % 4;
    const a = 120 + index * 4;
    const b = 7 + (index % 9);
    let calculation;
    let result;
    let answer;
    let wrong;
    if (mode === 0) {
      result = a + b;
      calculation = `${a} + ${b} = ${result}`;
      answer = `${result} - ${a} = ${b}`;
      wrong = [`${result} + ${a} = ${b}`, `${a} - ${b} = ${result}`, `${result} ÷ ${a} = ${b}`];
    } else if (mode === 1) {
      result = a - b;
      calculation = `${a} - ${b} = ${result}`;
      answer = `${result} + ${b} = ${a}`;
      wrong = [`${result} - ${b} = ${a}`, `${a} + ${b} = ${result}`, `${result} × ${b} = ${a}`];
    } else if (mode === 2) {
      result = a * b;
      calculation = `${a} × ${b} = ${result}`;
      answer = `${result} ÷ ${a} = ${b}`;
      wrong = [`${result} × ${a} = ${b}`, `${result} - ${a} = ${b}`, `${a} ÷ ${b} = ${result}`];
    } else {
      const dividend = a * b;
      result = a;
      calculation = `${dividend} ÷ ${b} = ${result}`;
      answer = `${result} × ${b} = ${dividend}`;
      wrong = [`${result} ÷ ${b} = ${dividend}`, `${dividend} × ${b} = ${result}`, `${result} + ${b} = ${dividend}`];
    }
    return variant({ id: `inverse-${mode + 1}-${index + 1}`, format: "calculation-build", blueprint: "calculation-chain-builds", band: "developing", strand: "inverse_checking", mission, prompt: `Verification console ${index + 1}: which inverse calculation checks ${calculation}?`, choices: [answer, ...wrong], answer, knowns: [calculation], goal: "verify the result with an inverse operation", plan: ["identify the original operation", "choose its inverse", "start with the result and recover a known value"], hints: ["Addition and subtraction are inverse pairs; multiplication and division are inverse pairs.", "A valid check should recover one of the original numbers exactly."], explanation: `${answer}, so the inverse recovers the original known value and supports the result ${formatNumber(result)}. Repeating the same operation would not provide this check.`, tag: "repeats_operation_as_check", repair: "Use a fact-family triangle or bar model to place the result and two original values before choosing the inverse." });
  });
}

function multiStepContextCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 4) % missions.length];
    const mode = index % 5;
    const groups = 4 + (index % 6);
    const each = 25 + (index % 7) * 4;
    const change = 8 + (index % 9) * 3;
    let prompt;
    let plan;
    let value;
    if (mode === 0) {
      prompt = `${groups} survey teams collect ${each} readings each. ${change} duplicate readings are removed. How many remain?`;
      plan = [`${groups} × ${each}`, `subtract ${change}`];
      value = groups * each - change;
    } else if (mode === 1) {
      prompt = `${groups} storage racks hold ${each} parts each. Another ${change} parts arrive, then all parts are shared equally between 2 rovers. How many does each rover receive?`;
      plan = [`${groups} × ${each}`, `add ${change}`, `divide by 2`];
      const total = groups * each + change;
      value = total / 2;
      if (!Number.isInteger(value)) { prompt = `${groups} storage racks hold ${each} parts each. Another ${change + 1} parts arrive, then all parts are shared equally between 2 rovers. How many does each rover receive?`; plan = [`${groups} × ${each}`, `add ${change + 1}`, `divide by 2`]; value = (groups * each + change + 1) / 2; }
    } else if (mode === 2) {
      prompt = `A route has ${groups} sections of ${each} m and a final section of ${change} m. The crew has already mapped ${each} m. How many metres remain?`;
      plan = [`${groups} × ${each}`, `add ${change}`, `subtract ${each}`];
      value = groups * each + change - each;
    } else if (mode === 3) {
      prompt = `${groups} experiment rounds earn ${each} points each. A ${change}-point error is corrected, then a ${change + 5}-point evidence bonus is added. What is the final score?`;
      plan = [`${groups} × ${each}`, `subtract ${change}`, `add ${change + 5}`];
      value = groups * each - change + change + 5;
    } else {
      prompt = `${groups * each} samples are split equally into ${groups} trays. ${change} samples from each tray are then analysed. How many samples remain in each tray?`;
      plan = [`${groups * each} ÷ ${groups}`, `subtract ${change}`];
      value = each - change;
    }
    const answer = `${formatNumber(value)} using ${plan.join(" then ")}`;
    return variant({ id: `context-${mode + 1}-${index + 1}`, format: index % 2 ? "step-planner" : "calculation-build", blueprint: index % 2 ? "multi-step-retrieval" : "calculation-chain-builds", band: index % 2 ? "retrieval" : "developing", strand: "multi_step_contexts", mission, prompt: `Main mission ${index + 1}: ${prompt}`, choices: [answer, `${formatNumber(value + change)} after stopping before the final step`, `${formatNumber(Math.abs(value - change))} after using the change twice`, `${formatNumber(groups + each + change)} after adding every visible number`], answer, knowns: [groups, each, change], goal: "solve the complete context and retain interim results", plan, hints: ["Build the full plan before calculating; tick each question condition as it is used.", `Carry each interim answer into the next box: ${plan.join(" -> ")}.`], explanation: `${plan.join(", then ")} gives ${formatNumber(value)}. The final answer responds to the end goal rather than an interesting intermediate total.`, tag: "stops_after_one_step", repair: "Use linked calculation boxes with the output of each step copied automatically into the next, while the whole question remains visible." });
  });
}

function hiddenInformationCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 5) % missions.length];
    const groups = 3 + (index % 8);
    const each = 20 + (index % 7) * 5;
    const used = 9 + (index % 6) * 4;
    const irrelevant = 40 + index;
    const mode = index % 4;
    const cases = [
      { prompt: `${groups} cases contain ${each} maps each. ${used} maps are displayed. The room opened ${irrelevant} days ago. How many maps remain?`, answer: `Use ${groups}, ${each} and ${used}; ignore ${irrelevant} days`, plan: [`find ${groups} × ${each}`, `subtract ${used}`] },
      { prompt: `A total of ${groups * each} samples is shared among ${groups} teams. Each team then returns ${used}. The station is ${irrelevant} km away. How many does each team keep?`, answer: `Use ${groups * each}, ${groups} and ${used}; ignore ${irrelevant} km`, plan: [`divide ${groups * each} by ${groups}`, `subtract ${used}`] },
      { prompt: `${groups} rows need ${each} markers each. There are ${used} markers ready and ${irrelevant} blue storage labels. How many more markers are needed?`, answer: `Use ${groups}, ${each} and ${used}; ignore the ${irrelevant} storage labels`, plan: [`find ${groups} × ${each}`, `subtract ${used} ready markers`] },
      { prompt: `${groups} teams earn ${each} points and share a bonus of ${used * groups} equally. A display has ${irrelevant} lights. What score does each team receive?`, answer: `Use ${groups}, ${each} and ${used * groups}; ignore ${irrelevant} lights`, plan: [`divide ${used * groups} bonus points by ${groups}`, `add the share to ${each}`] },
    ];
    const item = cases[mode];
    return variant({ id: `hidden-${mode + 1}-${index + 1}`, format: "step-planner", blueprint: "two-step-planner-orders", band: "expected", strand: "hidden_information", mission, prompt: `Information decoder ${index + 1}: ${item.prompt} Which information plan is relevant?`, choices: [item.answer, `Use every number because all given information must enter a calculation`, `Use only the largest two numbers`, `Ignore the quantity that must be found before the final step`], answer: item.answer, knowns: [groups, each, used, irrelevant], goal: "separate relevant, hidden intermediate and irrelevant information", plan: item.plan, hints: ["Label every number with its unit and role before using it.", "Work backwards from the goal: which missing quantity must exist before the final operation?"], explanation: `${item.answer}. The plan ${item.plan.join(" then ")} creates the hidden intermediate quantity; the extra fact has a different unit or no role in the goal.`, tag: "uses_every_number", repair: "Sort fact cards into USE, FIND FIRST and NOT NEEDED columns, with units displayed beside every value." });
  });
}

function efficiencyCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[index % missions.length];
    const mode = index % 6;
    const n = 6 + (index % 9);
    const cases = [
      { calculation: `99 × ${n}`, answer: `Use 100 × ${n} - ${n}`, wrong: [`Use 99 + ${n}`, `Round to 100 and never compensate`, `Divide both numbers by 10`] },
      { calculation: `${400 + index * 4} ÷ 4`, answer: `Halve, then halve again`, wrong: [`Double twice`, `Subtract 4 once`, `Divide by 2 only`] },
      { calculation: `${398 + index} + ${207 + index}`, answer: `Add 2 to the first number to make 400, then subtract 2 after adding`, wrong: [`Add 2 without compensating`, `Multiply both numbers`, `Round both and use the estimate as the exact answer`] },
      { calculation: `${1200 + index} - 999`, answer: `Subtract 1,000, then add 1`, wrong: [`Subtract 1,000 and stop`, `Add 999`, `Subtract 99 only`] },
      { calculation: `25 × ${4 * n}`, answer: `Group 25 × 4 = 100, then multiply by ${n}`, wrong: [`Add 25 and ${4 * n}`, `Multiply by 4 twice without using ${n}`, `Estimate and do not find an exact result`] },
      { calculation: `${48 + index} × 5`, answer: `Multiply by 10, then halve`, wrong: [`Multiply by 10 and stop`, `Halve, then divide by 5`, `Add 5 once`] },
    ];
    const item = cases[mode];
    return variant({ id: `efficiency-${mode + 1}-${index + 1}`, format: "reason-choice", blueprint: "operation-choice-warmups", band: "intro", strand: "efficiency", mission, prompt: `Strategy workshop ${index + 1}: which method calculates ${item.calculation} efficiently and exactly?`, choices: [item.answer, ...item.wrong], answer: item.answer, knowns: [item.calculation], goal: "select an exact efficient strategy", plan: ["notice a nearby friendly number or useful factor", "transform without changing value", "compensate or regroup exactly"], hints: ["Look for 10, 100, 1,000, doubling, halving or factor regrouping.", "An efficient method must stay exact; if you adjust a number, compensate for the adjustment."], explanation: `${item.answer}. This uses number structure to reduce calculation load while preserving the exact value; estimation alone would only check the result.`, tag: "efficient_means_guess", repair: "Show the original and transformed calculations on parallel balance lines so every compensation remains visible." });
  });
}

function misconceptionCandidates(count) {
  const claims = [
    { key: "keyword", claim: "The word 'more' always means add.", answer: "Reject: decide whether the problem asks for a new total, a difference or an amount still needed.", tag: "keyword_only_operation_choice" },
    { key: "stop", claim: "Once I find the total in the boxes, I can stop even though some are then used.", answer: "Reject: reread the goal and continue from the interim total through the remaining condition.", tag: "stops_after_one_step" },
    { key: "order", claim: "Use numbers in the order they appear, so the first written number must be step 1.", answer: "Reject: order steps by dependency; first create the quantity needed by the final operation.", tag: "number_order_not_structure" },
    { key: "estimate", claim: "An exact-looking answer never needs an estimate.", answer: "Reject: a quick magnitude estimate can expose place-value or operation errors before submission.", tag: "no_reasonableness_check" },
    { key: "inverse", claim: "I check multiplication by multiplying the answer by the same number again.", answer: "Reject: use the inverse division to recover an original factor.", tag: "repeats_operation_as_check" },
    { key: "all-info", claim: "Every number in a word problem must be used.", answer: "Reject: use units and the goal to separate relevant facts from deliberately irrelevant information.", tag: "uses_every_number" },
    { key: "efficiency", claim: "The fastest-looking method is best even if I cannot explain why it preserves the value.", answer: "Reject: an efficient strategy must be exact, explainable and checkable; speed is not the success measure.", tag: "speed_over_strategy" },
  ];
  return Array.from({ length: count }, (_, index) => {
    const mission = missions[(index + 2) % missions.length];
    const item = claims[index % claims.length];
    return variant({ id: `misconception-${item.key}-${index + 1}`, format: "step-planner", blueprint: "multi-step-retrieval", band: "retrieval", strand: "misconceptions", mission, prompt: `Crew reasoning huddle ${index + 1}: a learner says, '${item.claim}' Which response is accurate, supportive and useful?`, choices: [item.answer, "Agree because a confident rule does not need evidence.", "Say only that it is wrong without showing a plan or check.", "Choose a different operation at random."], answer: item.answer, knowns: [item.claim], goal: "diagnose and repair a planning misconception", plan: ["identify the tempting rule", "test it against quantity meaning or an inverse", "state a better repeatable strategy"], hints: ["Use a small counterexample, bar model or inverse fact to test the claim.", "Repair the reasoning without blaming the learner; name what to do next."], explanation: `${item.answer} This response replaces the misconception with a reusable PLAN-SOLVE-CHECK action and values reasoning over speed.`, tag: item.tag, repair: "Offer a choice of bar model, step cards, calculation chain or oral teach-back, then rehearse the corrected rule on one small example." });
  });
}

function variant({ id, format, blueprint, band, strand, mission, prompt, choices, answer, knowns, goal, plan, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const uniqueChoices = rotate([...new Set(choices)], fullId.length % new Set(choices).size);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: uniqueChoices,
      maths_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_plan_solve_check`,
      variant_blueprint_id: blueprint,
      review_batch: "cross-year-wave",
      visual_plan: { stages: ["KNOW", "GOAL", "PLAN", "SOLVE", "CHECK"], knowns, goal, plan, check: "estimate, inverse or reread against the goal" },
      scaffold_options: { one_step_lane_at_a_time: true, units_attached_to_numbers: true, bar_model_or_flow_diagram: true, worked_first_step_option: true, interim_result_transfer: true, calculator_not_required: true },
      response_mode: "tap_keyboard_switch_oral_or_partner_record",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, move_up_down_controls: true, undo_available: true },
      multimodal_routes: { visual: "bar model and arrowed step plan", text: "numbered calculation chain with units", oral: "say the plan before calculating", manipulative: "unpowered counters, number cards or place-value counters", reduced_load: "show one step lane while preserving the whole problem on request" },
      colour_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      mission: {
        place: mission.place,
        goal: mission.goal,
        strategic_choice: "select a route, justify its operation and choose a check before unlocking",
        reward: `add one ${mission.reward} to the shared mission map`,
        unlock_evidence: "a correct plan or check earns progress even when arithmetic needs repair",
        loss_on_error: false,
        streak_pressure: false,
        retry_message: "The route has revealed useful evidence. Keep the correct plan, repair one calculation, and continue when ready.",
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Mission route verified. ${explanation}`,
      plan_feedback: "Credit the operation structure and ordered plan independently from arithmetic accuracy.",
      arithmetic_repair: "Keep the plan fixed, locate the first calculation that changed an interim value, and repair only that step before continuing.",
      misconception_repair: repair,
      check_prompt: "Now confirm the result with an estimate, inverse calculation or full-context reread.",
    },
    difficulty: { intro: 2, developing: 4, expected: 5, secure: 7, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "step-planner" ? "step-card-order" : format === "calculation-build" ? "calculation-chain-build" : "estimate-target-check",
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected three curated variants, found ${authored.length}.`);
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
  for (const item of generated) {
    const blueprint = blueprints.get(item.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== item.format || blueprint.difficulty_band !== item.body.difficulty_band) throw new Error(`${item.id} does not match its blueprint format and band.`);
    if (!formats.has(item.format) || item.status !== "review") throw new Error(`${item.id} has unsupported format or status.`);
    if (item.body.visual_plan?.stages?.join("|") !== "KNOW|GOAL|PLAN|SOLVE|CHECK" || !item.body.visual_plan?.goal || !item.body.visual_plan?.plan?.length) throw new Error(`${item.id} lacks a useful visual plan.`);
    if (!item.body.scaffold_options?.one_step_lane_at_a_time || !item.body.scaffold_options?.units_attached_to_numbers || !item.body.multimodal_routes?.visual || !item.body.multimodal_routes?.text || !item.body.multimodal_routes?.oral || !item.body.multimodal_routes?.manipulative) throw new Error(`${item.id} lacks SEND scaffolds.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.mission?.loss_on_error !== false || item.body.mission?.streak_pressure !== false || !item.body.mission?.strategic_choice || !item.body.mission?.unlock_evidence) throw new Error(`${item.id} has unsuitable mission gamification.`);
    if (!item.feedback?.correct || !item.feedback?.plan_feedback || !item.feedback?.arithmetic_repair || !item.feedback?.misconception_repair || !item.feedback?.check_prompt || item.hints.length < 2 || item.explanation.length < 90) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.maths_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["operation_choice", "step_order", "estimation", "inverse_checking", "multi_step_contexts", "hidden_information", "efficiency", "misconceptions"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function formatNumber(value) { return Number.isInteger(value) ? value.toLocaleString("en-GB") : value.toLocaleString("en-GB", { maximumFractionDigits: 2 }); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
