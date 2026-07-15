#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y3-light.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y3-light-bank-";
const reviewBatch = "y3-light-pilot-a";
const pilotAllocation = {
  "source-object-eye-paths": 44,
  "darkness-and-source-classification": 44,
  "surface-reflection-evidence": 44,
  "shadow-formation-and-size-patterns": 44,
  "safe-light-spaced-retrieval": 44,
};

const seeingScenes = [
  ["desk-book", "switched-on desk lamp", "book", "Asha", "reading corner"],
  ["torch-map", "switched-on virtual torch", "map", "Ben", "classroom model"],
  ["window-poster", "daylight through a window", "poster", "Cleo", "hall"],
  ["ceiling-shell", "switched-on ceiling light", "shell", "Dev", "museum room"],
  ["lantern-sign", "switched-on electric lantern", "sign", "Eloise", "indoor camp model"],
  ["tablet-card", "lit tablet screen", "instruction card", "Farah", "technology table"],
  ["lightbox-leaf", "switched-on light box", "leaf", "Gus", "science room"],
  ["lamp-model", "switched-on floor lamp", "model bridge", "Hana", "design studio"],
  ["display-coin", "switched-on display light", "coin", "Idris", "gallery"],
  ["wall-clock", "switched-on wall light", "clock", "Jaya", "library"],
  ["cabinet-fossil", "switched-on cabinet light", "fossil", "Kofi", "collection room"],
].map(([id, source, object, observer, setting]) => ({ id, source, object, observer, setting }));

const classifications = [
  ["sun", "the Sun", true, "gives out its own light"],
  ["lamp", "a switched-on lamp", true, "uses electrical energy to give out light"],
  ["screen", "a lit display screen", true, "gives out light when switched on"],
  ["electric-lantern", "a switched-on electric lantern", true, "gives out its own light when switched on"],
  ["moon", "the Moon", false, "is seen because it reflects light from the Sun"],
  ["mirror", "a mirror", false, "reflects light that reaches its surface"],
  ["white-card", "white card", false, "reflects some light into the eye"],
  ["road-sign", "a reflective road sign", false, "returns light from another source"],
  ["bicycle-reflector", "a bicycle reflector", false, "reflects light from lamps"],
  ["book", "a book", false, "is visible when light reflects from it"],
  ["foil", "a sheet of foil", false, "reflects light but does not make its own"],
].map(([id, item, source, evidence]) => ({ id, item, source, evidence }));

const reflectionTests = [
  ["mirror-card", "clean mirror", "white card", "dark fabric", "strong and directed", "moderate and spread", "low"],
  ["foil-paper", "smooth foil", "cream paper", "black felt", "strong and directed", "moderate and spread", "low"],
  ["tile-cork", "glazed tile", "pale cork", "dark cork", "high", "moderate", "low"],
  ["metal-wood", "polished metal", "light wood", "dark rough wood", "high and directed", "moderate and spread", "low"],
  ["plastic-card", "shiny plastic", "yellow card", "navy cloth", "high", "moderate", "low"],
  ["glass-paper", "glass with a reflective backing", "plain paper", "charcoal fabric", "strong and directed", "moderate and spread", "low"],
  ["badge-wall", "reflective badge", "painted wall", "dark curtain", "high and directed", "moderate and spread", "low"],
  ["tray-board", "shiny tray", "matte board", "black foam", "high", "moderate", "low"],
  ["wrapper-card", "smooth silver wrapper", "blue card", "brown felt", "strong and directed", "moderate and spread", "low"],
  ["steel-paper", "polished steel", "recycled paper", "dark wool", "high", "moderate and spread", "low"],
  ["ceramic-fabric", "glossy ceramic", "pale fabric", "black fabric", "high", "moderate", "low"],
].map(([id, first, second, third, firstReading, secondReading, thirdReading]) => ({ id, surfaces: [{ name: first, reading: firstReading }, { name: second, reading: secondReading }, { name: third, reading: thirdReading }] }));

