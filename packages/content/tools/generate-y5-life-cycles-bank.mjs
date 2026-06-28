#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y5-life-cycles.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y5-life-cycles-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y5-life-cycles") {
  throw new Error("This generator only supports the Year 5 life-cycles pack.");
}

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) {
  throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);
}

const coreBands = ["intro", "developing", "expected", "secure", "stretch"];
const retrievalBands = ["retrieval", "intro", "developing", "expected", "secure", "stretch"];
const sequenceRepresentations = [
  "numbered picture-and-word cards",
  "a text-only stage list",
  "a labelled cycle model with a generation boundary",
  "a linear timeline with forward arrows",
  "an audio-described sequence with static cards",
];
const comparisonRepresentations = [
  "aligned stage rows",
  "a feature comparison table",
  "two text-described cycle models",
  "labelled freeze-frame cards",
  "an audio-described evidence grid",
];
const evidenceRepresentations = [
  "a dated observation table",
  "a labelled photograph sequence",
  "an audio-described field log",
  "a static graph with a text data table",
  "a secondary-source record",
];

const animalCycles = [
  { key: "fox", group: "mammal", stages: ["newborn fox cub", "growing cub", "adult fox", "reproduction produces a distinct new-generation cub"], explanation: "A fox cub grows with the same main mammalian body plan before becoming an adult that can reproduce; the offspring is a new individual." },
  { key: "rabbit", group: "mammal", stages: ["newborn rabbit", "growing juvenile rabbit", "adult rabbit", "reproduction produces a distinct new-generation rabbit"], explanation: "The juvenile rabbit grows into an adult without a major body-plan change, and reproduction begins a separate new generation." },
  { key: "hedgehog", group: "mammal", stages: ["newborn hedgehog", "growing juvenile hedgehog", "adult hedgehog", "reproduction produces a distinct new-generation hedgehog"], explanation: "The hedgehog grows through juvenile and adult stages; an adult does not become young again when offspring are produced." },
  { key: "robin", group: "bird", stages: ["robin egg", "hatchling chick", "fledgling robin", "adult robin", "reproduction produces distinct new-generation eggs"], explanation: "A robin hatches from an egg, grows through chick and fledgling stages, and an adult can reproduce to produce a new generation." },
  { key: "penguin", group: "bird", stages: ["penguin egg", "penguin chick", "juvenile penguin", "adult penguin", "reproduction produces distinct new-generation eggs"], explanation: "The penguin hatches and grows through recognisable bird stages before adulthood; new eggs belong to the next generation." },
  { key: "frog", group: "amphibian", stages: ["frogspawn containing eggs", "tadpole", "tadpole developing legs", "froglet", "adult frog", "reproduction produces distinct new-generation eggs"], explanation: "The tadpole changes body form during metamorphosis before becoming an adult frog; eggs produced by adults begin a new generation." },
  { key: "newt", group: "amphibian", stages: ["newt egg", "aquatic newt larva", "juvenile newt", "adult newt", "reproduction produces distinct new-generation eggs"], explanation: "A newt has an aquatic larval stage and changes as it develops into a juvenile and adult; later eggs are new organisms." },
  { key: "butterfly", group: "insect", stages: ["butterfly egg", "caterpillar larva", "pupa", "adult butterfly", "reproduction produces distinct new-generation eggs"], explanation: "Butterflies undergo complete metamorphosis through larva and pupa stages; an adult produces eggs for a different generation." },
  { key: "ladybird", group: "insect", stages: ["ladybird egg", "ladybird larva", "pupa", "adult ladybird", "reproduction produces distinct new-generation eggs"], explanation: "Ladybirds undergo complete metamorphosis, with larva and pupa stages that differ in form from the adult." },
  { key: "grasshopper", group: "insect", stages: ["grasshopper egg", "grasshopper nymph", "larger nymph after moulting", "adult grasshopper", "reproduction produces distinct new-generation eggs"], explanation: "Grasshoppers undergo incomplete metamorphosis: nymphs resemble smaller wingless adults and there is no pupa stage." },
];

