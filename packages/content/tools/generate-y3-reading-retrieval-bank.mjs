#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y3-reading-retrieval.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y3-reading-retrieval-bank-";
const reviewBatch = "y3-reading-retrieval-pilot-a";
const pilotAllocation = {
  "direct-detail-location": 46,
  "paraphrase-and-synonym-search": 44,
  "mixed-text-feature-retrieval": 48,
  "precise-recorded-answers": 46,
  "spaced-non-fiction-retrieval": 36,
};

const pages = [
  page("community-garden", "The Community Garden", "Growing", [
    fact("watering", "When are the young plants watered?", "At what time do gardeners give water to the young plants?", "early in the morning", "Volunteers water young plants early in the morning."),
    fact("paths", "What are the paths covered with?", "Which material lies over the paths?", "wood chips", "Wood chips cover the paths and help to hold moisture in the soil."),
  ], "Sharing the harvest", [
    fact("beans", "Where do climbing beans grow?", "What supports the climbing beans?", "up tall canes", "Climbing beans grow up tall canes beside the tool shed."),
    fact("produce", "Where does extra produce go?", "Who receives vegetables that the gardeners do not need?", "the neighbourhood food cupboard", "Extra produce is taken to the neighbourhood food cupboard on Fridays."),
  ], "Mira checks the seed trays. She moves them into the greenhouse before a cold night.", "Who does 'She' refer to?", "Mira", ["Mira", "the seed trays", "the greenhouse"], [["Plot A", "herbs"], ["Plot B", "beans"], ["Plot C", "strawberries"]], "A rain barrel beside the shed collects water from the roof.", "What does the rain barrel collect?", "water from the roof"),
  page("library-van", "The Mobile Library", "On the road", [
    fact("visits", "When does the van visit Hill End?", "On which day can people in Hill End use the mobile library?", "Tuesday afternoons", "The van visits Hill End on Tuesday afternoons."),
    fact("stops", "Where does it stop in Hill End?", "Which place is used as the Hill End stopping point?", "beside the village hall", "It stops beside the village hall for forty minutes."),
  ], "Using the van", [
    fact("borrowing", "How many books may each member borrow?", "What is the borrowing limit for one member?", "six books", "Each member may borrow up to six books at a time."),
    fact("returns", "Where can borrowed books be returned?", "At which two places may readers take books back?", "to the van or the main library", "Books can be returned to the van or to the main library in town."),
  ], "Omar sorts the returned books. He places them on a trolley before the van leaves.", "Who does 'He' refer to?", "Omar", ["Omar", "the returned books", "the trolley"], [["Hill End", "Tuesday"], ["Brook Lane", "Wednesday"], ["West Farm", "Friday"]], "A folding ramp gives step-free access through the side door.", "What does the folding ramp provide?", "step-free access"),
  page("weather-station", "Our Weather Station", "Measuring", [
    fact("rain", "What does the rain gauge measure?", "Which kind of weather is recorded by the gauge?", "the amount of rain", "The rain gauge measures the amount of rain that falls."),
    fact("wind", "Where is the wind vane fixed?", "What is the position of the wind vane?", "on the highest post", "The wind vane is fixed on the highest post, away from nearby walls."),
  ], "Recording", [
    fact("temperature", "When is the temperature recorded?", "At what two times do pupils note the temperature?", "at 9 a.m. and 3 p.m.", "Pupils record the temperature at 9 a.m. and 3 p.m."),
    fact("log", "Where are the readings written?", "Which book stores each weather reading?", "in a blue weather log", "Every reading is written in a blue weather log."),
  ], "Kai reads the thermometer. It shows twelve degrees at nine o'clock.", "What does 'It' refer to?", "the thermometer", ["the thermometer", "Kai", "nine o'clock"], [["Monday", "4 mm"], ["Tuesday", "0 mm"], ["Wednesday", "7 mm"]], "The cups on the anemometer turn when moving air pushes them.", "What makes the cups turn?", "moving air"),
  page("canal-lock", "How a Canal Lock Works", "Entering", [
    fact("gates", "What must happen before a boat enters?", "Which action makes the lock ready for a boat?", "the gates must open", "The gates must open fully before a boat enters the lock."),
    fact("ropes", "Where are the boat's ropes held?", "Who keeps hold of the ropes while the boat waits?", "by an adult on the boat", "An adult on the boat holds the ropes loosely."),
  ], "Changing the water", [
    fact("paddles", "What controls the flow of water?", "Which parts let water move into or out of the lock?", "small gates called paddles", "Small gates called paddles control the flow of water."),
    fact("leaves", "When can the boat leave?", "What must be level before the boat continues?", "when the water matches the next section", "The boat leaves when the water matches the level in the next section of canal."),
  ], "The lock keeper raises one paddle. It lets water enter slowly.", "What does 'It' refer to?", "one paddle", ["one paddle", "the lock keeper", "the boat"], [["Top gates", "closed at the top"], ["Water level", "rising"], ["Bottom gates", "closed at the bottom"]], "A painted line on the wall marks the safe highest water level.", "What does the painted line mark?", "the safe highest water level"),
  page("hedgehog", "Hedgehogs at Night", "Finding food", [
    fact("active", "When are hedgehogs most active?", "During which part of the day do hedgehogs usually search for food?", "after dusk", "Hedgehogs are most active after dusk, when gardens become quiet."),
    fact("diet", "What do they search for under leaves?", "Which food may hedgehogs locate beneath fallen leaves?", "beetles and worms", "They search under fallen leaves for beetles and worms."),
  ], "Safe shelter", [
    fact("nest", "What is a nest made from?", "Which materials form a hedgehog's resting nest?", "dry grass and leaves", "A resting nest is made from dry grass and leaves."),
    fact("gap", "Why is a small fence gap useful?", "What does a gap at the bottom of a fence allow?", "it lets hedgehogs move between gardens", "A small gap under a fence lets hedgehogs move between gardens."),
  ], "A hedgehog sniffs beside a log pile. It pushes its nose beneath the leaves.", "What does 'It' refer to?", "the hedgehog", ["the hedgehog", "the log pile", "the leaves"], [["Food", "beetles"], ["Active time", "after dusk"], ["Nest material", "dry leaves"]], "A shallow bowl allows a hedgehog to drink without climbing.", "What does the shallow bowl allow?", "drinking without climbing"),
  page("pottery", "Making a Clay Bowl", "Shaping", [
    fact("start", "What is done first to the clay?", "How does the potter begin preparing the clay?", "it is pressed and turned", "First, the clay is pressed and turned to remove pockets of air."),
    fact("thumb", "What makes the hollow in the middle?", "Which part of the hand begins the bowl's centre?", "a thumb", "A thumb presses a hollow into the middle of the clay."),
  ], "Finishing", [
    fact("dry", "How long does the bowl dry?", "What is the drying time before the first firing?", "two days", "The shaped bowl dries for two days before its first firing."),
    fact("glaze", "When is coloured glaze added?", "At which stage does the potter brush on coloured glaze?", "after the first firing", "After the first firing, coloured glaze is brushed onto the bowl."),
  ], "Leah smooths the rim with a damp sponge. This removes the rough marks.", "What does 'This' refer to?", "smoothing the rim with a damp sponge", ["smoothing the rim with a damp sponge", "the bowl", "the first firing"], [["Drying", "2 days"], ["First firing", "900°C"], ["Glaze firing", "1040°C"]], "The finished bowl has a blue spiral painted inside it.", "Where is the blue spiral?", "inside the bowl"),
  page("lighthouse", "Life at a Lighthouse", "The light", [
    fact("lamp", "Where is the main lamp kept?", "Which room contains the lighthouse lamp?", "in the lantern room", "The main lamp is kept in the glass lantern room at the top."),
    fact("flash", "How often does the light flash?", "What gap is there between flashes?", "every ten seconds", "Its turning lens makes the light flash every ten seconds."),
  ], "Daily checks", [
    fact("windows", "What is cleaned each morning?", "Which glass surfaces are washed at the start of the day?", "the lantern windows", "The lantern windows are cleaned each morning so the light stays clear."),
    fact("logbook", "What is entered in the logbook?", "Which details does the keeper record?", "weather and maintenance notes", "Weather and maintenance notes are entered in the logbook."),
  ], "The keeper tests the backup lamp. It can be used if the main lamp fails.", "What does 'It' refer to?", "the backup lamp", ["the backup lamp", "the keeper", "the logbook"], [["Main lamp", "checked daily"], ["Fog signal", "checked weekly"], ["Windows", "cleaned daily"]], "A red band around the tower makes it easier to recognise from the sea.", "What helps people recognise the tower?", "a red band"),
  page("museum", "Behind the Museum Display", "Preparing objects", [
    fact("gloves", "Why do staff wear gloves?", "What do gloves stop staff leaving on objects?", "marks from their hands", "Staff wear gloves so they do not leave marks from their hands."),
    fact("number", "What is attached to each object?", "Which small identifier does every object receive?", "a small record number", "A small record number is attached to each object."),
  ], "Building the case", [
    fact("labels", "Who checks the display labels?", "Which expert reads the labels before printing?", "a curator", "A curator checks the display labels before they are printed."),
    fact("light", "Why is the case light kept low?", "What does a low light level protect?", "colours in old materials", "The case light is kept low to protect colours in old materials."),
  ], "A conservator examines the old map. They record a tiny tear near its edge.", "Who does 'They' refer to?", "the conservator", ["the conservator", "the old map", "the tiny tear"], [["Map", "case 2"], ["Clay cup", "case 4"], ["Toy train", "case 6"]], "A support beneath the shoe holds it upright without piercing the leather.", "What does the support do?", "holds the shoe upright"),
  page("recycling", "From Bottle to Fleece", "Sorting", [
    fact("lids", "What is removed from the bottles?", "Which parts are taken off before washing?", "the lids and labels", "Workers remove the lids and labels from used plastic bottles."),
    fact("wash", "Why are the bottles washed?", "What does washing take away?", "dirt and leftover liquid", "The bottles are washed to remove dirt and leftover liquid."),
  ], "Making thread", [
    fact("flakes", "What are the bottles chopped into?", "What small pieces are made from the clean bottles?", "tiny plastic flakes", "Machines chop the clean bottles into tiny plastic flakes."),
    fact("thread", "What happens after the plastic melts?", "Which material is formed from the melted plastic?", "it is pulled into fine thread", "After the plastic melts, it is pulled into fine thread."),
  ], "The machine heats the clean flakes. They soften before passing through small holes.", "What does 'They' refer to?", "the clean flakes", ["the clean flakes", "the machine", "the small holes"], [["5 bottles", "one scarf"], ["12 bottles", "one hat"], ["25 bottles", "one fleece"]], "The finished fleece has a label showing that it contains recycled plastic.", "What does the label show?", "that the fleece contains recycled plastic"),
  page("theatre", "Preparing a Theatre Show", "Rehearsal", [
    fact("warmup", "What happens before rehearsal begins?", "Which activity prepares the actors for rehearsal?", "a voice and movement warm-up", "A voice and movement warm-up happens before rehearsal begins."),
    fact("marks", "What do tape marks show?", "Which information do coloured marks on the floor give actors?", "where actors should stand", "Coloured tape marks show where actors should stand."),
  ], "Backstage", [
    fact("props", "Where are small props stored?", "Which labelled place holds the smaller stage objects?", "in trays beside the stage", "Small props are stored in labelled trays beside the stage."),
    fact("call", "When is the five-minute call given?", "How long before the show does the stage manager warn everyone?", "five minutes before the show starts", "The stage manager gives a call five minutes before the show starts."),
  ], "Nia checks the prop list. She ticks each item after placing it in the correct tray.", "Who does 'She' refer to?", "Nia", ["Nia", "the prop list", "each item"], [["Doors open", "6:30"], ["Five-minute call", "6:55"], ["Show starts", "7:00"]], "A blue light backstage helps the crew see without lighting the stage.", "Why is the blue light used?", "to help the crew see without lighting the stage"),
  page("bee-hotel", "Building a Bee Hotel", "Choosing materials", [
    fact("stems", "What kind of stems are used?", "Which stems make safe nesting tubes?", "clean hollow stems", "Clean hollow stems are used to make nesting tubes."),
    fact("edges", "Why are rough edges sanded?", "What does sanding prevent on the stem openings?", "damage to bees' wings", "Rough edges are sanded so they cannot damage bees' wings."),
  ], "Placing the hotel", [
    fact("direction", "Which direction should the open side face?", "Where should the tube openings point?", "east or south-east", "The open side should face east or south-east."),
    fact("height", "How high is the hotel fixed?", "What is the minimum height above the ground?", "at least one metre above the ground", "The hotel is fixed at least one metre above the ground."),
  ], "Dev fills the wooden box with stems. He packs them firmly so they do not fall out.", "Who does 'He' refer to?", "Dev", ["Dev", "the wooden box", "the stems"], [["Stem width", "3–10 mm"], ["Minimum height", "1 m"], ["Roof overhang", "5 cm"]], "A sloping roof keeps heavy rain away from the open stems.", "What does the sloping roof keep away?", "heavy rain"),
  page("rockpool", "A Rockpool Visit", "Before looking", [
    fact("tide", "When should visitors check the tide times?", "At what point must the tide table be read?", "before leaving home", "Visitors should check the tide times before leaving home."),
    fact("shoes", "What footwear should visitors wear?", "Which shoes help people walk safely on wet rocks?", "shoes with gripping soles", "Shoes with gripping soles are needed on wet rocks."),
  ], "Looking carefully", [
    fact("stones", "How should stones be moved?", "What is the safe way to lift a small rock?", "gently, with two hands", "Small stones should be lifted gently, with two hands."),
    fact("replace", "What should happen after looking underneath?", "Where must each lifted stone be put afterwards?", "it should be replaced in the same position", "After looking underneath, replace each stone in the same position."),
  ], "A guide points to a shore crab. It stays still beneath a ledge.", "What does 'It' refer to?", "the shore crab", ["the shore crab", "the guide", "the ledge"], [["Low tide", "10:20"], ["Turn back", "11:05"], ["High tide", "16:32"]], "A clear tub lets visitors view a shrimp briefly before returning it.", "What can visitors view in the clear tub?", "a shrimp"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y3-reading-retrieval") throw new Error("This generator only supports the Year 3 reading retrieval pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...directCandidates(targets["direct-detail-location"]),
  ...paraphraseCandidates(targets["paraphrase-and-synonym-search"]),
  ...featureCandidates(targets["mixed-text-feature-retrieval"]),
  ...preciseCandidates(targets["precise-recorded-answers"]),
  ...spacedCandidates(targets["spaced-non-fiction-retrieval"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional sentence- or feature-level narration uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; unavailable audio shows an honest not-ready state while visible text and non-audio routes remain complete.";
pack.qa.notes = "Review-stage Year 3 retrieval pack with a deterministic 220-item pilot bank and four preserved curated variants. Progression covers direct evidence, heading and paragraph scanning, transparent pronoun/reference tracking, paraphrase matching, table and caption retrieval, concise recording and explicit distractor checks without assessing inference. Optional ElevenLabs narration requires human listening approval and browser TTS is prohibited. Independent English, teacher, SEND/dyslexia, accessibility, safeguarding, audio and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y3-reading-retrieval-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y3-reading-retrieval-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y3-reading-retrieval-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y3-reading-retrieval-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y3-reading-retrieval-bank progression=${summary(candidates, (variant) => variant.body.retrieval_stage)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-reading-retrieval-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 reading retrieval bank is out of date; run generate-y3-reading-retrieval-bank.mjs --write.");
  console.log("y3-reading-retrieval-bank deterministic check passed");
} else {
  console.log("y3-reading-retrieval-bank dry-run; pass --write to update the pack");
}

function directCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const source = pages[index % pages.length];
    const round = Math.floor(index / pages.length);
    if (round === 1) {
      return candidate({
        id: `reference-${source.id}`,
        format: "keyword-locate",
        blueprint: "direct-detail-location",
        band: "intro",
        stage: "pronoun_reference_tracking",
        prompt: `${source.pronoun.prompt} Read both sentences and choose the named person, animal, thing or action.`,
        body: { extract: source.pronoun.extract, choices: source.pronoun.choices, question_focus: "reference" },
        answer: source.pronoun.answer,
        hints: ["Read the sentence before the pronoun.", "Replace the pronoun with each choice and check which keeps the stated meaning."],
        explanation: `The first sentence names ${source.pronoun.answer}; the next sentence uses the reference word to continue about the same person, animal, thing or action.`,
        difficulty: 3,
        tag: "reference_word_mismatch",
        repair: "Keep the two sentences together, underline the reference word and test each named choice in its place.",
      });
    }
    const detail = source.facts[(round + index) % source.facts.length];
    const choices = rotate([detail.answer, ...detailDistractors(source, detail)], index % 3);
    return candidate({
      id: `direct-${detail.id}-${source.id}-${round}`,
      format: "keyword-locate",
      blueprint: "direct-detail-location",
      band: "intro",
      stage: round === 0 ? "locate_explicit_evidence" : "check_source_bound_distractors",
      prompt: detail.question,
      body: { extract: sentenceFor(source, detail), choices, question_focus: answerType(detail.question), source_rule: "choose_only_what_this_text_states" },
      answer: detail.answer,
      hints: ["Name the kind of answer the question requests.", "Find the sentence that states that detail; reject choices that are merely possible or interesting."],
      explanation: `The extract directly states '${detail.sentence}' This supports ${detail.answer}; the other choices are not stated as the answer.`,
      difficulty: round === 0 ? 2 : 3,
      tag: "answer_from_memory",
      repair: "Return to the exact sentence, attach its shortest useful phrase to the question and try again without using outside knowledge.",
    });
  });
}

function paraphraseCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const source = pages[index % pages.length];
    const round = Math.floor(index / pages.length);
    const detail = source.facts[(index + round + 1) % source.facts.length];
    const choices = rotate([detail.answer, ...detailDistractors(source, detail)], index % 3);
    return candidate({
      id: `paraphrase-${detail.id}-${source.id}-${round}`,
      format: "evidence-highlight",
      blueprint: "paraphrase-and-synonym-search",
      band: "developing",
      stage: round === 0 ? "scan_heading_then_paragraph" : "match_paraphrase_to_explicit_evidence",
      prompt: `${detail.paraphrase} Choose the smallest evidence phrase that answers it.`,
      body: { page_title: source.title, sections: source.sections, suggested_heading_choices: source.sections.map((section) => section.heading), choices, accepted_spans: [detail.answer], synonym_bridge: [detail.question, detail.paraphrase] },
      answer: detail.answer,
      hints: [`Scan the headings first; the useful section is '${headingFor(source, detail)}'.`, "The question changes the wording, but the answer is still stated directly in one sentence."],
      explanation: `'${detail.answer}' is the shortest stated phrase that answers the reworded question. No unstated cause, feeling or prediction is needed.`,
      difficulty: round === 0 ? 4 : 5,
      tag: "exact_word_search_only",
      repair: "Keep the headings visible, connect one question phrase to related wording in the text and reread the complete evidence sentence.",
    });
  });
}

function featureCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const source = pages[index % pages.length];
    const mode = Math.floor(index / pages.length);
    if (mode === 3) {
      const choices = rotate([source.caption.answer, source.table[0].value, source.table[1].value], index % 3);
      return candidate({
        id: `caption-${source.id}`,
        format: "text-feature-retrieve",
        blueprint: "mixed-text-feature-retrieval",
        band: "expected",
        stage: "retrieve_from_caption",
        prompt: `${source.caption.prompt} Use the caption, not the main paragraphs.`,
        body: { page_title: source.title, paragraph: source.sections[0].text, caption: source.caption.text, caption_alt_text: source.caption.text, choices, source_feature: "caption" },
        answer: source.caption.answer,
        hints: ["Move to the feature labelled Caption.", "Choose only the words that answer the caption question."],
        explanation: `The caption directly states ${source.caption.answer}. The paragraph and table details answer different questions.`,
        difficulty: 6,
        tag: "paragraph_only_search",
        repair: "Show the caption as one text-only panel, read it once and attach its answer phrase to the question.",
      });
    }
    const row = source.table[mode];
    const choices = rotate([row.value, ...source.table.filter((item) => item !== row).map((item) => item.value)], index % 3);
    return candidate({
      id: `table-${source.id}-${slug(row.label)}`,
      format: "text-feature-retrieve",
      blueprint: "mixed-text-feature-retrieval",
      band: "expected",
      stage: "retrieve_from_table_headers",
      prompt: `According to the fact table, what information is given for ${row.label}?`,
      body: { page_title: source.title, paragraph: source.sections[0].text, fact_table: source.table, table_headers: ["item", "information"], linear_table_text: source.table.map((item) => `${item.label}: ${item.value}`), choices, source_feature: "fact table" },
      answer: row.value,
      hints: [`Find the row headed '${row.label}'.`, "Read across that row to the information column."],
      explanation: `The '${row.label}' row states '${row.value}'. Other rows are real table details but do not answer this row question.`,
      difficulty: 5 + (mode % 2),
      tag: "paragraph_only_search",
      repair: "Use the linear table view, find the named row header and read only its paired information.",
    });
  });
}

function preciseCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const source = pages[index % pages.length];
    const round = Math.floor(index / pages.length);
    const detail = source.facts[(index + round + 2) % source.facts.length];
    const wholeSentence = detail.sentence;
    const incomplete = detail.answer.split(" ").slice(0, Math.max(1, detail.answer.split(" ").length - 1)).join(" ");
    const choices = rotate(unique([detail.answer, wholeSentence, detailDistractors(source, detail)[0], incomplete]), index % 4);
    return candidate({
      id: `concise-${detail.id}-${source.id}-${round}`,
      format: "record-answer",
      blueprint: "precise-recorded-answers",
      band: "secure",
      stage: round < 2 ? "select_concise_complete_evidence" : "check_relevant_distractors",
      prompt: `${detail.paraphrase} Which answer is complete but contains no extra detail?`,
      body: { page_title: source.title, sections: source.sections, choices, expected_keywords: importantWords(detail.answer), response_modes: ["choice", "typed", "oral", "adult_or_partner_recorded"], concise_answer_rule: "enough_context_no_irrelevant_copying" },
      answer: detail.answer,
      hints: ["Find the answer sentence, then remove information that answers a different question.", "Check that the remaining phrase is still complete and clear."],
      explanation: `'${detail.answer}' records all the requested information without copying the whole sentence or adding a nearby distractor detail.`,
      difficulty: round < 2 ? 7 : 8,
      tag: "copies_irrelevant_text",
      repair: "Compare each phrase with the question, cross out unrelated words and keep the shortest complete answer.",
    });
  });
}

function spacedCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const source = pages[index % pages.length];
    const round = Math.floor(index / pages.length);
    const detail = source.facts[(index + round + 3) % source.facts.length];
    const evidenceChoices = rotate([detail.sentence, ...source.facts.filter((item) => item !== detail).slice(0, 2).map((item) => item.sentence)], index % 3);
    return candidate({
      id: `spaced-${detail.id}-${source.id}-${round}`,
      format: "evidence-highlight",
      blueprint: "spaced-non-fiction-retrieval",
      band: "retrieval",
      stage: "spaced_source_and_distractor_check",
      prompt: `${detail.question} Which sentence proves the answer?`,
      body: { page_title: source.title, sections: source.sections, choices: evidenceChoices, answer_phrase: detail.answer, review_interval_days: [1, 3, 7, 14, 30][index % 5], review_queue: "mixed_non_fiction_retrieval", source_bound_check: true },
      answer: detail.sentence,
      hints: ["Use the heading to find the likely paragraph.", "Choose the sentence that states the requested detail, not another true sentence from the page."],
      explanation: `'${detail.sentence}' directly proves the answer ${detail.answer}. The distractors are stated facts, but they answer different questions.`,
      difficulty: 4 + (round % 2),
      tag: round === 0 ? "answer_from_memory" : "copies_irrelevant_text",
      repair: "Restate the question focus, scan one heading at a time and test the chosen sentence against that exact focus.",
    });
  });
}