const shadowSetups = [
  ["owl", "card owl", 4, 60, 20, 30, "tracing paper", "clear plastic"],
  ["tree", "wooden tree", 5, 75, 25, 50, "thin tissue", "clear acrylic"],
  ["boat", "card boat", 6, 72, 24, 36, "waxed paper", "clear plastic"],
  ["tower", "wooden tower", 4, 80, 20, 40, "tracing paper", "clear acetate"],
  ["rabbit", "card rabbit", 5, 90, 30, 45, "thin fabric", "clear acrylic"],
  ["leaf", "opaque leaf shape", 6, 84, 28, 42, "tissue paper", "clear plastic"],
  ["bridge", "card bridge", 8, 96, 24, 48, "tracing paper", "clear acetate"],
  ["shell", "wooden shell shape", 5, 70, 20, 35, "waxed paper", "clear acrylic"],
  ["castle", "card castle", 7, 84, 21, 42, "thin cloth", "clear plastic"],
  ["bird", "opaque bird shape", 4, 72, 18, 36, "tissue paper", "clear acetate"],
  ["train", "wooden train shape", 6, 90, 30, 45, "tracing paper", "clear acrylic"],
].map(([id, object, width, screenDistance, nearDistance, farDistance, translucent, transparent]) => ({ id, object, width, screenDistance, nearDistance, farDistance, translucent, transparent }));