const comparisonCases = [
  { key: "fox-robin", organisms: ["fox", "robin"], evidence: ["the selected fox gives birth to live young", "the robin hatches from an egg", "both juveniles grow before adulthood"], answer: "Both have juvenile growth and adult reproduction, but this fox begins as live young while the robin hatches from an egg", explanation: "The comparison uses the named species rather than claiming every mammal or bird is identical. Both produce offspring and grow, while their early stages differ." },
  { key: "robin-frog", organisms: ["robin", "frog"], evidence: ["both hatch from eggs", "a chick has the main bird body plan", "a tadpole has a different body form from an adult frog"], answer: "Both hatch, but the frog has a more dramatic metamorphosis from tadpole form than the robin's chick-to-adult growth", explanation: "Hatching is a similarity. The tadpole-to-frog transition includes a major body-form change, while a robin chick retains the main bird body plan as it grows." },
  { key: "butterfly-grasshopper", organisms: ["butterfly", "grasshopper"], evidence: ["butterfly: egg, larva, pupa, adult", "grasshopper: egg, nymph, adult"], answer: "Both are insects that metamorphose, but the butterfly has a pupa stage and the grasshopper does not", explanation: "The butterfly example shows complete metamorphosis. The grasshopper example shows incomplete metamorphosis through nymph stages without a pupa." },
  { key: "fox-butterfly", organisms: ["fox", "butterfly"], evidence: ["a fox cub shares the adult's main body plan", "a caterpillar differs greatly from an adult butterfly"], answer: "Both grow, but only the butterfly example includes complete metamorphosis with larva and pupa stages", explanation: "Growth occurs in both cycles. Complete metamorphosis is a particular sequence of major body-form changes and is not another word for all growth." },
  { key: "frog-butterfly", organisms: ["frog", "butterfly"], evidence: ["frog: egg, tadpole, froglet, adult", "butterfly: egg, larva, pupa, adult"], answer: "Both undergo metamorphosis, but their stages and body changes are not the same", explanation: "Both examples include substantial changes from juvenile to adult form. A butterfly has a pupa stage, whereas a frog develops through tadpole and froglet stages." },
  { key: "robin-penguin", organisms: ["robin", "penguin"], evidence: ["both named birds hatch from eggs", "both have chick and adult stages", "their timings and environments differ"], answer: "The two birds share an egg-chick-adult pattern, but one species must not be treated as an exact model for every bird", explanation: "The aligned pattern supports a useful similarity while the evidence warns that duration, environment and care can vary among bird species." },
  { key: "frog-newt", organisms: ["frog", "newt"], evidence: ["both have eggs and aquatic larvae", "frog larvae are tadpoles", "newt larvae retain different features as they develop"], answer: "Both amphibian examples include aquatic young and metamorphosis, but their detailed stages differ", explanation: "The comparison identifies a shared amphibian pattern without erasing species differences in larval form and development." },
  { key: "ladybird-butterfly", organisms: ["ladybird", "butterfly"], evidence: ["both sequences include egg, larva, pupa and adult", "the larval forms differ between species"], answer: "Both examples show complete metamorphosis even though their larvae and adults look different", explanation: "Complete metamorphosis is identified by the egg-larva-pupa-adult sequence, not by two species having identical appearances." },
  { key: "rabbit-hedgehog", organisms: ["rabbit", "hedgehog"], evidence: ["both selected mammals give birth to live young", "juveniles share the main adult body plan", "species features develop as they grow"], answer: "Both examples show mammalian juvenile growth without a larva or pupa stage, while species details remain different", explanation: "The evidence supports a shared pattern for these named mammals. It does not justify a claim that all mammals reproduce or develop identically." },
  { key: "grasshopper-robin", organisms: ["grasshopper", "robin"], evidence: ["both hatch from eggs", "a grasshopper nymph resembles a smaller adult", "a robin chick develops feathers and adult features"], answer: "Hatching is shared, but the grasshopper follows incomplete metamorphosis while the robin follows a bird growth pattern", explanation: "An egg stage alone does not make cycles identical. The later stages and type of body change provide the useful difference." },
];

