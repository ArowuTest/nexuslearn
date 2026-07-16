#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y3-forces-and-magnets.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y3-forces-and-magnets-bank-";
const reviewBatch = "y3-forces-magnets-pilot-a";

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y3-forces-and-magnets") {
  throw new Error("This generator only supports the Year 3 forces and magnets pack.");
}

for (const variant of pack.question_variants ?? []) {
  if (typeof variant.explanation === "string" && variant.explanation.includes(" The expected response is ")) {
    variant.explanation = variant.explanation.split(" The expected response is ")[0];
  }
}

const beforeVariants = structuredClone(pack.question_variants ?? []);
const beforeCore = coreSnapshot(beforeVariants);
const beforeBlueprints = sortedCounts(beforeVariants, (variant) => variant.body?.variant_blueprint_id);
const beforeMissingFeedback = countMissingFeedback(beforeVariants);
const beforeMissingRoute = countMissingRoute(beforeVariants);
const authored = beforeVariants.filter((variant) => !variant.id.startsWith(prefix)).map(enrichVariant);
const candidates = [
  ...contactForceCandidates(),
  ...surfaceTestCandidates(),
  ...magneticMaterialCandidates(),
  ...poleCandidates(),
  ...evidenceCandidates(),
].map(enrichVariant);

validateBank(pack, authored, candidates);
pack.question_variants = [...authored, ...candidates];
pack.version = "0.3.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Quality-hardened Year 3 forces-and-magnets pack with the same four curated variants and 226 deterministic pilot candidates. IDs, answers, blueprint allocation, observations, fair-test tables, pole physics and science scope remain unchanged. Every variant now has evidence-specific correct feedback, a misconception repair route and contact/surface/material/pole model or fair-test support. Explicit touch, keyboard, switch, eye-gaze, AAC/point/adult-recorded routes remove mandatory fine dragging, handwriting and speech. Static sensory-safe alternatives and pressure-free retry remain available. Narration stays selectively absent; any future narration must use produced, human-reviewed ElevenLabs assets and browser TTS is prohibited. Curriculum, teacher, accessibility and safeguarding checks remain required before promotion.";
validateHardening(pack.question_variants, beforeCore, beforeBlueprints);
const afterMissingFeedback = countMissingFeedback(pack.question_variants);
const afterMissingRoute = countMissingRoute(pack.question_variants);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-forces-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y3-forces-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`y3-forces-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y3-forces-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y3-forces-bank coverage=${summaryCoverage(candidates)}`);
console.log(`y3-forces-bank missing_feedback before=${beforeMissingFeedback} after=${afterMissingFeedback}`);
console.log(`y3-forces-bank missing_route before=${beforeMissingRoute} after=${afterMissingRoute}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-forces-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 3 forces and magnets bank is out of date; run generate-y3-forces-magnets-bank.mjs --write.");
  }
  console.log("y3-forces-bank deterministic check passed");
} else {
  console.log("y3-forces-bank dry-run; pass --write to update the pack");
}

function contactForceCandidates() {
  const scenes = [
    ["trolley-start", "A hand pushes a stationary trolley forwards", "push", true, "The trolley starts moving"],
    ["trolley-speed", "A hand pushes a moving trolley in the same direction", "push", true, "The trolley speeds up"],
    ["trolley-slow", "A hand pushes gently against a moving trolley", "push", true, "The trolley slows down"],
    ["catch-ball", "Two hands catch a rolling ball", "push", true, "The ball stops"],
    ["bat-ball", "A bat strikes a moving ball from the side", "push", true, "The ball changes direction"],
    ["kick-ball", "A foot kicks a stationary ball", "push", true, "The ball starts moving"],
    ["squeeze-sponge", "Fingers squeeze a sponge", "push", true, "The sponge changes shape"],
    ["stretch-band", "Two hands pull an elastic band", "pull", true, "The band changes shape"],
    ["open-drawer", "A hand pulls a drawer", "pull", true, "The drawer moves outwards"],
    ["tow-boat", "A string pulls a toy boat", "pull", true, "The boat moves towards the string"],
    ["lift-bucket", "A rope pulls a bucket upwards", "pull", true, "The bucket moves upwards"],
    ["wheel-brake", "A brake block presses against a turning wheel", "push", true, "The wheel slows down"],
    ["open-door", "A hand pushes a closed door", "push", true, "The door starts to open"],
    ["pull-wagon", "A handle pulls a wagon along the path", "pull", true, "The wagon starts moving"],
    ["racquet-shuttle", "A racquet strikes a moving shuttlecock", "push", true, "The shuttlecock changes direction"],
    ["clip-gap", "A magnet attracts a steel paperclip across a small gap", "magnetic", false, "The paperclip moves towards the magnet"],
    ["north-north-gap", "Two north poles face across a small gap", "magnetic", false, "The magnets move away from each other"],
    ["washer-card", "A magnet attracts an iron washer through a sheet of card", "magnetic", false, "The washer moves towards the magnet"],
    ["pin-gap", "A magnet is held near a steel pin without touching it", "magnetic", false, "The pin starts moving towards the magnet"],
    ["south-south-gap", "Two south poles face across a small gap", "magnetic", false, "The magnets move away from each other"],
    ["press-clay", "A palm presses a ball of modelling clay", "push", true, "The clay changes shape"],
    ["pull-spring", "A hand pulls the end of a spring", "pull", true, "The spring changes shape"],
    ["sideways-car", "A hand pushes a moving toy car from the side", "push", true, "The car changes direction"],
  ];
  const variants = [];
  for (const [id, description, force, contact, effect] of scenes) {
    const classification = contact ? `A contact ${force}` : "A non-contact magnetic force";
    const classifyIndex = variants.length;
    variants.push(makeChoice({
      id: `${prefix}contact-${id}-classify`,
      format: "contact-force-sort",
      prompt: `${description}. How should this interaction be classified?`,
      choices: rotate(unique([classification, "A contact push", "A contact pull", "A non-contact magnetic force", "No force is acting"]), classifyIndex % 4, 4),
      expected: classification,
      hints: [contact ? "Look for the objects touching during the force." : "Look for a gap between the interacting objects.", force === "magnetic" ? "A magnetic force can act across a gap." : `The action is a ${force}.`],
      explanation: contact ? `The objects touch, so this is a contact ${force}.` : "The magnetic interaction begins across a gap, so it is a non-contact force.",
      blueprint: "push-pull-contact-effects",
      evidencePurpose: "contact_and_force_classification",
      misconception: "force_used_up",
      animation: "contact-gap-sort",
      bandIndex: classifyIndex,
      coverageTags: [contact ? "contact_force" : "non_contact_force", ...(force === "magnetic" ? [effect.includes("away") ? "repulsion" : "attraction"] : [])],
      progressionStage: "identify_force_and_contact",
      body: { scene: description, force_kind: force, contact_required: contact, observed_effect: effect },
    }));

    const effectIndex = variants.length;
    variants.push(makeChoice({
      id: `${prefix}contact-${id}-effect`,
      format: "contact-force-sort",
      prompt: `${description}. Which observed effect best completes the before-and-after model?`,
      choices: rotate(effectChoices(effect), effectIndex % 4),
      expected: effect,
      hints: ["Compare the object before and after the interaction.", "Describe the change in movement, direction or shape rather than calling movement a force."],
      explanation: `${effect}. This is the observable effect of the ${force === "magnetic" ? "magnetic interaction" : force}.`,
      blueprint: "push-pull-contact-effects",
      evidencePurpose: "force_effect_observation",
      misconception: "force_used_up",
      animation: "force-effect-compare",
      bandIndex: effectIndex,
      coverageTags: [contact ? "contact_force" : "non_contact_force", "prediction", "evidence"],
      progressionStage: "connect_force_to_effect",
      body: { scene: description, force_kind: force, contact_required: contact, observed_effect: effect },
    }));
  }
  return variants;
}

function surfaceTestCandidates() {
  const tests = [
    ["card-fabric", "toy car", "smooth card", "rough fabric", 82, 40],
    ["wood-sandpaper", "wooden block", "smooth wood", "sandpaper", 74, 31],
    ["tile-carpet", "toy car", "tile", "carpet", 88, 43],
    ["plastic-felt", "wooden slider", "plastic sheet", "felt", 69, 34],
    ["laminate-towel", "toy car", "laminate", "towel", 91, 37],
    ["board-rubber", "wooden block", "painted board", "rubber mat", 63, 24],
    ["tray-foam", "toy car", "metal tray", "foam sheet", 77, 29],
    ["plastic-corrugated", "wooden slider", "smooth plastic", "corrugated card", 72, 38],
    ["vinyl-cork", "toy car", "vinyl", "cork sheet", 84, 46],
  ];
  const variants = [];
  for (const [id, object, fartherSurface, shorterSurface, farBase, shortBase] of tests) {
    for (let mode = 0; mode < 5; mode += 1) {
      const index = variants.length;
      const farResults = [farBase + (mode % 2), farBase - 1, farBase];
      const shortResults = [shortBase, shortBase + 1, shortBase - 1];
      const common = {
        results_cm: { [fartherSurface]: farResults, [shorterSurface]: shortResults },
        object,
        changed_variable: "surface",
        kept_same: ["object", "release point", "track length", "measuring method"],
        repeated_trials: 3,
        expected_farther_surface: fartherSurface,
      };
      const task = surfaceTask(mode, object, fartherSurface, shorterSurface);
      variants.push(makeChoice({
        id: `${prefix}surface-${id}-${mode + 1}`,
        format: "surface-test",
        prompt: task.prompt,
        choices: rotate(task.choices, index % 4),
        expected: task.expected,
        hints: task.hints,
        explanation: task.explanation,
        blueprint: "surface-motion-fair-comparisons",
        evidencePurpose: task.evidencePurpose,
        misconception: "rough_means_faster",
        animation: "surface-distance-fair-test",
        bandIndex: index + 1,
        coverageTags: ["fair_test", "prediction", "evidence", "misconception"],
        progressionStage: mode < 2 ? "control_the_test" : "interpret_repeat_evidence",
        body: common,
      }));
    }
  }
  return variants;
}

function magneticMaterialCandidates() {
  const materials = [
    ["iron-nail", "iron nail", "iron", true],
    ["steel-clip", "steel paperclip", "steel", true],
    ["steel-washer", "steel washer", "steel", true],
    ["steel-cap", "steel bottle top", "steel", true],
    ["iron-bolt", "iron bolt", "iron", true],
    ["steel-pin", "steel drawing pin in the virtual test", "steel", true],
    ["foil-ball", "aluminium foil ball", "aluminium", false],
    ["copper-coil", "copper wire coil", "copper", false],
    ["brass-fastener", "brass paper fastener", "brass", false],
    ["wood-block", "wooden block", "wood", false],
    ["plastic-button", "plastic button", "plastic", false],
    ["rubber-band", "rubber band", "rubber", false],
    ["glass-bead", "glass bead in the virtual test", "glass", false],
    ["ceramic-tile", "ceramic tile", "ceramic", false],
    ["cotton-square", "cotton fabric square", "cotton", false],
  ];
  const attracted = materials.filter((entry) => entry[3]);
  const notAttracted = materials.filter((entry) => !entry[3]);
  const variants = [];
  for (let item = 0; item < materials.length; item += 1) {
    const [id, object, material, attracts] = materials[item];
    for (let mode = 0; mode < 3; mode += 1) {
      const index = variants.length;
      const task = materialTask(mode, object, material, attracts, item, attracted, notAttracted);
      variants.push(makeChoice({
        id: `${prefix}material-${id}-${mode + 1}`,
        format: "magnetic-material-test",
        prompt: task.prompt,
        choices: rotate(task.choices, index % 4),
        expected: task.expected,
        hints: task.hints,
        explanation: task.explanation,
        blueprint: "magnetic-material-evidence-groups",
        evidencePurpose: task.evidencePurpose,
        misconception: "all_metals_magnetic",
        animation: mode === 0 ? "prediction-evidence-reconcile" : "magnetic-material-test",
        bandIndex: index + 2,
        coverageTags: ["non_contact_force", "attraction", "prediction", "evidence", "misconception"],
        progressionStage: mode === 0 ? "predict_then_test" : "group_from_material_evidence",
        body: {
          object,
          material,
          correct_result: attracts ? "attracted" : "not_attracted",
          test_gap: "same_small_gap",
          result_reveal: "after_prediction",
          comparison_object: task.comparisonObject,
        },
      }));
    }
  }
  return variants;
}

function poleCandidates() {
  const settings = [
    "magnetic rail gate", "map-compass workshop", "island bridge lock", "virtual magnet bench", "explorer supply lift",
    "cave-marker puzzle", "harbour guide rail", "research station door", "field-kit sorter", "river-crossing latch",
    "trail-sign mover", "base-camp model", "rescue-sled guide", "weather-station panel", "archive drawer",
  ];
  const orientations = [["N", "N"], ["S", "S"], ["N", "S"], ["S", "N"]];
  const variants = [];
  for (let item = 0; item < settings.length; item += 1) {
    const setting = settings[item];
    const facing = orientations[item % orientations.length];
    for (let mode = 0; mode < 3; mode += 1) {
      const index = variants.length;
      const effective = mode === 1 ? [facing[0], opposite(facing[1])] : facing;
      const outcome = poleOutcome(effective);
      const task = poleTask(mode, setting, facing, effective, outcome);
      variants.push(makeChoice({
        id: `${prefix}poles-${item + 1}-${mode + 1}`,
        format: "pole-predictor",
        prompt: task.prompt,
        choices: rotate(task.choices, index % 4),
        expected: task.expected,
        hints: task.hints,
        explanation: task.explanation,
        blueprint: "pole-attract-repel-predictions",
        evidencePurpose: "pole_orientation_prediction",
        misconception: "magnets_always_attract",
        animation: "pole-orientation-compare",
        bandIndex: index + 3,
        coverageTags: ["non_contact_force", "poles", outcome === "attract" ? "attraction" : "repulsion", "prediction", "misconception"],
        progressionStage: mode === 0 ? "predict_from_visible_poles" : mode === 1 ? "reason_after_turning_one_magnet" : "explain_pole_rule",
        body: {
          setting,
          original_facing_poles: facing,
          effective_facing_poles: effective,
          correct_outcome: outcome,
          pole_labels: "letters_and_patterns",
          direction_words: outcome === "attract" ? "towards" : "away",
        },
      }));
    }
  }
  return variants;
}

function evidenceCandidates() {
  return [
    ...contactEvidence(),
    ...surfaceEvidence(),
    ...materialEvidence(),
    ...poleEvidence(),
    ...fairTestEvidence(),
  ];
}

function contactEvidence() {
  const cases = [
    ["cart", "A cart was still. A hand pushed it and it began moving.", "The contact push changed the cart's movement"],
    ["sponge", "A sponge was round. Fingers pressed it and it became flat.", "The contact push changed the sponge's shape"],
    ["drawer", "A drawer was closed. A hand pulled it and it moved outwards.", "The contact pull changed the drawer's position"],
    ["ball", "A ball rolled forwards. A bat struck it sideways and it turned.", "The contact push changed the ball's direction"],
    ["wheel", "A wheel was turning. A brake touched it and the wheel slowed.", "The contact force changed the wheel's speed"],
    ["clip", "A magnet approached a steel clip across a gap and the clip moved.", "A non-contact magnetic force attracted the clip"],
    ["north", "Two north poles faced across a gap and moved apart.", "A non-contact magnetic force repelled the magnets"],
    ["rope", "A bucket was still. A rope tightened and lifted it.", "The contact pull changed the bucket's movement"],
    ["clay", "A clay ball was tall. A palm pressed it and it became short and wide.", "The contact push changed the clay's shape"],
  ];
  return cases.map(([id, prompt, expected], index) => makeChoice({
    id: `${prefix}evidence-contact-${id}`,
    format: "evidence-explain",
    prompt: `${prompt} Which explanation matches the evidence?`,
    choices: rotate([expected, "The movement was a force stored inside the object", "No force acted because the effect happened afterwards", "The object changed without an interaction"], index % 4),
    expected,
    hints: ["Name the interaction before describing the effect.", "Use contact or gap evidence from the observation."],
    explanation: `${expected}. The before-and-after observation supports this limited claim.`,
    blueprint: "forces-magnets-spaced-evidence",
    evidencePurpose: "contact_effect_evidence",
    misconception: "force_used_up",
    animation: "evidence-conclusion-lock",
    bandIndex: index + 4,
    coverageTags: [expected.includes("non-contact") ? "non_contact_force" : "contact_force", "evidence", "misconception"],
    progressionStage: "mixed_evidence_explanation",
    body: { evidence_record: prompt },
  }));
}

function surfaceEvidence() {
  const cases = [
    ["card-fabric", "smooth card", [80, 81, 79], "rough fabric", [39, 41, 40]],
    ["tile-carpet", "tile", [87, 89, 88], "carpet", [42, 44, 43]],
    ["wood-sand", "smooth wood", [73, 74, 72], "sandpaper", [31, 30, 32]],
    ["plastic-felt", "plastic sheet", [68, 70, 69], "felt", [33, 35, 34]],
    ["board-rubber", "painted board", [62, 64, 63], "rubber mat", [23, 25, 24]],
    ["tray-foam", "metal tray", [76, 78, 77], "foam", [28, 30, 29]],
    ["vinyl-cork", "vinyl", [83, 85, 84], "cork", [45, 47, 46]],
    ["laminate-towel", "laminate", [90, 92, 91], "towel", [36, 38, 37]],
    ["plastic-card", "smooth plastic", [71, 73, 72], "corrugated card", [37, 39, 38]],
  ];
  return cases.map(([id, farther, farResults, shorter, shortResults], index) => {
    const expected = `In this test, the object travelled farther on ${farther} than on ${shorter}`;
    return makeChoice({
      id: `${prefix}evidence-surface-${id}`,
      format: "evidence-explain",
      prompt: `The same object and release point gave ${farResults.join(", ")} cm on ${farther} and ${shortResults.join(", ")} cm on ${shorter}. Which conclusion fits?`,
      choices: rotate([expected, `${shorter} always makes every object faster`, "The object changed because its size was different each time", "There is no pattern in the repeated results"], index % 4),
      expected,
      hints: ["Compare all three distances for each surface.", "Limit the conclusion to the tested object and setup."],
      explanation: `${expected}; every recorded distance on ${farther} is greater in this controlled comparison.`,
      blueprint: "forces-magnets-spaced-evidence",
      evidencePurpose: "surface_evidence_conclusion",
      misconception: "rough_means_faster",
      animation: "evidence-row-focus",
      bandIndex: index + 5,
      coverageTags: ["fair_test", "evidence", "misconception"],
      progressionStage: "mixed_evidence_explanation",
      body: { results_cm: { [farther]: farResults, [shorter]: shortResults }, expected_farther_surface: farther, controlled_setup: true },
    });
  });
}

function materialEvidence() {
  const cases = [
    ["steel-aluminium", "A steel washer was attracted; an aluminium strip was not.", "The results show that some metals are attracted and some are not"],
    ["iron-copper", "An iron nail was attracted; copper wire was not.", "The observations do not support an all-metals rule"],
    ["steel-wood", "A steel clip was attracted; a wooden block was not.", "The grouping should follow test results, not appearance"],
    ["brass-iron", "A brass fastener was not attracted; an iron bolt was.", "The stated material helps explain the different results"],
    ["plastic-steel", "A plastic counter was not attracted; a steel cap was.", "Only the tested steel object was attracted in this pair"],
    ["copper-steel", "A copper coin was not attracted; a steel washer was.", "Being shiny is not enough evidence of magnetic attraction"],
    ["glass-iron", "A glass bead was not attracted; an iron nail was.", "The magnet attracted the iron object across the gap"],
    ["aluminium-steel", "Aluminium foil was not attracted; a steel paperclip was.", "The test evidence separates these two metal materials"],
    ["fabric-steel", "Cotton fabric was not attracted; a steel pin was.", "The result depends on the tested material, not the object's size"],
  ];
  return cases.map(([id, evidence, expected], index) => makeChoice({
    id: `${prefix}evidence-material-${id}`,
    format: "evidence-explain",
    prompt: `${evidence} Which conclusion uses the evidence carefully?`,
    choices: rotate([expected, "Every metal is attracted to every magnet", "Every shiny object is magnetic", "The prediction matters more than the observation"], index % 4),
    expected,
    hints: ["Use both observations, including the object that was not attracted.", "Avoid making a rule about every object from two tests."],
    explanation: `${expected}. This conclusion stays within the observed results.`,
    blueprint: "forces-magnets-spaced-evidence",
    evidencePurpose: "material_evidence_conclusion",
    misconception: "all_metals_magnetic",
    animation: "prediction-evidence-reconcile",
    bandIndex: index + 6,
    coverageTags: ["non_contact_force", "attraction", "evidence", "misconception"],
    progressionStage: "mixed_evidence_explanation",
    body: { evidence_record: evidence },
  }));
}

function poleEvidence() {
  const orientations = [["N", "N"], ["S", "S"], ["N", "S"], ["S", "N"], ["N", "N"], ["N", "S"], ["S", "S"], ["S", "N"], ["N", "N"]];
  const contexts = ["rail gate", "map holder", "bridge latch", "virtual test bench", "supply lift", "trail marker", "harbour guide", "archive door", "field-kit sorter"];
  return orientations.map((facing, index) => {
    const outcome = poleOutcome(facing);
    const expected = outcome === "attract" ? "Different facing poles attract and move towards each other" : "Matching facing poles repel and move away from each other";
    return makeChoice({
      id: `${prefix}evidence-poles-${index + 1}`,
      format: "evidence-explain",
      prompt: `At the ${contexts[index]}, the facing poles are ${facing[0]} and ${facing[1]}. Which prediction and explanation are correct?`,
      choices: rotate([expected, outcome === "attract" ? "Different poles repel because all magnets push" : "Matching poles attract because magnets always pull", "The pole labels disappear when magnets move", "No force can act until the magnets touch"], index % 4),
      expected,
      hints: ["Compare the two visible pole letters.", outcome === "attract" ? "Different poles pull towards each other." : "Matching poles push away from each other."],
      explanation: expected,
      blueprint: "forces-magnets-spaced-evidence",
      evidencePurpose: "pole_rule_evidence",
      misconception: "magnets_always_attract",
      animation: "pole-orientation-compare",
      bandIndex: index + 7,
      coverageTags: ["non_contact_force", "poles", outcome === "attract" ? "attraction" : "repulsion", "prediction", "evidence", "misconception"],
      progressionStage: "mixed_evidence_explanation",
      body: { effective_facing_poles: facing, correct_outcome: outcome },
    });
  });
}

function fairTestEvidence() {
  const cases = [
    ["surface", "Which plan fairly compares two track surfaces?", "Use the same car and release point, change only the surface, repeat and measure distance"],
    ["magnet-gap", "Which plan tests how changing the gap affects attraction?", "Use the same magnet and object, change only the gap, and record each result"],
    ["magnet-strength", "Which plan fairly compares two magnets?", "Use the same steel clips and gap, change only the magnet, and repeat the count"],
    ["ramp-release", "Which plan tests two release points on one ramp?", "Use the same car and surface, change only the release point, and measure distance"],
    ["repeat", "Why run three trials for each surface?", "Repeats help show whether the distance pattern is consistent"],
    ["prediction", "A car travelled farther on card in three trials. What is a careful next prediction?", "In the same setup, it will probably travel farther on card again"],
    ["anomaly", "Two trials are close but one distance is very different. What should the team do?", "Check the setup and repeat the trial before concluding"],
    ["record", "What should be recorded in a surface test?", "The changed surface and each measured distance"],
    ["conclusion", "What makes a fair-test conclusion useful?", "It names the tested setup and points to the repeated measurements"],
  ];
  return cases.map(([id, prompt, expected], index) => makeChoice({
    id: `${prefix}evidence-fair-test-${id}`,
    format: "evidence-explain",
    prompt,
    choices: rotate([expected, "Change several things at once and choose the result you expected", "Run one trial without measuring", "Use the prediction as the conclusion even if results differ"], index % 4),
    expected,
    hints: ["Change one thing and keep the other important conditions the same.", "Use repeats and measurements before making a conclusion."],
    explanation: `${expected}. This separates prediction from observation and supports a cautious evidence-based conclusion.`,
    blueprint: "forces-magnets-spaced-evidence",
    evidencePurpose: "fair_test_and_evidence_reasoning",
    misconception: "rough_means_faster",
    animation: "active-test-variable-outline",
    bandIndex: index + 8,
    coverageTags: ["fair_test", "prediction", "evidence", "misconception"],
    progressionStage: "mixed_evidence_explanation",
    body: { investigation_focus: id },
  }));
}

function surfaceTask(mode, object, fartherSurface, shorterSurface) {
  if (mode === 0) {
    const expected = `In this test, the ${object} travelled farther on ${fartherSurface} than on ${shorterSurface}`;
    return {
      prompt: `The same ${object} was released from the same point on ${fartherSurface} and ${shorterSurface}. Which conclusion fits the repeated distances?`,
      choices: [expected, `${shorterSurface} always makes every object move faster`, "The object changed size between surfaces", "There is no useful pattern"],
      expected,
      hints: ["Compare all three distances for each surface.", "Keep the conclusion limited to this object and setup."],
      explanation: `${expected}. The repeated measurements support this cautious conclusion.`,
      evidencePurpose: "surface_motion_comparison",
    };
  }
  if (mode === 1) {
    const expected = "Change only the surface; keep the object and release point the same";
    return {
      prompt: `Which setup fairly compares ${fartherSurface} with ${shorterSurface}?`,
      choices: [expected, "Change the surface, object and release point together", "Use a different measuring method for each surface", "Push one object but release the other"],
      expected,
      hints: ["A fair comparison changes one variable.", "Lock the object and release point before changing the surface."],
      explanation: "Changing only the surface lets the measured distance be compared fairly.",
      evidencePurpose: "fair_test_variable_control",
    };
  }
  if (mode === 2) {
    const expected = `In the same setup, the ${object} will probably travel farther on ${fartherSurface}`;
    return {
      prompt: "Which prediction is best supported before one more repeat?",
      choices: [expected, `${shorterSurface} will always stop every object`, "The object will become magnetic", "The release point will move by itself"],
      expected,
      hints: ["Use the pattern across the repeated distances.", "Use probably because a prediction is testable, not certain."],
      explanation: `The repeated results make a farther distance on ${fartherSurface} a reasonable prediction for the same setup.`,
      evidencePurpose: "evidence_based_prediction",
    };
  }
  if (mode === 3) {
    const expected = "Repeats help show whether the distance pattern is consistent";
    return {
      prompt: `Why are three trials recorded for the ${object} on ${fartherSurface} and ${shorterSurface}?`,
      choices: [expected, "Repeats guarantee the prediction is correct", "Repeats let the team change the car each time", "Repeats remove the need to measure"],
      expected,
      hints: ["Look for results that are close enough to show a pattern.", "A repeat checks the observation; it does not guarantee it."],
      explanation: "Repeated measurements help the team judge whether the observed difference is consistent.",
      evidencePurpose: "repeat_measurement_reasoning",
    };
  }
  const expected = `All three distances on ${fartherSurface} are greater than all three on ${shorterSurface}`;
  return {
    prompt: "Which evidence sentence best supports the surface conclusion?",
    choices: [expected, `${fartherSurface} sounds smoother`, "The first prediction named the correct surface", "Only one distance should be used"],
    expected,
    hints: ["Use measurements rather than surface names.", "Check every result in both rows."],
    explanation: `${expected}, so the data support the conclusion for this setup.`,
    evidencePurpose: "measurement_evidence_selection",
  };
}

function materialTask(mode, object, material, attracts, item, attracted, notAttracted) {
  const resultText = attracts ? "It will be attracted" : "It will not be attracted";
  if (mode === 0) {
    return {
      prompt: `Predict before the virtual test: what will happen when the magnet approaches the ${object} across the same small gap?`,
      choices: [resultText, attracts ? "It will be repelled" : "It will be attracted", "Every object will be attracted because the magnet is strong", "The material will change into iron"],
      expected: resultText,
      hints: [`The object is stated to be ${material}.`, attracts ? "Classroom magnets attract iron and steel in this model." : "Not every material, and not every metal, is attracted."],
      explanation: `The ${object} is ${attracts ? "attracted because its stated material is" : "not attracted; its stated material is"} ${material}. The prediction is checked by the virtual observation.`,
      evidencePurpose: "material_prediction",
    };
  }
  if (mode === 1) {
    const expected = attracts ? `Record the ${object} in the attracted group` : `Record the ${object} in the not-attracted group`;
    return {
      prompt: `The virtual test shows that the ${object} is ${attracts ? "attracted" : "not attracted"}. Which evidence record is correct?`,
      choices: [expected, attracts ? "Record it as repelled" : "Record it as attracted because it looks useful", "Change the prediction instead of recording the result", "Group it by shininess only"],
      expected,
      hints: ["Record what the test showed, even if the prediction differed.", "Group by attraction evidence rather than appearance."],
      explanation: `${capitalise(expected)} because the observation, not the prediction, determines the evidence group.`,
      evidencePurpose: "material_observation_record",
    };
  }
  const pair = attracts ? notAttracted[item % notAttracted.length] : attracted[item % attracted.length];
  const pairObject = pair[1];
  const expected = attracts
    ? `The ${object} was attracted but the ${pairObject} was not, so not every material is attracted`
    : `The ${pairObject} was attracted but the ${object} was not, so attraction depends on the tested material`;
  return {
    prompt: `Compare the ${object} with the ${pairObject}. Which conclusion is supported by their different test results?`,
    choices: [expected, "Every metal and every shiny object is attracted", "The larger object must be attracted", "Predictions should replace observations"],
    expected,
    hints: ["Use the observed result for both objects.", "Make a cautious claim rather than an all-objects rule."],
    explanation: `${expected}. Stated material and observed attraction provide stronger evidence than appearance.`,
    evidencePurpose: "material_comparison_conclusion",
    comparisonObject: pairObject,
  };
}

function poleTask(mode, setting, original, effective, outcome) {
  const outcomeText = outcome === "attract" ? "They attract" : "They repel";
  if (mode === 0) {
    return {
      prompt: `At the ${setting}, pole ${original[0]} faces pole ${original[1]}. What will happen?`,
      choices: [outcomeText, outcome === "attract" ? "They repel" : "They attract", "The poles disappear", "No force acts until they touch"],
      expected: outcomeText,
      hints: ["Read both facing pole letters.", outcome === "attract" ? "Different poles attract." : "Matching poles repel."],
      explanation: `${original[0]} and ${original[1]} are ${outcome === "attract" ? "different" : "matching"} poles, so the magnets ${outcome}.`,
    };
  }
  if (mode === 1) {
    return {
      prompt: `At the ${setting}, ${original[0]} faces ${original[1]}. Turn the second magnet so ${effective[1]} faces ${effective[0]}. What happens now?`,
      choices: [outcomeText, outcome === "attract" ? "They repel" : "They attract", "Only one pole still exists", "The magnetic force is used up"],
      expected: outcomeText,
      hints: ["Use the new facing poles after the turn.", outcome === "attract" ? "The new poles are different." : "The new poles match."],
      explanation: `After the turn, ${effective[0]} faces ${effective[1]}. These poles ${outcome}.`,
    };
  }
  const expected = outcome === "attract" ? "Different poles attract" : "Matching poles repel";
  return {
    prompt: `Which rule explains the direction arrows at the ${setting} when ${effective[0]} faces ${effective[1]}?`,
    choices: [expected, outcome === "attract" ? "Different poles always repel" : "Matching poles always attract", "Magnets only work when touching", "One pole has run out of force"],
    expected,
    hints: ["Compare the facing labels before using the arrows.", outcome === "attract" ? "Towards arrows show attraction." : "Away arrows show repulsion."],
    explanation: `${expected}, so the direction arrows point ${outcome === "attract" ? "towards" : "away from"} each other.`,
  };
}

function makeChoice({ id, format, prompt, choices, expected, hints, explanation, blueprint, evidencePurpose, misconception, animation, bandIndex, coverageTags, progressionStage, body }) {
  const difficultyBand = bandFor(bandIndex);
  return {
    id,
    format,
    body: {
      prompt,
      choices,
      ...body,
      coverage_tags: coverageTags,
      conceptual_progression: progressionStage,
      ...interactionMetadata(format, bandIndex),
      evidence_purpose: evidencePurpose,
      variant_blueprint_id: blueprint,
    },
    expected_answer: { value: expected },
    hints,
    explanation,
    difficulty: difficultyFor(difficultyBand),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function interactionMetadata(format, bandIndex) {
  const alternatives = {
    "contact-force-sort": "before_after_still_frames_with_touch_or_gap_text",
    "surface-test": "labelled_setup_and_three_row_distance_table",
    "magnetic-material-test": "object_material_prediction_observation_table",
    "pole-predictor": "N_S_text_labels_with_towards_or_away_arrows",
    "evidence-explain": "linear_evidence_cards_and_text_table",
  };
  return {
    difficulty_band: bandFor(bandIndex),
    review_batch: reviewBatch,
    response_mode: "tap_keyboard_switch_or_oral_choice",
    audio_replay: true,
    timed: false,
    drag_required: false,
    colour_required: false,
    visual_load: "low",
    keyboard_instructions: "Use arrow keys to review choices, then Enter to select.",
    switch_scan_order: "prompt_then_model_or_table_then_choices_then_check",
    static_alternative: alternatives[format],
    reduced_motion_alternative: "numbered_before_and_after_frames_with_instant_text_feedback",
    model_description_available: true,
    feedback_mode: "evidence_then_explanation_without_failure_shaming",
    world_context: "explorer_island_forces_lab",
    progress_feedback: "lab_map_progress_without_speed_or_streak_scoring",
  };
}

function validateBank(packData, authored, generated) {
  const pilot = packData.practice?.variant_targets?.pilot;
  if (authored.length !== 4) throw new Error(`Expected four curated variants, found ${authored.length}.`);
  if (generated.length !== pilot - authored.length) throw new Error(`Expected ${pilot - authored.length} generated candidates, found ${generated.length}.`);
  if (authored.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);

  const blueprintIDs = new Set((packData.variant_blueprints ?? []).map((blueprint) => blueprint.id));
  const formats = new Set(packData.practice?.formats ?? []);
  const bands = new Set([...(packData.practice?.difficulty_bands ?? []), ...(packData.variant_blueprints ?? []).map((blueprint) => blueprint.difficulty_band)]);
  const requiredCoverage = new Set(["contact_force", "non_contact_force", "attraction", "repulsion", "poles", "fair_test", "prediction", "evidence", "misconception"]);
  const actualBlueprints = new Set();
  const actualFormats = new Set();
  const actualBands = new Set();
  const actualCoverage = new Set();
  const ids = new Set();
  const signatures = new Set();

  for (const variant of [...authored, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }

  for (const variant of generated) {
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!blueprintIDs.has(variant.body?.variant_blueprint_id)) throw new Error(`${variant.id} has an unknown blueprint.`);
    if (!formats.has(variant.format)) throw new Error(`${variant.id} has unsupported format ${variant.format}.`);
    if ((variant.body?.choices ?? []).filter((choice) => choice === variant.expected_answer?.value).length !== 1) {
      throw new Error(`${variant.id} must contain its expected choice exactly once.`);
    }
    if (!Array.isArray(variant.hints) || variant.hints.length < 2 || !variant.explanation) throw new Error(`${variant.id} needs two hints and an explanation.`);
    if (String(variant.body.prompt).length > 220) throw new Error(`${variant.id} prompt is too long for Year 3.`);
    if (variant.format === "surface-test") validateSurface(variant);
    if (variant.format === "magnetic-material-test" && !["attracted", "not_attracted"].includes(variant.body.correct_result)) {
      throw new Error(`${variant.id} has an invalid material-test result.`);
    }
    if (variant.body.effective_facing_poles) {
      const expectedOutcome = poleOutcome(variant.body.effective_facing_poles);
      if (variant.body.correct_outcome !== expectedOutcome) throw new Error(`${variant.id} has incorrect pole physics.`);
    }
    actualBlueprints.add(variant.body.variant_blueprint_id);
    actualFormats.add(variant.format);
    actualBands.add(variant.body.difficulty_band);
    for (const tag of variant.body.coverage_tags ?? []) actualCoverage.add(tag);
  }

  assertCovered("blueprints", blueprintIDs, actualBlueprints);
  assertCovered("formats", formats, actualFormats);
  assertCovered("difficulty bands", bands, actualBands);
  assertCovered("curriculum coverage", requiredCoverage, actualCoverage);
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
  const audioPolicy = hasAudioReference ? {
    audio_provider: "ElevenLabs",
    audio_production_policy: "produced_and_human_listening_reviewed_assets_only",
    human_listening_approval_required: true,
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  } : {
    audio_required: false,
    audio_route: "not_required_static_models_tables_labels_and_text_are_complete",
    audio_policy: "if_narration_is_added_use_produced_human_reviewed_ElevenLabs_assets_only",
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  };
  return {
    ...variant,
    body: {
      ...body,
      ...audioPolicy,
      interaction_route: {
        touch: "Tap a labelled model part, table row or numbered choice; buttons and steppers replace precise object movement.",
        keyboard: "Tab through the model or evidence table and choices; use arrows for labelled states and Enter or Space to select and check.",
        switch_scan: "Scan prompt, static model/table, numbered choices, check and retry in a fixed order with one activation per decision.",
        eye_gaze: "Use large dwell-select model labels and choices with adjustable dwell time and a confirm step.",
        aac_point_adult_recorded: "The learner may point, use AAC or direct an adult to select or record the indicated prediction, evidence or explanation without the adult supplying the science decision.",
        fine_dragging_required: false,
      },
      accessible_response_route: "Touch, keyboard, switch, eye gaze, AAC, pointing and adult-recorded responses provide equivalent science evidence; fine dragging, handwriting and speech are never mandatory.",
      force_model_route: "Labelled before/after still frames show object, push/pull or measured gap and observable change in speed, direction, position or shape; a linear text description is equivalent.",
      surface_fair_test_route: "CHANGE SURFACE, KEEP SAME and MEASURE DISTANCE cards sit beside repeated-results rows; motion can be replaced by static release and finish frames.",
      magnetic_material_route: "Prediction and observation remain separate; object, known material, fixed test gap and attracted/not-attracted result are text-labelled without relying on shine or colour.",
      pole_model_route: "N and S use letters, patterns and spoken-name text; facing poles and towards/away arrows have a linear pair-and-outcome alternative.",
      evidence_table_route: "One evidence row appears at a time with repeat values, controlled variables and a cautious conclusion stem; correct evidence remains visible during repair.",
      sensory_safe_route: "No sudden sound, flashing, compulsory motion or handling of real magnets; static virtual models avoid loose-magnet and ingestion risks.",
      reduced_load_route: "Reveal prediction, one model/test variable, observation and conclusion separately while preserving correct work and labels.",
      no_mandatory_fine_dragging: true,
      no_mandatory_handwriting: true,
      no_mandatory_speech: true,
      microphone_required: false,
      handwriting_required: false,
      drag_required: false,
      retry_without_penalty: true,
      no_timer: true,
      speed_score_allowed: false,
      preserve_correct_work: true,
      undo_available: true,
      pressure_rules: { timer: false, speed_score: false, streaks: false, lives: false, loss_on_error: false, public_ranking: false, retry_cost: false },
    },
    feedback: feedbackFor(variant),
  };
}

function feedbackFor(variant) {
  return {
    correct: correctFeedback(variant),
    repair: repairFeedback(variant),
    science_evidence: scienceEvidence(variant),
    misconception_support: `${variant.misconception_tag}: ${repairFeedback(variant)}`,
    model_or_fair_test_support: modelSupport(variant),
    support_message: "Static models, tables, touch, keyboard, switch, eye gaze, AAC, pointing and adult recording are equally valid; speed, fine dragging, speech and handwriting are not scored.",
    retry: "Your correct prediction, controlled variable, observation or pole label stays. Inspect one evidence clue and retry without losing progress.",
  };
}

function correctFeedback(variant) {
  const answer = variant.expected_answer?.value;
  if (variant.misconception_tag === "force_used_up") return `“${answer}” uses the observed interaction and effect: identify push, pull or magnetic action, then describe what changed rather than treating force as stored or used up.`;
  if (variant.misconception_tag === "rough_means_faster") return `“${answer}” matches the repeated distance evidence from a test where the surface changed and the object, release point and measuring method stayed controlled.`;
  if (variant.misconception_tag === "all_metals_magnetic") return `“${answer}” follows the attracted/not-attracted test result and does not classify from shininess or the word metal alone.`;
  return `“${answer}” follows the labelled facing poles: matching poles repel and different poles attract across a gap.`;
}

function repairFeedback(variant) {
  if (variant.misconception_tag === "force_used_up") return "Identify the interaction first: did objects touch, and was it a push or pull, or did a magnet act across a gap? Then compare before and after to name the change in movement, direction or shape; a force is an interaction, not a substance that runs out.";
  if (variant.misconception_tag === "rough_means_faster") return "Return to the fair-test table. Check that only surface changed, compare all repeated distances for the same object and release point, and state ‘in this test’ rather than using the surface label to guess an always-rule.";
  if (variant.misconception_tag === "all_metals_magnetic") return "Separate prediction from observation, keep the same magnet and gap, and group each object by its recorded attracted/not-attracted result. Some metals, such as iron and many steels, are attracted; aluminium, copper and brass are not in these tests.";
  return "Read only the two facing pole labels after any turn: N–N or S–S are matching and repel; N–S or S–N are different and attract. Match repel with away arrows and attract with towards arrows.";
}

function scienceEvidence(variant) {
  const body = variant.body, answer = variant.expected_answer?.value;
  if (variant.misconception_tag === "force_used_up") return `${body.scene ?? body.evidence_record ?? body.prompt} The contact/gap and before–after evidence supports “${answer}”.`;
  if (variant.misconception_tag === "rough_means_faster") {
    const results = body.results_cm; return results ? `Repeated distances: ${Object.entries(results).map(([surface, values]) => `${surface}: ${values.join(", ")} cm`).join("; ")}. These support “${answer}” within the controlled setup.` : `${variant.explanation} This is limited to the shown controlled comparison.`;
  }
  if (variant.misconception_tag === "all_metals_magnetic") return body.correct_result ? `${body.object} (${body.material}) was ${body.correct_result} at the same small test gap, supporting “${answer}”.` : `${variant.explanation} The conclusion uses all shown material results.`;
  const poles = body.effective_facing_poles ?? body.facing_poles; return poles ? `${poles[0]} faces ${poles[1]}; ${poles[0] === poles[1] ? "matching poles repel" : "different poles attract"}, supporting “${answer}”.` : `${variant.explanation} The conclusion follows the labelled pole evidence.`;
}

function modelSupport(variant) {
  if (variant.misconception_tag === "force_used_up") return "Use TOUCH OR GAP → PUSH/PULL/MAGNETIC → BEFORE/AFTER EFFECT. Keep movement as an effect, not the force itself.";
  if (variant.misconception_tag === "rough_means_faster") return "Use CHANGE SURFACE → KEEP OBJECT/RELEASE/MEASURE SAME → REPEAT → COMPARE DISTANCES → CAUTIOUS CONCLUSION.";
  if (variant.misconception_tag === "all_metals_magnetic") return "Use PREDICT → SAME MAGNET/GAP TEST → RECORD ATTRACTED OR NOT → GROUP FROM EVIDENCE, NOT APPEARANCE.";
  return "Use FACE LABELS → MATCHING OR DIFFERENT → REPEL/AWAY OR ATTRACT/TOWARDS → CHECK AFTER ANY TURN.";
}

function validateHardening(variants, beforeCoreSnapshot, beforeBlueprintCounts) {
  if (variants.length !== 230) throw new Error(`Expected 230 variants, found ${variants.length}.`);
  if (new Set(variants.map((variant) => variant.id)).size !== 230) throw new Error("Variant IDs are not unique.");
  if (JSON.stringify(coreSnapshot(variants)) !== JSON.stringify(beforeCoreSnapshot)) throw new Error("Hardening changed IDs, answers, curated content, fair-test evidence, models, pole physics or science scope.");
  if (JSON.stringify(sortedCounts(variants, (variant) => variant.body?.variant_blueprint_id)) !== JSON.stringify(beforeBlueprintCounts)) throw new Error("Blueprint allocation changed during hardening.");
  if (countMissingFeedback(variants) !== 0) throw new Error("At least one variant still lacks rich feedback.");
  if (countMissingRoute(variants) !== 0) throw new Error("At least one variant still lacks a complete interaction route.");
  for (const variant of variants) {
    const body = variant.body, hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
    if (hasAudioReference) {
      if (body.audio_provider !== "ElevenLabs" || body.audio_production_policy !== "produced_and_human_listening_reviewed_assets_only" || !body.human_listening_approval_required || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${variant.id}.`);
    } else if (body.audio_required !== false || body.audio_provider || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Selective no-audio policy failed in ${variant.id}.`);
    if (!body.no_timer || body.speed_score_allowed || body.pressure_rules?.streaks || body.pressure_rules?.lives || body.pressure_rules?.loss_on_error) throw new Error(`Pressure mechanic found in ${variant.id}.`);
  }
}

function coreSnapshot(variants) { return variants.map(stripEnrichment); }
function stripEnrichment(variant) {
  const copy = structuredClone(variant); delete copy.feedback;
  if (typeof copy.explanation === "string") copy.explanation = copy.explanation.split(" The expected response is ")[0];
  for (const key of ["interaction_route", "accessible_response_route", "force_model_route", "surface_fair_test_route", "magnetic_material_route", "pole_model_route", "evidence_table_route", "sensory_safe_route", "reduced_load_route", "no_mandatory_fine_dragging", "no_mandatory_handwriting", "no_mandatory_speech", "microphone_required", "handwriting_required", "drag_required", "retry_without_penalty", "no_timer", "speed_score_allowed", "preserve_correct_work", "undo_available", "pressure_rules", "audio_required", "audio_route", "audio_policy", "audio_provider", "audio_production_policy", "human_listening_approval_required", "browser_tts_allowed", "browser_tts_fallback"]) delete copy.body[key];
  return copy;
}
function countMissingFeedback(variants) { return variants.filter((variant) => !variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.science_evidence || !variant.feedback?.misconception_support || !variant.feedback?.model_or_fair_test_support).length; }
function countMissingRoute(variants) { return variants.filter((variant) => { const body = variant.body ?? {}, route = body.interaction_route ?? {}; return !route.touch || !route.keyboard || !route.switch_scan || !route.eye_gaze || !route.aac_point_adult_recorded || route.fine_dragging_required !== false || body.no_mandatory_fine_dragging !== true || body.no_mandatory_handwriting !== true || body.no_mandatory_speech !== true; }).length; }
function sortedCounts(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => String(left).localeCompare(String(right)))); }

function validateSurface(variant) {
  const results = variant.body.results_cm;
  const farther = variant.body.expected_farther_surface;
  if (!results || !farther || !results[farther]) throw new Error(`${variant.id} is missing surface results.`);
  const other = Object.keys(results).find((surface) => surface !== farther);
  if (!other || Math.min(...results[farther]) <= Math.max(...results[other])) {
    throw new Error(`${variant.id} has inconsistent surface evidence.`);
  }
}

function assertCovered(label, required, actual) {
  const missing = [...required].filter((value) => value && !actual.has(value));
  if (missing.length > 0) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`);
}

function effectChoices(expected) {
  const pool = [expected, "The object changes colour", "The object disappears", "Nothing about movement or shape changes", "The force stays stored inside the object"];
  return unique(pool).slice(0, 4);
}

function poleOutcome([left, right]) {
  return left === right ? "repel" : "attract";
}

function opposite(pole) {
  return pole === "N" ? "S" : "N";
}

function bandFor(index) {
  return ["intro", "developing", "expected", "secure", "stretch", "retrieval"][index % 6];
}

function difficultyFor(band) {
  return { intro: 2, developing: 3, expected: 5, secure: 6, stretch: 7, retrieval: 5 }[band];
}

function rotate(items, amount, limit = items.length) {
  const selected = items.slice(0, limit);
  const offset = amount % selected.length;
  return selected.slice(offset).concat(selected.slice(0, offset));
}

function unique(items) {
  return [...new Set(items)];
}

function capitalise(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function summary(variants, key) {
  const counts = new Map();
  for (const variant of variants) counts.set(key(variant), (counts.get(key(variant)) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, count]) => `${name}:${count}`).join(",");
}

function summaryCoverage(variants) {
  const counts = new Map();
  for (const variant of variants) {
    for (const tag of variant.body.coverage_tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([tag, count]) => `${tag}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