const safetyCases = [
  ["stick-shadow", "Measure a stick's shadow while facing the ground and away from the Sun", "look directly at the Sun", "A shadow can be measured without viewing the Sun"],
  ["teacher-data", "Use a teacher-provided table of shadow lengths", "try to check the Sun through sunglasses", "Recorded shadow data avoids direct Sun viewing"],
  ["virtual-path", "Use the virtual light-path model", "shine a bright lamp towards someone's face", "The virtual model shows the path without exposing eyes to bright light"],
  ["lamp-off", "Switch the classroom lamp off before an adult moves the setup", "move a bright lamp while staring into it", "Switching off the source prevents accidental bright-light viewing"],
  ["screen-observation", "Observe the shadow on a screen with the lamp kept below face level", "place an eye in the beam to test whether light arrives", "The screen provides evidence without putting eyes in the beam"],
  ["photo-study", "Study a teacher-selected photograph of a safe shadow investigation", "point a camera at the Sun and use its viewfinder", "A prepared image can be studied without aiming an optical device at the Sun"],
  ["shade", "Move into shade and compare how easy objects are to see", "look at the Sun to decide how bright it is", "Visibility can be compared without direct Sun viewing"],
  ["reflected-bar", "Read the value on a virtual reflected-light bar", "aim reflected sunlight towards a person's eyes", "A virtual reading provides evidence without a hazardous beam"],
  ["before-after", "Compare labelled before-and-after shadow diagrams", "use dark plastic as a homemade Sun filter", "Diagrams show the pattern without unsafe improvised filters"],
  ["adult-check", "Ask an adult to check that an electric lamp is cool, stable and aimed at the screen", "touch or reposition an unchecked bright lamp", "An adult safety check reduces heat, stability and beam risks"],
  ["window", "Notice daylight on the floor while keeping eyes away from the Sun", "stare through the window at the Sun", "Indirect daylight observations do not require looking at the Sun"],
].map(([id, safe, unsafe, reason]) => ({ id, safe, unsafe, reason }));

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y3-light") throw new Error("This generator only supports the Year 3 light pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...sourcePathCandidates(targets["source-object-eye-paths"]),
  ...classificationCandidates(targets["darkness-and-source-classification"]),
  ...reflectionCandidates(targets["surface-reflection-evidence"]),
  ...shadowCandidates(targets["shadow-formation-and-size-patterns"]),
  ...safetyCandidates(targets["safe-light-spaced-retrieval"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 3 light pack with a deterministic 220-item pilot bank and four preserved curated variants. Progression covers light sources, source-object-eye paths, darkness as insufficient light, reflection from varied surfaces, opacity, shadow formation and size, one-variable fair tests, indirect sunlight observation and eye safety. Generated candidates include SEND, dyslexia, visual, tactile and text alternatives, supported interactions, low-pressure feedback and explicit safety boundaries. Independent science, teacher, accessibility, safeguarding and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y3-light-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y3-light-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y3-light-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y3-light-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y3-light-bank coverage=${summaryCoverage(candidates)}`);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-light-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 light bank is out of date; run generate-y3-light-bank.mjs --write.");
  console.log("y3-light-bank deterministic check passed");
} else {
  console.log("y3-light-bank dry-run; pass --write to update the pack");
}

function sourcePathCandidates(count) {
  const variants = [];
  for (const scene of seeingScenes) {
    const path = `${scene.source} to ${scene.object} to ${scene.observer}'s eye`;
    const modes = [
      {
        id: "order", stage: "order_source_object_eye", prompt: `In the ${scene.setting}, which path lets ${scene.observer} see the ${scene.object}?`, expected: path,
        choices: [path, `${scene.observer}'s eye to ${scene.object} to ${scene.source}`, `${scene.object} to ${scene.source} to ${scene.observer}'s eye`, `${scene.source} straight to ${scene.observer}'s eye without reaching the ${scene.object}`],
        hints: ["Start with the item that gives out light.", `The light must reach the ${scene.object}, reflect and then enter the eye.`],
        explanation: `Light travels from the ${scene.source} to the ${scene.object}. Some reflects from the ${scene.object} and enters ${scene.observer}'s eye.`, purpose: "seeing_path_order",
      },
      {
        id: "off", stage: "compare_source_on_and_off", prompt: `The ${scene.source} is switched off and no other light reaches the ${scene.object}. Which observation fits the model?`, expected: `${scene.observer} cannot see the ${scene.object} because no light from a source reaches it and reflects into the eye`,
        choices: [`${scene.observer} cannot see the ${scene.object} because no light from a source reaches it and reflects into the eye`, `${scene.observer} can see because eyes make their own light`, `Darkness covers the ${scene.object} like a material`, `The ${scene.object} stores enough light forever`],
        hints: ["Check whether any light source is on.", "Eyes receive light; they do not send out a seeing beam."],
        explanation: `With the stated source off and no other light, there is no complete source-${scene.object}-eye path, so the object cannot be seen in this model.`, purpose: "source_off_visibility",
      },
      {
        id: "missing", stage: "complete_reflected_path", prompt: `Light reaches the ${scene.object} from the ${scene.source}. What must happen next for ${scene.observer} to see it?`, expected: `Some light must reflect from the ${scene.object} into ${scene.observer}'s eye`,
        choices: [`Some light must reflect from the ${scene.object} into ${scene.observer}'s eye`, `${scene.observer}'s eye must send light to the ${scene.object}`, `Darkness must travel out of the ${scene.object}`, `The ${scene.object} must become a light source`],
        hints: ["The source-to-object part is already complete.", "Finish the path at the eye."],
        explanation: `The seeing path is completed when reflected light from the ${scene.object} enters ${scene.observer}'s eye. The object does not need to produce light.`, purpose: "reflected_light_to_eye",
      },
      {
        id: "eye", stage: "repair_eye_beam_misconception", prompt: `${scene.observer} says, 'My eyes send light to the ${scene.object}.' Which correction is accurate?`, expected: `Eyes receive light that has reflected from the ${scene.object}`,
        choices: [`Eyes receive light that has reflected from the ${scene.object}`, `Eyes send an invisible beam only in dark places`, `The ${scene.object} sends darkness into the eye`, `Seeing does not need any light source`],
        hints: ["Use arrows ending at the eye.", "A source gives out light; an eye detects arriving light."],
        explanation: `Eyes are receivers in this model. Light from the ${scene.source} reaches the object, reflects, and then enters the eye.`, purpose: "eyes_receive_light",
      },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}path-${scene.id}-${mode.id}`, format: "light-path-model", blueprint: "source-object-eye-paths", misconception: "eyes_emit_light", animation: "source-object-eye-path", coverage: ["light_path", "light_needed", "misconception"], body: { scene, source_state: mode.id === "off" ? "off" : "on", path_text: path } }));
  }
  return variants.slice(0, count);
}

function classificationCandidates(count) {
  const variants = [];
  for (const item of classifications) {
    const correctClass = item.source ? "light source" : "reflector or illuminated object";
    const oppositeClass = item.source ? "reflector only" : "light source";
    const modes = [
      {
        id: "classify", stage: "classify_source_or_reflector", prompt: `Classify ${item.item}. Which description is accurate?`, expected: `${item.item} is a ${correctClass}`,
        choices: [`${item.item} is a ${correctClass}`, `${item.item} is a ${oppositeClass}`, `${item.item} is darkness`, `${item.item} can only be seen because eyes shine on it`],
        hints: ["Ask whether the item gives out its own light.", item.evidence], explanation: `${capitalise(item.item)} ${item.evidence}, so it is classified as a ${correctClass}.`, purpose: "source_reflector_classification",
      },
      {
        id: "evidence", stage: "use_source_evidence", prompt: `Which evidence best supports the classification of ${item.item}?`, expected: item.evidence,
        choices: [item.evidence, "it looks bright in a drawing", "its name contains a long word", "eyes send light towards it"],
        hints: ["Choose evidence about making or reflecting light.", "Appearance alone does not show whether an item produces light."], explanation: `${capitalise(item.evidence)}. That evidence distinguishes a source from an object that reflects light.`, purpose: "classification_evidence",
      },
      {
        id: "dark", stage: "explain_darkness_as_absence", prompt: `${item.item} is in a sealed model room with every source off. Why is the model room dark?`, expected: "There is not enough light reaching objects and reflecting into an eye",
        choices: ["There is not enough light reaching objects and reflecting into an eye", "Darkness has poured into the room", "The objects have stopped existing", "The eye has used up its light"],
        hints: ["Describe what is absent rather than adding a dark substance.", "Check whether any source is providing light."], explanation: "Darkness is the absence of enough light for seeing; it is not a material that moves into the room.", purpose: "darkness_absence_of_light",
      },
      {
        id: "visible", stage: "connect_visibility_to_reflection", prompt: `${item.item} can be seen in a lit room. Which statement must fit the light model?`, expected: item.source ? `Some light from ${item.item} enters the eye` : `Some light from another source reflects from ${item.item} into the eye`,
        choices: [item.source ? `Some light from ${item.item} enters the eye` : `Some light from another source reflects from ${item.item} into the eye`, "The eye lights the room", "Darkness makes the item visible", item.source ? `${item.item} only reflects and gives out no light` : `${item.item} must make its own light`],
        hints: ["End the path at the eye.", item.source ? "This item is a source." : "This item needs light from another source."], explanation: item.source ? `${capitalise(item.item)} gives out light, and seeing occurs when light reaches the eye.` : `${capitalise(item.item)} does not make its own light; reflected light from another source reaches the eye.`, purpose: "visibility_source_or_reflection",
      },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}classification-${item.id}-${mode.id}`, format: "evidence-explain", blueprint: "darkness-and-source-classification", misconception: mode.id === "dark" ? "darkness_as_substance" : "eyes_emit_light", animation: "source-reflector-sort", coverage: [item.source ? "light_source" : "reflector", "darkness", "misconception"], body: { item: item.item, gives_out_own_light: item.source, classification_evidence: item.evidence } }));
  }
  return variants.slice(0, count);
}