function candidate({ id, format, blueprint, band, stage, prompt, body, answer, hints, explanation, difficulty, tag, repair }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...body,
      retrieval_stage: stage,
      difficulty_band: band,
      evidence_purpose: stage,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_speak_or_adult_record",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, voice_or_partner_recording: true, precision_drag_required: false, undo_available: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, line_focus: true, tinted_background_option: true, chunked_sentence_view: true, readable_font_option: true },
      reduced_visual_load: true,
      one_feature_per_screen_option: true,
      static_highlight_mode: true,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      gamification: { reward: "one calm explorer-journal stamp for using a retrieval strategy", loss_on_error: false, streak_pressure: false, retry_message: "That choice gives us a useful search clue. Check the source again." },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: "You matched the question to evidence stated on the page.", repair },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: "retrieval-path-build",
  };
}

function validateBank(currentPack, curated, generated) {
  if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} variants, found ${currentPack.question_variants.length}.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} uses the wrong difficulty band.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain exactly one expected answer.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.precision_drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.dyslexia_support?.increased_spacing || !variant.body.dyslexia_support?.line_focus || !variant.body.dyslexia_support?.chunked_sentence_view || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND/dyslexia scaffolds.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.leaderboard_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces performance pressure.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (!variant.feedback?.repair || variant.hints?.length < 2 || variant.explanation.length < 70) throw new Error(`${variant.id} lacks useful feedback.`);
    if (/infer|probably|might feel|suggests that/i.test(`${variant.body.prompt} ${variant.explanation}`)) throw new Error(`${variant.id} drifts into inference.`);
    if (/api[_-]?key|secret|bearer\s|access[_-]?token/i.test(JSON.stringify(variant))) throw new Error(`${variant.id} contains secret-like text.`);
  }
  const allocation = combinedAllocation(curated, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  const requiredStages = ["locate_explicit_evidence", "pronoun_reference_tracking", "scan_heading_then_paragraph", "match_paraphrase_to_explicit_evidence", "retrieve_from_table_headers", "retrieve_from_caption", "select_concise_complete_evidence", "check_relevant_distractors", "spaced_source_and_distractor_check"];
  const stages = new Set(generated.map((variant) => variant.body.retrieval_stage));
  for (const stage of requiredStages) if (!stages.has(stage)) throw new Error(`Missing retrieval progression stage ${stage}.`);
}