const metamorphosisCases = [
  { key: "butterfly", stages: ["egg", "caterpillar larva", "pupa", "adult butterfly"], answer: "complete insect metamorphosis", explanation: "The caterpillar and adult have very different body forms, and a pupa stage separates larva from adult, so this is complete metamorphosis." },
  { key: "ladybird", stages: ["egg", "ladybird larva", "pupa", "adult ladybird"], answer: "complete insect metamorphosis", explanation: "The egg-larva-pupa-adult pattern and major form change identify complete metamorphosis in this ladybird example." },
  { key: "beetle", stages: ["egg", "beetle larva", "pupa", "adult beetle"], answer: "complete insect metamorphosis", explanation: "A beetle larva changes through a pupa into a differently formed adult, matching the complete metamorphosis pattern." },
  { key: "grasshopper", stages: ["egg", "nymph", "larger nymph after moulting", "adult grasshopper"], answer: "incomplete insect metamorphosis", explanation: "The nymph resembles a smaller adult and develops through moults without a pupa stage, so the metamorphosis is incomplete." },
  { key: "dragonfly", stages: ["egg", "aquatic nymph", "adult dragonfly"], answer: "incomplete insect metamorphosis", explanation: "The dragonfly changes from aquatic nymph to winged adult without a pupa stage, which is an incomplete metamorphosis pattern." },
  { key: "frog", stages: ["egg", "tadpole", "froglet", "adult frog"], answer: "amphibian metamorphosis", explanation: "The tadpole and adult frog have substantially different body forms and ways of living, so this is metamorphosis in an amphibian." },
  { key: "rabbit", stages: ["newborn rabbit", "juvenile rabbit", "adult rabbit"], answer: "growth without metamorphosis", explanation: "The rabbit becomes larger and develops adult features while retaining the same main body plan; ordinary growth is not metamorphosis." },
  { key: "robin", stages: ["hatchling chick", "fledgling", "adult robin"], answer: "growth without metamorphosis", explanation: "The robin grows and develops feathers and flight ability while keeping the main bird body plan, so this is not metamorphosis." },
  { key: "bean", stages: ["bean seed", "germinating seed", "seedling", "mature bean plant"], answer: "plant germination and growth, not animal metamorphosis", explanation: "Germination and plant development are important life-cycle processes, but metamorphosis describes a major animal body-form change." },
];

const plantCases = [
  { key: "full-sequence", evidence: ["a flower opens", "pollen reaches a suitable stigma", "seeds form after fertilisation", "seeds disperse and may germinate"], answer: "flowering → pollination → fertilisation → seed formation → dispersal → germination → new plant growth", explanation: "This sequence separates pollination from fertilisation and shows that flowering is not an endpoint; viable seeds can begin a distinct new generation under suitable conditions.", tag: "flower_is_endpoint" },
  { key: "pollination", evidence: ["pollen moves from an anther to a stigma", "no seed has formed at this observation"], answer: "This is pollination; fertilisation and seed formation may follow if conditions are suitable", explanation: "Pollination is the transfer of pollen to a stigma. It is not the same process as fertilisation, although it can make later fertilisation possible.", tag: "pollination_equals_fertilisation" },
  { key: "fertilisation", evidence: ["pollen has reached a compatible flower", "male and female reproductive cells join inside the flower"], answer: "This is fertilisation, which can lead to seed formation", explanation: "Fertilisation is the joining of reproductive cells after successful pollination. It occurs before the new seed develops.", tag: "pollination_equals_fertilisation" },
  { key: "germination", evidence: ["a viable seed receives water, oxygen and suitable warmth", "a root and shoot begin to emerge"], answer: "The seed is germinating; light is not a universal requirement for the first germination step", explanation: "Germination begins when a viable seed starts growth under suitable conditions, commonly including water, oxygen and an appropriate temperature.", tag: "light_always_needed_to_germinate" },
  { key: "wind-dispersal", evidence: ["a dandelion fruit has a light, parachute-like structure", "moving air carries it away"], answer: "This is wind dispersal, which moves seeds or fruits away from the parent plant", explanation: "The structure increases air resistance so wind can carry the fruit. Dispersal changes location; it is not germination or fertilisation.", tag: "dispersal_is_germination" },
  { key: "animal-dispersal", evidence: ["hooked burdock fruits attach to an animal's outer fur", "they later fall in another place"], answer: "This is external animal dispersal without implying that the plant or animal acts with a purpose", explanation: "Hooks make attachment possible and movement transports the fruits. The process can be explained by structure and contact without assigning intention.", tag: "anthropomorphic_dispersal" },
  { key: "runner", evidence: ["a strawberry plant forms a horizontal runner", "a new rooted plant develops at a node"], answer: "This is asexual reproduction because one parent plant produces a new plant without seed formation", explanation: "Vegetative growth from a runner can produce a new genetically very similar plant. This shows that not every new plant begins from a seed.", tag: "all_plants_begin_as_seeds" },
  { key: "bulb", evidence: ["a daffodil bulb produces an offset bulb", "the offset can grow as another plant"], answer: "This is vegetative asexual reproduction from a bulb", explanation: "An offset bulb can develop into a new plant from one parent. Seed formation is therefore not the only reproductive route in plants.", tag: "all_plants_begin_as_seeds" },
  { key: "flower-not-end", evidence: ["a flower has opened", "pollination and fertilisation have not yet been observed"], answer: "Flowering is a reproductive stage, not proof that the life cycle has ended or that seeds must form", explanation: "A flower supports reproduction, but further processes and suitable conditions are needed before viable seeds form and a new plant can begin.", tag: "flower_is_endpoint" },
  { key: "seed-versus-vegetative", evidence: ["plant A produces seeds after flowering", "plant B forms a new rooted plant from a stem runner"], answer: "Both can produce new plants, but only plant A's recorded route includes seed formation", explanation: "The evidence compares sexual reproduction through seeds with vegetative asexual reproduction. Both produce a new generation by different processes.", tag: "all_plants_begin_as_seeds" },
];