function reflectionCandidates(count) {
  const variants = [];
  for (const test of reflectionTests) {
    const [high, medium, low] = test.surfaces;
    const observations = test.surfaces.map((surface) => ({ surface: surface.name, reflected_light_observation: surface.reading }));
    const modes = [
      {
        id: "compare", stage: "compare_reflected_light", prompt: "A virtual lamp and sensor stay fixed. Which conclusion fits the three observations?", expected: `All three surfaces reflect some light; ${high.name} gives the strongest recorded reflection in this setup`,
        choices: [`All three surfaces reflect some light; ${high.name} gives the strongest recorded reflection in this setup`, `Only ${high.name} reflects any light`, `${low.name} stores all the light`, `${medium.name} becomes a light source`],
        hints: ["Use all three recorded observations.", "A low reflection is still some reflection in this model."], explanation: `The observations are ${high.reading}, ${medium.reading} and ${low.reading}. They support a relative comparison for this setup, not a claim that only shiny surfaces reflect.`, purpose: "reflection_comparison",
      },
      {
        id: "fair", stage: "plan_fair_reflection_test", prompt: `Which plan fairly compares reflection from ${high.name}, ${medium.name} and ${low.name}?`, expected: "Keep the virtual lamp, sensor angle and distance fixed; change only the surface",
        choices: ["Keep the virtual lamp, sensor angle and distance fixed; change only the surface", "Change the surface, lamp distance and sensor angle together", "Use a different brightness for every surface", "Judge only by which surface name sounds shiny"],
        hints: ["A fair comparison changes one variable.", "Keep the source and measuring position fixed."], explanation: "Changing only the surface means differences in the recorded observation can be linked to the tested surface in this model.", purpose: "reflection_fair_test",
      },
      {
        id: "ordinary", stage: "repair_mirror_only_misconception", prompt: `${medium.name} is visible under the virtual lamp. What does this show?`, expected: `${medium.name} reflects some light into the sensor or eye even though it is not a mirror`,
        choices: [`${medium.name} reflects some light into the sensor or eye even though it is not a mirror`, "Only mirrors reflect, so the observation must be ignored", `${medium.name} stores light and becomes a source`, "Eyes send light onto every ordinary surface"],
        hints: ["Use the moderate observation.", "Visible non-luminous objects reflect some arriving light."], explanation: `${capitalise(medium.name)} gives a ${medium.reading} observation, showing that ordinary non-mirror surfaces can reflect some light.`, purpose: "ordinary_surface_reflection",
      },
      {
        id: "evidence", stage: "select_reflection_evidence", prompt: `Which evidence best supports the claim that ${high.name} reflected more light than ${low.name} in this test?`, expected: `The sensor recorded '${high.reading}' for ${high.name} and '${low.reading}' for ${low.name}`,
        choices: [`The sensor recorded '${high.reading}' for ${high.name} and '${low.reading}' for ${low.name}`, `${high.name} has the more interesting name`, `${low.name} must absorb every ray`, "The surfaces were tested on different days with different lamps"],
        hints: ["Choose the paired observation from the same setup.", "Avoid an absolute claim that the data do not show."], explanation: `The paired sensor descriptions directly compare the two surfaces under the same virtual conditions.`, purpose: "reflection_evidence_selection",
      },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}reflection-${test.id}-${mode.id}`, format: "reflection-test", blueprint: "surface-reflection-evidence", misconception: "only_mirrors_reflect", animation: "surface-reflection-test", coverage: ["reflection", "fair_test", "evidence", "misconception"], body: { observations, changed_variable: "surface", controlled_variables: ["virtual lamp brightness", "lamp distance", "sensor position", "surface area"] } }));
  }
  return variants.slice(0, count);
}

function shadowCandidates(count) {
  const variants = [];
  for (const setup of shadowSetups) {
    const nearSize = shadowSize(setup.width, setup.screenDistance, setup.nearDistance);
    const farSize = shadowSize(setup.width, setup.screenDistance, setup.farDistance);
    const modes = [
      {
        id: "form", stage: "identify_shadow_components", prompt: `Which arrangement makes a clear shadow of the ${setup.object} on a screen?`, expected: `switched-on lamp, then opaque ${setup.object}, then screen`,
        choices: [`switched-on lamp, then opaque ${setup.object}, then screen`, `screen, then switched-off lamp, with no object`, `eye, then ${setup.transparent}, then lamp`, `opaque ${setup.object} with no light source or screen`],
        hints: ["A shadow needs light, a blocker and a receiving surface.", "Put the opaque object between the source and screen."], explanation: `The switched-on lamp supplies light, the opaque ${setup.object} blocks part of it, and the screen receives the darker region called a shadow.`, purpose: "shadow_formation",
      },
      {
        id: "opacity", stage: "compare_opacity_and_shadow", prompt: `The same lamp and screen test opaque ${setup.object}, ${setup.translucent} and ${setup.transparent}. Which makes the clearest shadow?`, expected: `the opaque ${setup.object}, because it blocks the most light`,
        choices: [`the opaque ${setup.object}, because it blocks the most light`, `${setup.transparent}, because transparent means blocks all light`, `${setup.translucent}, because it is a light source`, "all three always make identical shadows"],
        hints: ["Opaque means light does not pass through.", "Transparent materials let most light pass; translucent materials let some through."], explanation: `The opaque ${setup.object} blocks the most light and therefore makes the clearest shadow in this comparison.`, purpose: "opacity_shadow_comparison",
      },
      {
        id: "size", stage: "interpret_shadow_size_pattern", prompt: `The screen stays ${setup.screenDistance} cm from a small virtual lamp. The ${setup.object} moves from ${setup.nearDistance} cm to ${setup.farDistance} cm from the lamp. What pattern does the table show?`, expected: `The shadow becomes smaller as the object moves farther from the lamp and closer to the screen`,
        choices: [`The shadow becomes smaller as the object moves farther from the lamp and closer to the screen`, "The shadow becomes larger because the object itself grows", "No shadow can form after the move", "The shadow stays the same in every arrangement"],
        hints: [`Compare ${nearSize} cm with ${farSize} cm.`, "The object's width stays fixed; only its position changes."], explanation: `The measured shadow changes from ${nearSize} cm to ${farSize} cm while the ${setup.object} remains ${setup.width} cm wide. The position changed, not the object.`, purpose: "shadow_size_measurement_pattern",
      },
      {
        id: "fair", stage: "plan_fair_shadow_test", prompt: `Which plan fairly tests how the ${setup.object}'s distance from the lamp affects shadow size?`, expected: `Move only the object; keep the lamp, screen and object size fixed; measure the shadow each time`,
        choices: [`Move only the object; keep the lamp, screen and object size fixed; measure the shadow each time`, "Move the lamp, object and screen and change the object size together", "Use a different object and estimate without measuring", "Change from opaque card to clear plastic during the distance test"],
        hints: ["Change only the object-to-lamp distance.", "Keep the source, screen and object dimensions controlled."], explanation: "Changing one distance while controlling the other parts makes the before-and-after shadow measurements a fair comparison.", purpose: "shadow_fair_test",
      },
    ];
    const results = [{ object_distance_cm: setup.nearDistance, object_width_cm: setup.width, shadow_width_cm: nearSize }, { object_distance_cm: setup.farDistance, object_width_cm: setup.width, shadow_width_cm: farSize }];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}shadow-${setup.id}-${mode.id}`, format: "shadow-investigation", blueprint: "shadow-formation-and-size-patterns", misconception: "shadow_dark_copy", animation: "shadow-distance-lab", coverage: ["shadow", "opacity", "shadow_size", "fair_test", "evidence", "misconception"], body: { source: "small virtual lamp", source_state: "on", blocker: `opaque ${setup.object}`, receiving_surface: "screen", results, changed_variable: mode.id === "size" || mode.id === "fair" ? "source_to_object_distance" : "material_opacity", controlled_variables: ["object size", "screen position", "virtual lamp"] } }));
  }
  return variants.slice(0, count);
}

function safetyCandidates(count) {
  const variants = [];
  for (const item of safetyCases) {
    const modes = [
      {
        id: "safe", stage: "choose_indirect_safe_observation", prompt: "Which action follows the light-investigation safety rules?", expected: item.safe,
        choices: [item.safe, capitalise(item.unsafe), "Look through an improvised dark material", "Aim a bright source towards another person's eyes"],
        hints: ["Choose an indirect observation that keeps eyes away from bright sources.", "Dark materials, cameras and sunglasses do not make direct Sun viewing safe."], explanation: `${item.safe}. ${item.reason}.`, purpose: "safe_action_choice",
      },
      {
        id: "unsafe", stage: "identify_eye_hazard", prompt: "Which action must be stopped because it could harm eyes?", expected: capitalise(item.unsafe),
        choices: [capitalise(item.unsafe), item.safe, "Read a teacher-provided results table", "Use a labelled tactile model with every real light switched off"],
        hints: ["Find the action that directs bright light towards an eye.", "Use indirect evidence instead."], explanation: `${capitalise(item.unsafe)} is unsafe. ${item.safe} is the safer alternative because it does not require direct bright-light viewing.`, purpose: "eye_hazard_identification",
      },
      {
        id: "why", stage: "explain_safety_boundary", prompt: `Why is this the safe choice: '${item.safe}'?`, expected: item.reason,
        choices: [item.reason, "It makes direct Sun viewing safe", "It proves sunglasses protect eyes from every bright source", "It removes the need for adult checks"],
        hints: ["Link the method to keeping bright light out of eyes.", "Do not claim that a filter or device makes direct Sun viewing safe."], explanation: `${item.reason}. Eye safety is part of the method, not an optional extra.`, purpose: "safety_reasoning",
      },
      {
        id: "review", stage: "spaced_light_safety_review", prompt: "Which complete review statement is scientifically accurate and safe?", expected: `${item.reason}; never look directly at the Sun or aim a bright source at eyes`,
        choices: [`${item.reason}; never look directly at the Sun or aim a bright source at eyes`, "Eyes send light to objects, so bright sources can be viewed directly", "A shadow is darkness stored inside an object", "Only mirrors reflect light, and cameras make Sun viewing safe"],
        hints: ["Check both the science statement and the safety action.", "Reject any choice that permits direct bright-light viewing."], explanation: `${item.reason}. The added boundary protects eyes during every review or investigation.`, purpose: "mixed_spaced_safety_retrieval",
      },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}safety-${item.id}-${mode.id}`, format: "evidence-explain", blueprint: "safe-light-spaced-retrieval", misconception: mode.id === "review" ? "mixed_light_misconception" : "unsafe_sun_viewing", animation: "sun-safety-shield", coverage: ["eye_safety", "sun_safety", "spaced_retrieval", "misconception"], body: { safe_action: item.safe, prohibited_action: item.unsafe, safety_rule: "never look directly at the Sun, through an optical device or improvised filter, and never aim a bright source at eyes", review_interval_days: [1, 3, 7, 14, 30][variants.length % 5] } }));
  }
  return variants.slice(0, count);
}