function page(id, title, headingOne, factsOne, headingTwo, factsTwo, pronounExtract, pronounPrompt, pronounAnswer, pronounChoices, rows, captionText, captionPrompt, captionAnswer) {
  const table = rows.map(([label, value]) => ({ label, value }));
  const sections = [{ heading: headingOne, text: factsOne.map((item) => item.sentence).join(" ") }, { heading: headingTwo, text: factsTwo.map((item) => item.sentence).join(" ") }];
  return { id, title, sections, facts: [...factsOne, ...factsTwo], pronoun: { extract: pronounExtract, prompt: pronounPrompt, answer: pronounAnswer, choices: pronounChoices }, table, caption: { text: captionText, prompt: captionPrompt, answer: captionAnswer } };
}
function fact(id, question, paraphrase, answer, sentence) { return { id, question, paraphrase, answer, sentence }; }
function sentenceFor(source, detail) { return source.sections.find((section) => section.text.includes(detail.sentence))?.text ?? detail.sentence; }
function headingFor(source, detail) { return source.sections.find((section) => section.text.includes(detail.sentence))?.heading ?? source.sections[0].heading; }
function detailDistractors(source, detail) { return source.facts.filter((item) => item !== detail).map((item) => item.answer).filter((answer) => answer !== detail.answer).slice(0, 2); }
function importantWords(answer) { return answer.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((word) => word.length > 3).slice(0, 4); }
function answerType(question) { if (/when|time|day|how often/i.test(question)) return "time"; if (/where/i.test(question)) return "place"; if (/how many|how long|how high/i.test(question)) return "number_or_measure"; if (/who/i.test(question)) return "person"; return "thing_or_action"; }
function curatedBlueprint(variant) { const map = { "en-y3-reading-retrieval-q-puffin-location": "paraphrase-and-synonym-search", "en-y3-reading-retrieval-q-lizard-table": "mixed-text-feature-retrieval", "en-y3-reading-retrieval-q-rain-gauge": "precise-recorded-answers", "en-y3-reading-retrieval-q-text-not-memory": "direct-detail-location" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curated, generated) { const counts = countBy(curated, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curated, generated) { return Object.entries(combinedAllocation(curated, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