const observationCases = [
  { key: "seedling-series", evidence: ["day 4: shoot visible", "day 8: two leaves", "day 12: four leaves"], answer: "The records support growth across these dates, but they do not establish the plant's complete life-cycle duration", explanation: "Repeated observations show a change in visible leaf number over the recorded interval. They do not include every stage or justify a universal duration.", tag: "snapshot_proves_cycle" },
  { key: "one-photo", evidence: ["one photograph shows a tadpole on day 10"], answer: "The photograph records one stage at one time; more observations or reliable sources are needed to infer transition and duration", explanation: "A single image can identify a stage but cannot show the direction, rate or full sequence of change on its own.", tag: "snapshot_proves_cycle" },
  { key: "frog-series", evidence: ["week 1: tadpole", "week 4: hind legs visible", "week 8: froglet with a shrinking tail"], answer: "The sequence supports metamorphic change during the observed weeks, while unrecorded intervals limit precise timing", explanation: "The dated stages show ordered body-form change. Missing days mean the exact transition time cannot be identified from this dataset.", tag: "missing_interval_exact_time" },
  { key: "pupa-log", evidence: ["day 1: larva", "day 3: pupa", "day 12: empty pupal case and adult butterfly nearby"], answer: "The log supports a larva-pupa-adult sequence, but the final observation alone does not prove the nearby adult came from that exact pupa", explanation: "The ordered records support the expected transition. Identification of one individual would require continuous or securely linked evidence.", tag: "correlation_proves_identity" },
  { key: "nest-record", evidence: ["remote image 1: eggs", "remote image 2: chicks", "observer remains outside the marked distance"], answer: "The images support hatching between observations, and remote records reduce disturbance without giving an exact hatching time", explanation: "The stage difference justifies an interval claim. Ethical distance and missing time points limit what can be concluded precisely.", tag: "missing_interval_exact_time" },
  { key: "two-seedlings", evidence: ["seedling A is 6 cm on day 10", "seedling B is 4 cm on day 10"], answer: "The seedlings differ on day 10; two measurements do not prove one fixed growth rate for the species", explanation: "The evidence supports a difference between two recorded individuals at one time, not a universal rule about every plant of that species.", tag: "small_sample_universal_claim" },
  { key: "runner-record", evidence: ["week 1: runner touches soil", "week 3: roots visible at a node", "week 5: connected young plant has new leaves"], answer: "The observations support vegetative production of a new plant through a runner", explanation: "The sequence records contact, root formation and new shoot growth without a seed stage, which supports asexual reproduction by runner.", tag: "all_plants_begin_as_seeds" },
  { key: "flowering-record", evidence: ["flowers recorded in May", "fruits recorded in June", "seeds recorded in July"], answer: "The records support an ordered seasonal sequence for this sample, not an exact timetable for every plant or year", explanation: "Repeated records connect stages in this observed sample. Environmental variation means the dates should not be generalised as fixed for all cases.", tag: "sample_dates_universal" },
  { key: "secondary-source", evidence: ["a trusted field guide supplies an unobserved overwintering stage", "class observations cover only spring and summer"], answer: "The secondary source can extend the partial observations if its species and evidence quality are checked", explanation: "Some cycles are too long or unsuitable for direct classroom observation. A reliable source can fill gaps while remaining distinct from first-hand evidence.", tag: "classroom_must_observe_all" },
  { key: "stage-count", evidence: ["diagram A uses four labelled stages", "diagram B separates the juvenile period into three smaller stages"], answer: "Different stage counts can describe the same continuous development at different levels of detail", explanation: "Stage boundaries are useful model choices. More cards do not automatically mean a longer or more advanced life cycle.", tag: "more_stages_longer_cycle" },
];

