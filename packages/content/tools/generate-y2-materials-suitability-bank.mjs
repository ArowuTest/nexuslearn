#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y2-materials-suitability.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y2-materials-suitability-bank-";
const reviewBatch = "y2-materials-suitability-pilot-a";
const pilotAllocation = {
  "object-material-matches": 37,
  "property-test-stations": 49,
  "suitability-design-choices": 49,
  "not-one-best-material": 37,
  "materials-retrieval": 28,
};

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y2-materials-suitability") {
  throw new Error("This generator only supports the Year 2 materials suitability pack.");
}

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAssignments = countBy(curated, curatedBlueprint);
const generatedTargets = Object.fromEntries(
  Object.entries(pilotAllocation).map(([blueprint, target]) => [blueprint, target - (curatedAssignments[blueprint] ?? 0)]),
);
for (const [blueprint, count] of Object.entries(generatedTargets)) {
  if (count < 0) throw new Error(`Curated items exceed the pilot allocation for ${blueprint}.`);
}

const candidates = [
  ...objectMaterialCandidates(generatedTargets["object-material-matches"]),
  ...propertyTestCandidates(generatedTargets["property-test-stations"]),
  ...suitabilityCandidates(generatedTargets["suitability-design-choices"]),
  ...purposeCompareCandidates(generatedTargets["not-one-best-material"]),
  ...retrievalCandidates(generatedTargets["materials-retrieval"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 2 materials pack with a deterministic 200-item pilot bank spanning object/material vocabulary, fair property-test evidence, property-based design choices, purpose-dependent suitability and spaced retrieval. Generated candidates require independent science, SEND, safeguarding, renderer and classroom review before promotion.";

validateBank(pack, curated, candidates);

const blueprintById = new Map(pack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
console.log(`y2-materials-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y2-materials-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y2-materials-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y2-materials-bank bands=${summaryByAssignedBlueprint(curated, candidates, blueprintById)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-materials-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 2 materials suitability bank is out of date; run generate-y2-materials-suitability-bank.mjs --write.");
  }
  console.log("y2-materials-bank deterministic check passed");
} else {
  console.log("y2-materials-bank dry-run; pass --write to update the pack");
}

function objectMaterialCandidates(count) {
  const examples = [
    ["key", "metal"], ["clear jar", "glass"], ["building brick", "plastic"], ["ruler", "wood"],
    ["brown shopping bag", "paper"], ["parcel box", "cardboard"], ["scarf", "wool"], ["towel", "cotton fabric"],
    ["stretchy band", "rubber"], ["mug", "ceramic"], ["shoe", "leather"], ["flowerpot", "clay"],
    ["garden ornament", "stone"], ["curtain", "fabric"], ["chair", "wood"], ["saucepan", "metal"],
    ["marble", "glass"], ["bottle", "plastic"],
  ];
  const openings = ["Open Nixi's object card.", "Open Pip's mystery drawer.", "Check Bo's maker shelf."];
  return Array.from({ length: count }, (_, index) => {
    const [object, material] = examples[index % examples.length];
    const round = Math.floor(index / examples.length);
    const choices = rotate([material, object, actionDistractor(object), propertyDistractor(material)], index % 4);
    return candidate({
      id: `${prefix}object-${slug(object)}-${round + 1}`,
      format: "property-sort",
      blueprint: "object-material-matches",
      band: "intro",
      prompt: `${openings[round]} What material is the ${object} made from?`,
      body: {
        object,
        choices,
        interaction_mode: "object-card-flip-match",
        picture_alt: `A clear picture of a ${object} without a written material label.`,
      },
      answer: material,
      hints: ["Name the object first.", "Now name what the object is made from."],
      explanation: `${sentenceStart(object)} is the object. ${sentenceStart(material)} is the material it is made from.`,
      difficulty: 2 + (round % 2),
      tag: "object_material_confusion",
      hook: "object-material-flip",
      feedback: `Look beneath the object name for the material layer: ${material}.`,
    });
  });
}

function propertyTestCandidates(count) {
  const tests = [
    test("plastic-sheet-water", "plastic sheet", "water-drop test", "Drops stay on the surface.", "waterproof", ["not waterproof", "transparent"]),
    test("glass-pane-water", "glass pane", "water-drop test", "Drops stay on the surface.", "waterproof", ["absorbent", "flexible"]),
    test("paper-water", "paper", "water-drop test", "Water soaks in and the paper becomes soggy.", "not waterproof", ["waterproof", "strong"]),
    test("cotton-water", "cotton fabric", "water-drop test", "Water soaks into the fibres.", "not waterproof", ["waterproof", "transparent"]),
    test("rubber-bend", "rubber band", "gentle bend test", "It bends and returns to its shape.", "flexible", ["rigid", "transparent"]),
    test("fabric-bend", "fabric", "gentle fold test", "It folds easily without breaking.", "flexible", ["rigid", "waterproof"]),
    test("wood-bend", "wooden block", "gentle bend test", "It keeps its shape and does not bend.", "rigid", ["flexible", "transparent"]),
    test("spoon-bend", "metal spoon", "gentle bend test", "It keeps its shape during the safe test.", "rigid", ["flexible", "absorbent"]),
    test("glass-light", "clear glass", "light-and-shape test", "The shape can be seen clearly through it.", "transparent", ["opaque", "flexible"]),
    test("plastic-light", "clear plastic", "light-and-shape test", "The shape can be seen clearly through it.", "transparent", ["opaque", "absorbent"]),
    test("card-light", "cardboard", "light-and-shape test", "The shape cannot be seen through it.", "opaque", ["transparent", "waterproof"]),
    test("wood-light", "wood", "light-and-shape test", "The shape cannot be seen through it.", "opaque", ["transparent", "flexible"]),
    test("metal-load", "metal strip", "small-load test", "It holds the test blocks without changing shape.", "strong for this job", ["not strong for this job", "absorbent"]),
    test("wood-load", "thick wooden strip", "small-load test", "It holds the test blocks without breaking.", "strong for this job", ["not strong for this job", "transparent"]),
    test("tissue-load", "tissue paper", "small-load test", "It tears under the first test block.", "not strong for this job", ["strong for this job", "rigid"]),
    test("thin-paper-load", "thin paper", "small-load test", "It crumples and cannot support the test blocks.", "not strong for this job", ["strong for this job", "waterproof"]),
  ];
  const stations = ["Nixi's rain lab", "Pip's bend bench", "Bo's light booth"];
  return Array.from({ length: count }, (_, index) => {
    const item = tests[index % tests.length];
    const round = Math.floor(index / tests.length);
    const choices = rotate([item.conclusion, ...item.distractors], index % 3);
    return candidate({
      id: `${prefix}test-${item.id}-${round + 1}`,
      format: "material-test",
      blueprint: "property-test-stations",
      band: "developing",
      prompt: `${stations[round]} tests ${item.material}. What does the evidence show?`,
      body: {
        material: item.material,
        test: item.test,
        observation_after_test: item.observation,
        observation_reveal: "after_prediction",
        choices,
        interaction_mode: "predict-test-observe-explain",
        test_safety: "simulated_age_safe",
      },
      answer: item.conclusion,
      hints: ["Watch what changes and what stays the same.", `Use this observation: ${item.observation}`],
      explanation: `${item.observation} This evidence shows that ${item.material} is ${item.conclusion}.`,
      difficulty: 3 + (round % 2),
      tag: "test_evidence_ignored",
      hook: propertyHook(item.conclusion),
      feedback: `Match the conclusion to the observed result, not to how the material looks before testing.`,
    });
  });
}

function suitabilityCandidates(count) {
  const designs = [
    design("raincoat", "a raincoat", "keep rain out", "plastic sheet", "waterproof", ["tissue paper", "cotton wool"]),
    design("towel", "a towel", "soak up water", "cotton fabric", "absorbent", ["glass", "metal"]),
    design("window", "a playhouse window", "let people see through", "clear plastic", "transparent", ["cardboard", "wood"]),
    design("chair", "a chair leg", "hold weight without bending", "wood", "strong and rigid", ["tissue paper", "cotton wool"]),
    design("umbrella", "an umbrella cover", "keep rain out", "waterproof fabric", "waterproof", ["paper", "cotton wool"]),
    design("book-page", "a page for drawing", "take pencil marks and turn easily", "paper", "light and easy to mark", ["glass", "stone"]),
    design("jumper", "a warm jumper", "bend with the body and help keep warm", "wool fabric", "flexible and insulating", ["glass", "metal sheet"]),
    design("bottle", "a reusable drinks bottle", "hold water without soaking through", "plastic", "waterproof", ["paper", "cotton fabric"]),
    design("spade", "a small garden spade blade", "push through soil without bending", "metal", "strong and rigid", ["tissue paper", "wool"]),
    design("parcel", "a light parcel box", "hold its shape and fold into a box", "cardboard", "stiff but foldable", ["glass", "cotton wool"]),
    design("greenhouse", "a model greenhouse panel", "let light through and keep rain out", "clear plastic", "transparent and waterproof", ["wood", "fabric"]),
    design("oven-glove", "a pretend-design oven glove", "slow heat reaching a hand", "thick fabric", "insulating", ["thin metal", "clear glass"]),
    design("curtain", "a curtain", "hang and fold across a window", "fabric", "flexible", ["stone", "glass"]),
    design("table-cover", "a wipe-clean table cover", "stop spills reaching the table", "plastic sheet", "waterproof", ["tissue paper", "cotton wool"]),
    design("path", "a garden stepping stone", "stay hard under feet", "stone", "hard and strong", ["fabric", "paper"]),
    design("mug", "a reusable mug", "hold a drink and keep its shape", "ceramic", "rigid and waterproof", ["paper tissue", "cotton wool"]),
  ];
  const missions = ["Maker mission", "Story workshop challenge", "Design badge task"];
  return Array.from({ length: count }, (_, index) => {
    const item = designs[index % designs.length];
    const round = Math.floor(index / designs.length);
    const correct = `${sentenceStart(item.material)} because it is ${item.property}.`;
    const choices = rotate([
      correct,
      `${sentenceStart(item.distractors[0])} because its colour is exciting.`,
      `${sentenceStart(item.distractors[1])} because every material works for every job.`,
    ], index % 3);
    return candidate({
      id: `${prefix}design-${item.id}-${round + 1}`,
      format: "explain-choice",
      blueprint: "suitability-design-choices",
      band: "expected",
      prompt: `${missions[round]}: make ${item.use}. It must ${item.need}. Which choice uses evidence?`,
      body: {
        design_use: item.use,
        design_need: item.need,
        material_choices: [item.material, ...item.distractors],
        choices,
        interaction_mode: "design-card-and-because-choice",
      },
      answer: correct,
      hints: ["Say what the design must do.", "Choose the statement that names a useful property."],
      explanation: `${sentenceStart(item.material)} is suitable for ${item.use} because it is ${item.property}.`,
      difficulty: 4 + (round % 2),
      tag: "appearance_choice",
      hook: "design-choice-lock",
      feedback: `A strong explanation links the job (${item.need}) to a tested property (${item.property}).`,
    });
  });
}

function purposeCompareCandidates(count) {
  const comparisons = [
    compare("glass", "a window", "transparent", "a cushion", "hard and rigid"),
    compare("metal", "a saucepan", "strong and keeps its shape", "a bath towel", "not absorbent or soft"),
    compare("plastic sheet", "a rain cover", "waterproof", "an oven glove", "does not safely insulate a hand from heat"),
    compare("cotton fabric", "a towel", "absorbent", "a rain roof", "soaks up water"),
    compare("rubber", "an elastic band", "flexible", "a clear window", "not transparent"),
    compare("wood", "a chair leg", "strong and rigid", "a window pane", "not transparent"),
    compare("paper", "a drawing page", "light and easy to mark", "a raincoat", "not waterproof"),
    compare("cardboard", "a parcel box", "stiff and foldable", "a drinks bottle", "not waterproof"),
    compare("wool", "a warm scarf", "flexible and insulating", "a saucepan", "not rigid for this job"),
    compare("ceramic", "a mug", "rigid and waterproof", "a football", "not flexible or bouncy"),
    compare("leather", "a shoe upper", "tough and flexible", "a clear lens", "not transparent"),
    compare("stone", "a path", "hard and strong", "a blanket", "not soft or flexible"),
    compare("clay", "a flowerpot", "rigid when fired", "a skipping rope", "not flexible"),
    compare("fabric", "a curtain", "flexible", "a ruler", "does not stay rigid"),
    compare("aluminium foil", "wrapping food", "flexible and waterproof", "a bath towel", "not absorbent"),
    compare("clear plastic", "safety-goggle lenses", "transparent and tough", "a blanket", "not soft or insulating"),
    compare("steel", "a key", "hard and strong", "a sponge", "not soft or absorbent"),
    compare("foam", "a cushion filling", "soft and squashy", "a bridge support", "not rigid enough"),
    compare("cork", "a noticeboard", "soft enough for pins", "a cooking pan", "not suitable for direct heating"),
  ];
  const companions = ["Nixi", "Pip", "Bo"];
  return Array.from({ length: count }, (_, index) => {
    const item = comparisons[index % comparisons.length];
    const round = Math.floor(index / comparisons.length);
    const correct = `Use ${item.material} for ${item.goodUse} because it is ${item.goodProperty}.`;
    const choices = rotate([
      correct,
      `Use ${item.material} for ${item.badUse} because one material is best for every job.`,
      `Never use ${item.material}; materials are either always good or always bad.`,
    ], index % 3);
    return candidate({
      id: `${prefix}purpose-${slug(item.material)}-${round + 1}`,
      format: "material-test",
      blueprint: "not-one-best-material",
      band: "secure",
      prompt: `${companions[round]} tests ${item.material} for two jobs. Which conclusion uses the evidence correctly?`,
      body: {
        material: item.material,
        test_cards: [
          { use: item.goodUse, evidence: item.goodProperty },
          { use: item.badUse, evidence: item.limitation },
        ],
        choices,
        interaction_mode: "two-purpose-evidence-compare",
      },
      answer: correct,
      hints: ["A material can suit one job but not another.", "Match each property or limitation to what the job needs."],
      explanation: `${sentenceStart(item.material)} suits ${item.goodUse} because it is ${item.goodProperty}, but it is less suitable for ${item.badUse} because it is ${item.limitation}.`,
      difficulty: 5 + (round % 2),
      tag: "one_material_always_best",
      hook: "two-job-test-compare",
      feedback: `Judge the material for each purpose; do not label it as always good or always bad.`,
    });
  });
}

function retrievalCandidates(count) {
  const facts = [
    ["plastic sheet", "a rain cover", "waterproof"], ["clear glass", "a window", "transparent"],
    ["cotton fabric", "a towel", "absorbent"], ["rubber", "an elastic band", "flexible"],
    ["wood", "a chair leg", "strong and rigid"], ["paper", "a drawing page", "easy to mark"],
    ["cardboard", "a parcel box", "stiff and foldable"], ["wool fabric", "a scarf", "flexible and insulating"],
    ["metal", "a spade blade", "strong and rigid"], ["clear plastic", "goggle lenses", "transparent"],
    ["ceramic", "a mug", "rigid and waterproof"], ["stone", "a path", "hard and strong"],
    ["fabric", "a curtain", "flexible"], ["foam", "a cushion", "soft and squashy"],
  ];
  return Array.from({ length: count }, (_, index) => {
    const [material, use, property] = facts[index % facts.length];
    const round = Math.floor(index / facts.length);
    const correct = `It is ${property}.`;
    const choices = rotate([correct, "Its colour is the nicest.", "It is best for every possible job."], index % 3);
    const prompt = round === 0
      ? `Quick badge check: why can ${material} be suitable for ${use}?`
      : `Review card: complete the evidence sentence for ${material} used as ${use}.`;
    return candidate({
      id: `${prefix}retrieval-${slug(material)}-${round + 1}`,
      format: "explain-choice",
      blueprint: "materials-retrieval",
      band: "retrieval",
      prompt,
      body: {
        material,
        use,
        choices,
        interaction_mode: "quick-picture-supported-retrieval",
        retrieval_round: round + 1,
      },
      answer: correct,
      hints: ["Think about what the job needs.", "Choose a tested property, not an opinion about appearance."],
      explanation: `${sentenceStart(material)} can suit ${use} because it is ${property}.`,
      difficulty: 3 + round,
      tag: "property_use_mismatch",
      hook: "property-link-recall",
      feedback: `The useful evidence is the property: ${property}.`,
    });
  });
}

function candidate({ id, format, blueprint, band, prompt, body, answer, hints, explanation, difficulty, tag, hook, feedback }) {
  return {
    id,
    format,
    body: {
      prompt,
      ...body,
      response_mode: "tap_keyboard_switch_or_oral",
      audio_replay: true,
      static_evidence_panel: true,
      reduced_motion: "instant_state_change",
      no_timer: true,
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: "Evidence matched: the property supports the job or conclusion.",
      repair: feedback,
    },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected to preserve 3 curated variants, found ${authored.length}.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) {
    throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} pilot variants, found ${currentPack.question_variants.length}.`);
  }
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint) throw new Error(`${variant.id} is not linked to an existing blueprint.`);
    if (variant.format !== blueprint.format) throw new Error(`${variant.id} format does not match ${blueprint.id}.`);
    if (variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} does not use its blueprint difficulty band.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || variant.body.static_evidence_panel !== true || variant.body.no_timer !== true) {
      throw new Error(`${variant.id} is missing a SEND access route.`);
    }
    const choices = variant.body.choices;
    const choiceKeys = choices.map((choice) => JSON.stringify(choice));
    if (new Set(choiceKeys).size !== choices.length) throw new Error(`${variant.id} repeats a choice.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) {
      throw new Error(`${variant.id} must offer exactly one deterministic answer.`);
    }
    if (normalise(variant.body.prompt).includes(normalise(String(variant.expected_answer.value)))) {
      throw new Error(`${variant.id} leaks its answer in the prompt.`);
    }
    if (variant.body.prompt.length > 130) throw new Error(`${variant.id} prompt is too long for Year 2.`);
  }
  const allocation = combinedAllocation(authored, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) {
    if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected} items, found ${allocation[blueprint] ?? 0}.`);
  }
}