function makeVariant({ id, format, blueprint, stage, prompt, choices, expected, hints, explanation, purpose, misconception, animation, coverage, body }) {
  const band = bandFor(blueprint, stage);
  return {
    id,
    format,
    body: {
      prompt,
      choices: rotate(unique(choices), id.length % choices.length),
      ...body,
      coverage_tags: coverage,
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_oral_or_partner_recorded_choice",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_recording: true, drag_required: false, undo_available: true },
      send_scaffolds: { one_step_prompt: true, persistent_key_vocabulary: true, sentence_frame: true, repeated_replay_or_reread: true, no_time_limit: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, tinted_background_option: true, readable_font_option: true, one_claim_per_line: true },
      alternatives: {
        visual: "static high-contrast labelled model with texture as well as brightness or colour",
        tactile: "optional adult-prepared unlit raised-line source-object-eye or source-blocker-screen tokens; no real bright source is handled or aimed",
        text: "linear numbered description plus a data table for every diagram, movement or reflected-light bar",
      },
      reduced_visual_load: true,
      one_model_or_table_per_screen: true,
      reduced_motion_alternative: "labelled before-and-after still panels with instant state changes",
      brightness_safety: "no flashes, no pure-white glare and no sudden brightness changes",
      investigation_safety: "virtual or adult-controlled setup only; never look at the Sun or bright sources; no optical devices, improvised filters, flames or lasers",
      feedback_mode: "name the retained correct idea, then offer one evidence-based repair without failure language",
      gamification: { reward: "one calm observatory-map marker for using a safe science strategy", speed_reward: false, streak_pressure: false, loss_on_error: false, public_ranking: false },
    },
    expected_answer: { value: expected },
    hints,
    explanation,
    feedback: { correct: "Your choice matches the light evidence and keeps the investigation safe.", repair: repairFor(stage) },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 4) throw new Error(`Expected four curated variants, found ${curatedItems.length}.`);
  if (generated.length !== pilot - curatedItems.length || curatedItems.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of [...curatedItems, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  const coverage = new Set();
  const formats = new Set();
  const blueprints = new Set();
  const bands = new Set();
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || new Set(variant.body.choices).size !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_scaffolds?.one_step_prompt || !variant.body.dyslexia_support?.increased_spacing || !variant.body.alternatives?.visual || !variant.body.alternatives?.tactile || !variant.body.alternatives?.text) throw new Error(`${variant.id} lacks SEND or multimodal alternatives.`);
    if (variant.body.reduced_visual_load !== true || variant.body.gamification?.speed_reward !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces visual or performance pressure.`);
    if (!/never look at the Sun/.test(variant.body.investigation_safety) || !/no optical devices/.test(variant.body.investigation_safety) || !/no.*flames or lasers/.test(variant.body.investigation_safety)) throw new Error(`${variant.id} lacks safety boundaries.`);
    if (!variant.feedback?.repair || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks feedback.`);
    if (variant.format === "shadow-investigation") validateShadow(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("curriculum coverage", new Set(["light_source", "reflector", "light_path", "light_needed", "darkness", "reflection", "shadow", "opacity", "shadow_size", "fair_test", "evidence", "eye_safety", "sun_safety", "misconception"]), coverage);
}

function validateShadow(variant) {
  const results = variant.body.results;
  if (!Array.isArray(results) || results.length !== 2) throw new Error(`${variant.id} lacks two shadow measurements.`);
  if (results[0].object_width_cm !== results[1].object_width_cm) throw new Error(`${variant.id} changes object size.`);
  if (results[0].object_distance_cm >= results[1].object_distance_cm || results[0].shadow_width_cm <= results[1].shadow_width_cm) throw new Error(`${variant.id} has inconsistent point-source shadow geometry.`);
}

function shadowSize(objectWidth, screenDistance, objectDistance) { return objectWidth * screenDistance / objectDistance; }
function bandFor(blueprint, stage) {
  if (blueprint === "source-object-eye-paths") return stage.includes("repair") ? "developing" : "intro";
  if (blueprint === "darkness-and-source-classification") return stage.includes("connect") ? "expected" : "developing";
  if (blueprint === "surface-reflection-evidence") return stage.includes("select") ? "secure" : "expected";
  if (blueprint === "shadow-formation-and-size-patterns") return stage.includes("fair") || stage.includes("pattern") ? "stretch" : "secure";
  return "retrieval";
}
function difficultyFor(band) { return { intro: 2, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function repairFor(stage) {
  if (stage.includes("source") || stage.includes("eye") || stage.includes("path")) return "Use numbered source-object-eye cards and finish every light path at the eye.";
  if (stage.includes("reflection")) return "Keep the source and sensor fixed, then compare only the stated observations.";
  if (stage.includes("shadow") || stage.includes("opacity")) return "Label source, blocker and screen, then compare one changed variable in the before-and-after table.";
  if (stage.includes("safe") || stage.includes("hazard") || stage.includes("safety")) return "Remove the unsafe action and choose indirect evidence that keeps every bright source away from eyes.";
  return "Keep the correct science word, reread one evidence line and choose again without a timer.";
}
function curatedBlueprint(variant) { const map = { "sc-y3-light-q-see-map": "source-object-eye-paths", "sc-y3-light-q-reflection-surfaces": "surface-reflection-evidence", "sc-y3-light-q-shadow-closer-source": "shadow-formation-and-size-patterns", "sc-y3-light-q-sun-safety": "safe-light-spaced-retrieval" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generated) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generated) { return Object.entries(combinedAllocation(curatedItems, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function summaryCoverage(variants) { const tags = new Set(); for (const variant of variants) for (const tag of variant.body.coverage_tags) tags.add(tag); return [...tags].sort().join(","); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function capitalise(value) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
