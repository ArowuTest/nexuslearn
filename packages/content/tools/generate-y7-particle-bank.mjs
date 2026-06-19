#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y7-particles-states-of-matter.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y7-particles-states-of-matter-bank-";
const contexts = ["water", "wax", "oxygen", "iron", "ethanol", "carbon dioxide", "cooking oil"];

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y7-particles-states-of-matter") throw new Error("This generator only supports the Year 7 particle-model flagship.");
const authored = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix)).map((variant) => ({
  ...variant,
  body: {
    ...variant.body,
    particle_count_invariant: true,
    particle_size_invariant: true,
    evidence_purpose: variant.format === "model-sort" ? "state_model_identification" : variant.format === "particle-simulation" ? "energy_and_state_prediction" : "misconception_explanation",
    variant_blueprint_id: variant.format === "model-sort" ? "state-model-sorts" : variant.format === "particle-simulation" ? "energy-change-state-tests" : "change-of-state-explanations",
    review_batch: "y7-particles-proof-items",
  },
}));
const candidates = [...modelSortCandidates(), ...simulationCandidates(), ...explanationCandidates()];
pack.question_variants = [...authored, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Flagship authoring bank includes deterministic review candidates for particle-model identification, energy-change prediction and misconception explanation. Particle count and size are explicitly invariant.";
console.log(`particle-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`particle-bank formats=${formatSummary(candidates)}`);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`particle-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 7 particle bank is out of date; run generate-y7-particle-bank.mjs --write.");
  console.log("particle-bank deterministic check passed");
} else {
  console.log("particle-bank dry-run; pass --write to update the pack");
}

function modelSortCandidates() {
  const variants = [];
  const states = [
    { state: "solid", expected: "model_with_close_fixed_particles", clue: "close together in fixed positions", movement: "vibrate" },
    { state: "liquid", expected: "model_with_close_sliding_particles", clue: "close together without a fixed pattern", movement: "slide past each other" },
    { state: "gas", expected: "model_with_far_apart_random_particles", clue: "far apart in a random arrangement", movement: "move freely" },
  ];
  for (const state of states) {
    for (let set = 1; set <= 12; set += 1) {
      variants.push({
        id: `${prefix}model-${state.state}-${set}`,
        format: "model-sort",
        body: {
          prompt: `Model set ${set}: which chamber represents a ${state.state}?`,
          choices: ["A", "B", "C"],
          correct_state: state.state,
          required_features: [state.clue, state.movement],
          particle_count_invariant: true,
          particle_size_invariant: true,
          response_mode: "visual_or_described_model_choice",
          evidence_purpose: "state_model_identification",
          variant_blueprint_id: "state-model-sorts",
          review_batch: "y7-particles-pilot-a",
        },
        expected_answer: { value: state.expected },
        hints: [`Look for particles that are ${state.clue}.`, `In a ${state.state}, particles ${state.movement}.`],
        explanation: `A ${state.state} model shows particles ${state.clue}; they ${state.movement}.`,
        difficulty: 3 + (set % 3),
        status: "review",
        misconception_tag: state.state === "solid" ? "solid_particles_do_not_move" : "state_model_confusion",
        animation_hook: "three-state-particle-compare",
      });
    }
  }
  return variants;
}

function simulationCandidates() {
  const transitions = [
    { id: "melt", start: "solid", direction: "increase", final: "liquid", expected: "Particles move more and can slide past each other", tag: "melting_destroys_particles" },
    { id: "freeze", start: "liquid", direction: "decrease", final: "solid", expected: "Particles move less and settle into fixed positions", tag: "particles_expand" },
    { id: "evaporate", start: "liquid", direction: "increase", final: "gas", expected: "Particles move faster and become much farther apart", tag: "particles_expand" },
    { id: "condense", start: "gas", direction: "decrease", final: "liquid", expected: "Particles move less and become close enough to slide past each other", tag: "melting_destroys_particles" },
    { id: "warm-solid", start: "solid", direction: "small_increase", final: "solid", expected: "Particles vibrate more but remain in fixed positions", tag: "solid_particles_do_not_move" },
    { id: "cool-gas", start: "gas", direction: "small_decrease", final: "gas", expected: "Particles move more slowly but remain far apart", tag: "state_model_confusion" },
  ];
  const variants = [];
  for (const context of contexts) {
    for (const transition of transitions) {
      const choices = [
        transition.expected,
        "The particles become larger",
        "Some particles disappear",
        "The particles stop existing as the same substance",
      ];
      variants.push({
        id: `${prefix}simulation-${slug(context)}-${transition.id}`,
        format: "particle-simulation",
        body: {
          prompt: `Use the energy control for ${context}. What does the model show when energy has a ${transition.direction.replaceAll("_", " ")}?`,
          start_state: transition.start,
          target_state: transition.final,
          energy_change: transition.direction,
          control: "energy",
          choices: rotate(choices, variants.length % choices.length),
          particle_count_invariant: true,
          particle_size_invariant: true,
          freeze_frame_available: true,
          evidence_purpose: "energy_and_state_prediction",
          variant_blueprint_id: "energy-change-state-tests",
          review_batch: "y7-particles-pilot-a",
        },
        expected_answer: { value: transition.expected },
        hints: ["Track movement and arrangement.", "Particle size and particle count do not change in this model."],
        explanation: `${transition.expected}. The model keeps the same particles and changes their movement or arrangement.`,
        difficulty: transition.direction.startsWith("small") ? 7 : 5 + (contexts.indexOf(context) % 2),
        status: "review",
        misconception_tag: transition.tag,
        animation_hook: "energy-slider-melt",
      });
    }
  }
  return variants;
}

function explanationCandidates() {
  const claims = [
    { id: "solid-motion", prompt: "A learner says solid particles are completely still.", expected: "Solid particles vibrate in fixed positions", tag: "solid_particles_do_not_move" },
    { id: "particle-size", prompt: "A learner says heating makes each particle expand.", expected: "Heating changes particle movement and spacing, not particle size", tag: "particles_expand" },
    { id: "melting-count", prompt: "A learner says particles disappear when a solid melts.", expected: "The same particles remain while their arrangement and movement change", tag: "melting_destroys_particles" },
    { id: "gas-empty", prompt: "A learner says the gaps in a gas are filled with more gas particles.", expected: "The model shows particles far apart with empty space between them", tag: "state_model_confusion" },
    { id: "liquid-fixed", prompt: "A learner says liquid particles stay in a fixed pattern.", expected: "Liquid particles stay close but can move past each other", tag: "state_model_confusion" },
    { id: "new-particles", prompt: "A learner says cooling creates new particles.", expected: "Cooling reduces movement; it does not create particles", tag: "melting_destroys_particles" },
  ];
  const variants = [];
  for (const context of contexts) {
    for (const claim of claims) {
      const choices = [
        claim.expected,
        "The learner is correct because particles change identity",
        "The particles become larger or smaller to make the state",
        "The number of particles changes whenever energy changes",
      ];
      variants.push({
        id: `${prefix}explain-${slug(context)}-${claim.id}`,
        format: "explain-choice",
        body: {
          prompt: `${claim.prompt} Which explanation best corrects the model for ${context}?`,
          choices: rotate(choices, variants.length % choices.length),
          particle_count_invariant: true,
          particle_size_invariant: true,
          evidence_purpose: "misconception_explanation",
          variant_blueprint_id: "change-of-state-explanations",
          review_batch: "y7-particles-pilot-a",
        },
        expected_answer: { value: claim.expected },
        hints: ["Keep particle identity and count constant.", "Describe arrangement, spacing and movement."],
        explanation: `${claim.expected}. Particle models explain changes through movement, spacing and arrangement.`,
        difficulty: 6 + (contexts.indexOf(context) % 3),
        status: "review",
        misconception_tag: claim.tag,
        animation_hook: "particle-count-lock",
      });
    }
  }
  return variants;
}

function rotate(items, amount) {
  return items.slice(amount).concat(items.slice(0, amount));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatSummary(variants) {
  const counts = {};
  for (const variant of variants) counts[variant.format] = (counts[variant.format] ?? 0) + 1;
  return Object.entries(counts).sort().map(([format, count]) => `${format}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