function curatedBlueprint(variant) {
  if (variant.id === "sc-y2-materials-suitability-q-object-material") return "object-material-matches";
  if (variant.id === "sc-y2-materials-suitability-q-roof") return "property-test-stations";
  if (variant.id === "sc-y2-materials-suitability-q-window") return "suitability-design-choices";
  throw new Error(`No preserved blueprint assignment for curated variant ${variant.id}.`);
}

function combinedAllocation(authored, generated) {
  const counts = countBy(authored, curatedBlueprint);
  for (const variant of generated) {
    const blueprint = variant.body.variant_blueprint_id;
    counts[blueprint] = (counts[blueprint] ?? 0) + 1;
  }
  return counts;
}

function allocationSummary(authored, generated) {
  return Object.entries(combinedAllocation(authored, generated)).sort().map(([key, count]) => `${key}:${count}`).join(",");
}

function summaryByAssignedBlueprint(authored, generated, blueprints) {
  const assigned = [
    ...authored.map((variant) => ({ blueprint: curatedBlueprint(variant) })),
    ...generated.map((variant) => ({ blueprint: variant.body.variant_blueprint_id })),
  ];
  return summary(assigned, (item) => blueprints.get(item.blueprint).difficulty_band);
}

function test(id, material, testName, observation, conclusion, distractors) {
  return { id, material, test: testName, observation, conclusion, distractors };
}

function design(id, use, need, material, property, distractors) {
  return { id, use, need, material, property, distractors };
}

function compare(material, goodUse, goodProperty, badUse, limitation) {
  return { material, goodUse, goodProperty, badUse, limitation };
}

function propertyHook(conclusion) {
  if (conclusion.includes("waterproof")) return "waterproof-compare";
  if (conclusion.includes("transparent") || conclusion === "opaque") return "transparency-test";
  if (conclusion.includes("flexible") || conclusion === "rigid") return "bend-test-reveal";
  return "small-load-test-reveal";
}

function actionDistractor(object) {
  if (object.includes("bottle") || object.includes("mug") || object.includes("jar")) return "holding";
  if (object.includes("chair")) return "sitting";
  return "using";
}

function propertyDistractor(material) {
  if (["glass", "plastic"].includes(material)) return "shiny";
  if (["wool", "cotton fabric", "fabric"].includes(material)) return "soft";
  return "round";
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sentenceStart(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function rotate(items, amount) {
  const offset = amount % items.length;
  return items.slice(offset).concat(items.slice(0, offset));
}

function countBy(items, keyFor) {
  const counts = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summary(items, keyFor) {
  return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