const candidates = [
  ...buildOrderedStageCandidates(),
  ...buildComparisonCandidates(),
  ...buildMetamorphosisCandidates(),
  ...buildPlantCandidates(),
  ...buildEvidenceCandidates(),
];

validateBank(pack, curated, candidates);
pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 5 life-cycles bank reaches the 240-item pilot target with four preserved curated questions and deterministic candidates across all five blueprints and four registered formats. Generated candidates require species, curriculum, teacher, accessibility and safeguarding review before promotion.";

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`life-cycles-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`life-cycles-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`life-cycles-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`life-cycles-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`life-cycles-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 5 life-cycles bank is out of date; run generate-y5-life-cycles-bank.mjs --write.");
  console.log("life-cycles-bank deterministic check passed");
} else {
  console.log("life-cycles-bank dry-run; pass --write to update the pack");
}

function buildOrderedStageCandidates() {
  const variants = [];
  for (const [cycleIndex, cycle] of animalCycles.entries()) {
    for (const [viewIndex, representation] of sequenceRepresentations.entries()) {
      const index = cycleIndex * sequenceRepresentations.length + viewIndex;
      const correct = cycle.stages.join(" → ");
      const early = cycle.stages[0];
      const adult = cycle.stages.at(-2);
      const choices = rotate([
        correct,
        `${adult} → ${early} because the same individual becomes young again`,
        [...cycle.stages].reverse().join(" → "),
        cycle.stages.filter((stage) => !stage.startsWith("reproduction")).join(" → "),
      ], index % 4);
      variants.push(makeVariant({
        id: `ordered-${cycle.key}-${viewIndex + 1}`,
        format: "time-line",
        blueprint: "ordered-stages-and-generations",
        band: coreBands[index % coreBands.length],
        evidencePurpose: "ordered_stages_and_generation_identity",
        prompt: `Sequence record ${index + 1} uses ${representation} for a ${cycle.key}. Which sequence keeps stages forward and marks a distinct new generation?`,
        body: { organism: cycle.key, animal_group: cycle.group, stage_cards: cycle.stages, representation, choices, generation_boundary_required: true, text_model: correct },
        answer: correct,
        hints: ["Follow one individual from its early stage towards adulthood.", "Reproduction produces a different organism; the adult does not change backwards into its offspring."],
        explanation: `${cycle.explanation} The cycle repeats at population level across generations, while each individual continues forwards through its own stages.`,
        misconception: "individual_cycles_backwards",
        animation: "cycle-arrow-repair",
        index,
      }));
    }
  }
  return variants;
}

function buildComparisonCandidates() {
  const variants = [];
  for (const [caseIndex, item] of comparisonCases.entries()) {
    for (const [viewIndex, representation] of comparisonRepresentations.entries()) {
      const index = caseIndex * comparisonRepresentations.length + viewIndex;
      const choices = rotate([
        item.answer,
        "The two cycles are identical because both organisms grow",
        "Only one organism grows; metamorphosis replaces growth in the other",
        "The evidence proves every member of both animal groups follows exactly the same cycle",
      ], index % 4);
      variants.push(makeVariant({
        id: `compare-${item.key}-${viewIndex + 1}`,
        format: "compare-model",
        blueprint: "animal-group-cycle-comparisons",
        band: coreBands[(index + 1) % coreBands.length],
        evidencePurpose: "animal_cycle_similarity_difference_evidence",
        prompt: `Comparison record ${index + 1} presents ${representation} for ${item.organisms.join(" and ")}. Which claim uses all the evidence without overgeneralising?`,
        body: { organisms: item.organisms, evidence: item.evidence, representation, choices, comparison_rows: ["starting stage", "juvenile resemblance", "metamorphosis", "adult reproduction"], text_model: item.evidence.join("; ") },
        answer: item.answer,
        hints: ["State one supported similarity and one supported difference.", "Keep the claim tied to the named species rather than every member of a large animal group."],
        explanation: `${item.explanation} The conclusion is limited to what the aligned evidence supports and does not rank one cycle as better or more advanced.`,
        misconception: "all_animals_same_cycle",
        animation: "aligned-cycle-compare",
        index,
      }));
    }
  }
  return variants;
}

function buildMetamorphosisCandidates() {
  const variants = [];
  for (const [caseIndex, item] of metamorphosisCases.entries()) {
    for (const [viewIndex, representation] of comparisonRepresentations.entries()) {
      const index = caseIndex * comparisonRepresentations.length + viewIndex;
      const choices = rotate([
        item.answer,
        "growth always means complete metamorphosis",
        "reproduction because the same individual changes stage",
        "no biological change because every stage belongs to the same species",
      ], index % 4);
      variants.push(makeVariant({
        id: `metamorphosis-${item.key}-${viewIndex + 1}`,
        format: "life-status-sort",
        blueprint: "metamorphosis-patterns",
        band: coreBands[(index + 2) % coreBands.length],
        evidencePurpose: "growth_metamorphosis_pattern_classification",
        prompt: `Change-pattern card ${index + 1} uses ${representation}: ${item.stages.join(" → ")}. Which classification is scientifically accurate?`,
        body: { stage_cards: item.stages, representation, sort_categories: ["complete insect metamorphosis", "incomplete insect metamorphosis", "amphibian metamorphosis", "growth without metamorphosis", "plant germination and growth"], choices, text_model: item.stages.join(" then ") },
        answer: item.answer,
        hints: ["Look for a major change in body form, not simply an increase in size.", "For insects, check whether a pupa stage is present before choosing complete or incomplete metamorphosis."],
        explanation: `${item.explanation} Metamorphosis, ordinary growth and reproduction are separate processes and should not be used as interchangeable labels.`,
        misconception: "growth_equals_metamorphosis",
        animation: "metamorphosis-stage-compare",
        index,
      }));
    }
  }
  return variants;
}

function buildPlantCandidates() {
  const variants = [];
  for (const [caseIndex, item] of plantCases.entries()) {
    for (const [viewIndex, representation] of sequenceRepresentations.entries()) {
      const index = caseIndex * sequenceRepresentations.length + viewIndex;
      const choices = rotate([
        item.answer,
        "The mature plant changes backwards into a seed or young plant",
        "Pollination, fertilisation, dispersal and germination are different names for one event",
        "Every new plant must begin from a seed and all flowers automatically form viable seeds",
      ], index % 4);
      variants.push(makeVariant({
        id: `plant-${item.key}-${viewIndex + 1}`,
        format: "time-line",
        blueprint: "plant-reproduction-and-new-plants",
        band: coreBands[(index + 3) % coreBands.length],
        evidencePurpose: "plant_reproduction_process_sequence_and_evidence",
        prompt: `Plant process record ${index + 1} uses ${representation}. Evidence: ${item.evidence.join("; ")}. Which explanation is supported?`,
        body: { evidence: item.evidence, representation, process_labels: ["flowering", "pollination", "fertilisation", "seed formation", "dispersal", "germination", "vegetative reproduction"], choices, distinct_new_plant_marker: true, text_model: item.evidence.join(" then ") },
        answer: item.answer,
        hints: ["Separate pollen transfer, cell joining, seed formation, movement and germination.", "Check whether the evidence shows seed production or a vegetative route such as a runner or bulb."],
        explanation: `${item.explanation} The explanation uses observable structures and processes rather than assigning intention or purpose to the organism.`,
        misconception: item.tag,
        animation: "plant-evidence-timeline",
        index,
      }));
    }
  }
  return variants;
}

function buildEvidenceCandidates() {
  const variants = [];
  for (let index = 0; index < 41; index += 1) {
    const item = observationCases[index % observationCases.length];
    const representation = evidenceRepresentations[Math.floor(index / observationCases.length) % evidenceRepresentations.length];
    const choices = rotate([
      item.answer,
      "One record proves the exact life cycle and timing for every organism of the species",
      "Any missing stage can be invented because life-cycle diagrams are circular",
      "The observation shows that the individual changed backwards into an earlier stage",
    ], index % 4);
    variants.push(makeVariant({
      id: `evidence-${item.key}-${index + 1}`,
      format: "evidence-explain",
      blueprint: "observation-data-and-timescale",
      band: retrievalBands[index % retrievalBands.length],
      evidencePurpose: "observation_inference_timescale_and_limit",
      prompt: `Evidence log ${index + 1} presents ${representation}: ${item.evidence.join("; ")}. Which claim is justified and appropriately limited?`,
      body: { evidence: item.evidence, representation, choices, observation_or_inference_required: true, limitation_required: true, text_model: item.evidence.join(" | "), data_source: representation === "a secondary-source record" ? "reviewed secondary source" : "teacher-provided observation record" },
      answer: item.answer,
      hints: ["Separate what was directly observed from what is inferred between records.", "State a limitation when dates, individuals, sample size or stages are missing."],
      explanation: `${item.explanation} A cautious scientific claim reports the observed pattern while identifying what the available evidence cannot establish.`,
      misconception: item.tag,
      animation: "evidence-date-stamp",
      index,
    }));
  }
  return variants;
}

function makeVariant({ id, format, blueprint, band, evidencePurpose, prompt, body, answer, hints, explanation, misconception, animation, index }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt,
      ...body,
      evidence_purpose: evidencePurpose,
      variant_blueprint_id: blueprint,
      review_batch: "y5-life-cycles-pilot-a",
      difficulty_band: band,
      response_mode: responseMode(format),
      observation_safety: "Use teacher-provided images, ethical remote observations or reviewed sources; no handling, collecting or disturbing living organisms is required.",
      interaction_metadata: {
        keyboard: "All stage cards, comparison rows and evidence choices are reachable in reading order with visible focus and move buttons instead of drag-only controls.",
        switch: "Single-switch scanning supports select, move earlier or later, compare, undo, hear again and submit without timing pressure.",
        static_alternative: "Numbered still images and a complete linear text sequence provide the same evidence as every animated or circular model.",
        reduced_motion: "No hatching, growth or metamorphosis animation is required; changes appear as learner-controlled labelled frames.",
        visual_access: "Every organism image has a concise stage and feature description; labels, patterns and shapes supplement colour and size.",
        audio_and_language: "Prompts, stage names, evidence and feedback have sentence-level read-aloud, replay and glossary support.",
        processing_support: "One stage or comparison feature can be shown at a time while confirmed evidence remains visible.",
      },
      feedback: {
        success: "The record is verified because the order, comparison or claim is linked to biological evidence and a distinct new generation.",
        retry: feedbackFor(misconception),
        strategy_prompt: "Track one individual forwards, mark reproduction as a new generation, and separate observation from inference.",
      },
      gamification: {
        mission: missionFor(blueprint),
        success_condition: "Restore an ecology record only after the stage order or claim is supported by the displayed evidence and its limits.",
        feedback: "A verified evidence link restores one field-notebook page; speed, streaks and repeated animation do not affect progress.",
        no_time_pressure: true,
        ethical_rule: "Progress never depends on collecting, touching or disturbing an organism.",
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    difficulty: difficultyFor(band, index),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function validateBank(currentPack, authored, generated) {
  if (generated.length !== pilotTarget - authored.length) throw new Error(`Expected ${pilotTarget - authored.length} generated candidates, found ${generated.length}.`);
  const all = [...authored, ...generated];
  if (all.length !== pilotTarget) throw new Error(`Pilot bank must contain exactly ${pilotTarget} variants.`);
  if (new Set(all.map((variant) => variant.id)).size !== all.length) throw new Error("Variant ids are not unique.");

  const requiredBlueprints = new Set(currentPack.variant_blueprints.map((blueprint) => blueprint.id));
  const actualBlueprints = new Set(generated.map((variant) => variant.body.variant_blueprint_id));
  assertCovered("blueprint", requiredBlueprints, actualBlueprints);
  const requiredFormats = new Set(currentPack.practice.formats);
  const actualFormats = new Set(generated.map((variant) => variant.format));
  assertCovered("format", requiredFormats, actualFormats);
  const requiredBands = new Set([...currentPack.practice.difficulty_bands, ...currentPack.variant_blueprints.map((blueprint) => blueprint.difficulty_band)]);
  const actualBands = new Set(generated.map((variant) => variant.body.difficulty_band));
  assertCovered("difficulty band", requiredBands, actualBands);

  const signatures = new Set();
  for (const candidate of all) {
    const signature = `${candidate.format}|${candidate.body?.prompt?.trim().toLowerCase()}|${JSON.stringify(candidate.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature: ${candidate.id}.`);
    signatures.add(signature);
  }
  const anthropomorphicPattern = /\b(wants? to|decides? to|tries? to|knows? that|happy|sad|brave|kind|helpful|works? hard)\b/i;
  for (const candidate of generated) {
    if (candidate.status !== "review") throw new Error(`${candidate.id} is not review status.`);
    if (!requiredBlueprints.has(candidate.body.variant_blueprint_id)) throw new Error(`${candidate.id} has an unknown blueprint.`);
    if (!candidate.body.evidence_purpose || !candidate.body.review_batch) throw new Error(`${candidate.id} lacks review provenance.`);
    if (candidate.explanation.length < 110) throw new Error(`${candidate.id} explanation is too weak.`);
    if (!Array.isArray(candidate.body.choices) || !candidate.body.choices.includes(candidate.expected_answer.value)) throw new Error(`${candidate.id} answer is absent from its choices.`);
    if (new Set(candidate.body.choices).size !== candidate.body.choices.length) throw new Error(`${candidate.id} has duplicate choices.`);
    if (anthropomorphicPattern.test(JSON.stringify({ prompt: candidate.body.prompt, choices: candidate.body.choices, explanation: candidate.explanation }))) throw new Error(`${candidate.id} uses anthropomorphic wording.`);
    if ("answer" in candidate.body || "correct_answer" in candidate.body) throw new Error(`${candidate.id} leaks its answer in body metadata.`);
    for (const key of ["keyboard", "switch", "static_alternative", "reduced_motion", "visual_access", "audio_and_language", "processing_support"]) {
      if (!candidate.body.interaction_metadata?.[key]) throw new Error(`${candidate.id} lacks ${key} interaction metadata.`);
    }
    if (!candidate.body.text_model || !candidate.body.observation_safety || !candidate.body.feedback?.retry || !candidate.body.gamification?.success_condition || candidate.body.gamification.no_time_pressure !== true) {
      throw new Error(`${candidate.id} lacks model alternatives, feedback, safety or low-pressure gamification.`);
    }
  }
}

function feedbackFor(misconception) {
  const feedback = {
    individual_cycles_backwards: "Follow one organism forwards; place a generation boundary after reproduction instead of turning the adult into an early stage.",
    all_animals_same_cycle: "Align one shared feature and one difference, then keep the claim limited to the named species.",
    growth_equals_metamorphosis: "Separate increase in size from a major change in body form and check whether an insect pupa stage is present.",
    flower_is_endpoint: "Continue beyond flowering through possible pollination, fertilisation, seed formation, dispersal and germination.",
    pollination_equals_fertilisation: "Label pollen transfer and reproductive-cell joining as separate processes in the correct order.",
    light_always_needed_to_germinate: "Use water, oxygen and suitable temperature as the core germination conditions; do not make light universal.",
    dispersal_is_germination: "Dispersal changes seed location; germination begins later under suitable conditions.",
    anthropomorphic_dispersal: "Explain dispersal with structures, forces and contact instead of intentions.",
    all_plants_begin_as_seeds: "Check for vegetative routes such as runners or bulbs as well as seed formation.",
    snapshot_proves_cycle: "State only the observed stage, then request repeated observations or a reliable source for change and duration.",
    missing_interval_exact_time: "Use between the two recorded dates rather than claiming an exact unobserved time.",
    correlation_proves_identity: "Distinguish a likely sequence from proof that two records show the same individual.",
    small_sample_universal_claim: "Limit the conclusion to the measured organisms and dates.",
    sample_dates_universal: "Report the sample's pattern without turning its dates into a fixed rule.",
    classroom_must_observe_all: "Use an ethical, reviewed secondary source for stages that cannot be observed directly.",
    more_stages_longer_cycle: "Treat stage count as a modelling choice, not evidence of duration.",
  };
  return feedback[misconception] ?? "Return to the ordered evidence and state what it shows without adding intention or certainty.";
}

function missionFor(blueprint) {
  const missions = {
    "ordered-stages-and-generations": "Repair the ecology archive's generation markers.",
    "animal-group-cycle-comparisons": "Verify a species comparison panel.",
    "metamorphosis-patterns": "Calibrate the body-change classifier.",
    "plant-reproduction-and-new-plants": "Reconnect the plant process timeline.",
    "observation-data-and-timescale": "Audit a field record and its evidence limit.",
  };
  return missions[blueprint];
}

function responseMode(format) {
  if (format === "time-line") return "keyboard_switch_buttons_audio_or_partner_sequence";
  if (format === "compare-model") return "keyboard_switch_row_focus_audio_or_partner_compare";
  if (format === "life-status-sort") return "keyboard_switch_buttons_audio_or_partner_sort";
  return "keyboard_switch_touch_voice_or_partner_evidence_choice";
}

function difficultyFor(band, index) {
  const ranges = { intro: [2, 3], developing: [4, 5], expected: [5, 6], secure: [7, 8], stretch: [8, 9], retrieval: [3, 5] };
  const [minimum, maximum] = ranges[band];
  return minimum + (index % (maximum - minimum + 1));
}

function assertCovered(label, required, actual) {
  const missing = [...required].filter((value) => !actual.has(value));
  if (missing.length > 0) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`);
}

function rotate(items, amount) {
  return items.slice(amount).concat(items.slice(0, amount));
}

function summary(items, select) {
  const counts = new Map();
  for (const item of items) {
    const key = select(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
