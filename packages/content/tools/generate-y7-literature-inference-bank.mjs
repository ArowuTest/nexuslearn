#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const defaultPack = path.join(repoRoot, 'packages/content/packs/en-y7-literature-evidence-inference.pack.sample.json');
const packPath = path.resolve(argValue('--pack') ?? defaultPack);
const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
const prefix = 'en-y7-literature-inference-bank-';
const pilotTarget = 220;

if (write && check) throw new Error('Choose either --write or --check, not both.');
const originalText = await readFile(packPath, 'utf8');
const pack = JSON.parse(originalText);
if (pack.pack_id !== 'en-y7-literature-evidence-inference') throw new Error('Wrong pack.');
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) throw new Error(`Expected 3 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const extracts = [
  {
    key: 'archive', form: 'prose', genre: 'speculative mystery', voice: 'close third person', theme: 'courage and uncertainty',
    text: `At the archive door, Nia lifted her hand twice before she knocked. Behind the glass, blue lamps blinked in a patient row. She called the delay caution, yet her fingers stayed curled against her palm.`,
    mood: 'uneasy anticipation', moodSpans: ['lifted her hand twice before she knocked', 'her fingers stayed curled against her palm'],
    inference: 'Nia wants to act but feels apprehensive', evidence: 'her fingers stayed curled against her palm',
    distractors: ['Behind the glass', 'blue lamps', 'a patient row'], quote: 'called the delay caution',
    effect: 'The self-correction sounds defensive, suggesting Nia is trying to rename fear as sensible caution.',
    alternative: 'She may be carefully assessing a genuine risk rather than simply feeling afraid.', more: 'what Nia knows about the archive and how she behaves after the door opens',
    structure: 'The final clause contrasts Nia\'s explanation with her physical reaction.', structureEffect: 'Her body quietly challenges the confidence of the label she gives the delay.'
  },
  {
    key: 'harbour', form: 'prose', genre: 'coastal adventure', voice: 'first person', theme: 'responsibility under pressure',
    text: `The harbour bell struck once, then vanished beneath the wind. I tightened the rope although the knot was already firm. Across the water, our smallest boat lifted like a question and dropped out of sight.`,
    mood: 'tense uncertainty', moodSpans: ['vanished beneath the wind', 'lifted like a question and dropped out of sight'],
    inference: 'the narrator is anxious and seeks control', evidence: 'I tightened the rope although the knot was already firm',
    distractors: ['The harbour bell', 'Across the water', 'our smallest boat'], quote: 'lifted like a question',
    effect: 'The simile turns the boat\'s movement into uncertainty, as if the storm has made the outcome impossible to answer.',
    alternative: 'The narrator may be methodical rather than panicked, checking equipment before conditions worsen.', more: 'whether later decisions are controlled or impulsive',
    structure: 'The final clause removes the boat from view.', structureEffect: 'Ending on disappearance leaves the danger unresolved.'
  },
  {
    key: 'stage', form: 'prose', genre: 'school realism', voice: 'first person', theme: 'belonging and confidence',
    text: `My name waited on the cast list between two people who already had nicknames. In rehearsal, I spoke my first line too softly. By Friday, I had stopped checking whether anyone was listening before I began.`,
    mood: 'growing confidence', moodSpans: ['spoke my first line too softly', 'stopped checking whether anyone was listening'],
    inference: 'the narrator becomes more confident across the week', evidence: 'By Friday, I had stopped checking whether anyone was listening before I began',
    distractors: ['the cast list', 'two people', 'In rehearsal'], quote: 'My name waited',
    effect: 'Personifying the name as waiting reflects early uncertainty about belonging.',
    alternative: 'The narrator may still feel separate from the established group despite speaking more confidently.', more: 'how the others respond outside rehearsal',
    structure: 'The extract moves from the cast list to rehearsal and then to Friday.', structureEffect: 'The time sequence shows change through behaviour rather than announcing it.'
  },
  {
    key: 'glasswood', form: 'prose', genre: 'fantasy', voice: 'third person', theme: 'respect for the unknown',
    text: `Every tree in the Glasswood held a different piece of sky. Toma reached for the nearest silver leaf, but the branches chimed before his hand arrived. He lowered his arm. The path, which had seemed empty, now felt watchful.`,
    mood: 'enchanted unease', moodSpans: ['the branches chimed before his hand arrived', 'now felt watchful'],
    inference: 'Toma becomes cautious because the forest seems responsive', evidence: 'He lowered his arm',
    distractors: ['a different piece of sky', 'the nearest silver leaf', 'The path'], quote: 'held a different piece of sky',
    effect: 'The image makes each tree seem to contain something vast and strange, establishing wonder before warning.',
    alternative: 'Toma\'s lowered arm may show respect and curiosity rather than fear.', more: 'whether he retreats or continues carefully',
    structure: 'A short sentence follows the chiming branches.', structureEffect: 'The abrupt action marks an immediate change from reaching to restraint.'
  },
  {
    key: 'station', form: 'prose', genre: 'science fiction', voice: 'third person', theme: 'memory and home',
    text: `On the station, sunrise arrived by timetable. Lio opened the garden hatch anyway and waited for the lamps to warm. When the first tomato leaf unfolded, he breathed the word home so quietly that the fans carried it nowhere.`,
    mood: 'tender loneliness', moodSpans: ['sunrise arrived by timetable', 'breathed the word home so quietly'],
    inference: 'the garden connects Lio with a home he misses', evidence: 'he breathed the word home',
    distractors: ['the garden hatch', 'the lamps', 'the first tomato leaf'], quote: 'the fans carried it nowhere',
    effect: 'The final image emphasises isolation because Lio\'s private word is not heard or shared.',
    alternative: 'The quiet moment may be comforting because Lio creates a private sense of home.', more: 'whether he returns to the garden for comfort',
    structure: 'The extract moves from mechanical sunrise to a living leaf.', structureEffect: 'The contrast gives the small natural growth emotional importance.'
  },
  {
    key: 'market', form: 'prose', genre: 'historical adventure', voice: 'close third person', theme: 'trust and deception',
    text: `The map seller smiled before Sefa had named a price. His stall displayed seven compasses, all pointing in different directions. A rare map, he said, covering one torn corner with his thumb.`,
    mood: 'suspicious', moodSpans: ['all pointing in different directions', 'covering one torn corner with his thumb'],
    inference: 'the seller may be hiding a flaw or misleading Sefa', evidence: 'covering one torn corner with his thumb',
    distractors: ['The map seller smiled', 'seven compasses', 'A rare map'], quote: 'smiled before Sefa had named a price',
    effect: 'The timing makes the friendliness seem calculated rather than fully open.',
    alternative: 'The seller may simply be welcoming and protecting a fragile map.', more: 'the map\'s accuracy and the seller\'s answer about the tear',
    structure: 'The sales claim is followed by a concealing gesture.', structureEffect: 'The gesture quietly undermines the confident sales language.'
  },
  {
    key: 'key-dialogue', form: 'drama-like', genre: 'comic mystery', voice: 'dialogue and stage direction', theme: 'honesty and embarrassment',
    text: `MIRA: The key was definitely here.\n[She checks the same empty pocket for the third time.]\nJON: Definitely?\nMIRA: Almost definitely.`,
    mood: 'awkward comedy', moodSpans: ['for the third time', 'Almost definitely'],
    inference: 'Mira is losing confidence in her claim', evidence: 'Almost definitely',
    distractors: ['The key', 'same empty pocket', 'JON'], quote: 'Definitely?',
    effect: 'Jon\'s one-word question exposes the gap between Mira\'s certainty and the failed search.',
    alternative: 'Mira may be joking deliberately to reduce tension.', more: 'Mira\'s tone or next action',
    structure: 'The stage direction interrupts Mira\'s confident statement.', structureEffect: 'The visible failed search contradicts her words and creates comic irony.'
  },
  {
    key: 'bridge-dialogue', form: 'drama-like', genre: 'family drama', voice: 'dialogue and stage direction', theme: 'pride and reconciliation',
    text: `AMAL: I did not ask you to follow me.\n[He keeps one hand on the loose bridge rail.]\nREENA: No. You only left the gate open.\n[Amal looks back, then steadies the rail for her.]`,
    mood: 'strained but softening', moodSpans: ['keeps one hand on the loose bridge rail', 'steadies the rail for her'],
    inference: 'Amal\'s actions show concern despite his defensive words', evidence: 'steadies the rail for her',
    distractors: ['the gate', 'looks back', 'I did not ask'], quote: 'You only left the gate open',
    effect: 'Reena\'s clipped reply challenges Amal while hinting that his care was indirect rather than absent.',
    alternative: 'Amal may be acting from practical caution rather than reconciliation.', more: 'what Amal says after they cross',
    structure: 'The final stage direction contrasts with Amal\'s opening denial.', structureEffect: 'His protective action complicates the conflict by showing care his speech refuses to admit.'
  },
  {
    key: 'river', form: 'poetry', genre: 'nature poem', voice: 'first-person observer', theme: 'change and persistence',
    text: `At dawn the river loosens\nits grey scarf from the stones.\nBy noon it carries windows,\nclouds, and one red kite downstream.`,
    mood: 'quiet renewal', moodSpans: ['loosens\nits grey scarf', 'carries windows,\nclouds'],
    inference: 'the river changes with the day while continuing onward', evidence: 'By noon it carries windows',
    distractors: ['the stones', 'one red kite', 'downstream'], quote: 'its grey scarf',
    effect: 'The metaphor gives morning mist a soft, removable texture, suggesting the river waking into clarity.',
    alternative: 'The river may seem burdened by the reflected town rather than simply renewed.', more: 'later images of what the river carries',
    structure: 'The poem shifts from dawn to noon.', structureEffect: 'The time shift lets changing light transform what the same river appears to hold.'
  },
  {
    key: 'city', form: 'poetry', genre: 'urban lyric', voice: 'second person', theme: 'ordinary places',
    text: `You hear the shutters cough awake,\none street at a time.\nA bus kneels at the kerb;\nthe morning climbs aboard.`,
    mood: 'lively awakening', moodSpans: ['shutters cough awake', 'the morning climbs aboard'],
    inference: 'the city is imagined as gradually coming alive', evidence: 'one street at a time',
    distractors: ['A bus', 'the kerb', 'You hear'], quote: 'A bus kneels',
    effect: 'The personification makes the lowering bus seem courteous, giving machinery a human role in the waking city.',
    alternative: 'The coughing shutters may suggest the city wakes reluctantly or wearily.', more: 'whether later sounds are energetic or tired',
    structure: 'The final line turns morning into a passenger.', structureEffect: 'The closing image gathers separate details into playful shared movement.'
  },
  {
    key: 'ticket', form: 'poetry', genre: 'memory poem', voice: 'first person', theme: 'memory and loss',
    text: `I keep the summer ticket\nin a box that will not close.\nIts ink has thinned to rain,\nbut the date still holds its ground.`,
    mood: 'gentle sadness', moodSpans: ['a box that will not close', 'Its ink has thinned to rain'],
    inference: 'the speaker is reluctant to let a memory fade', evidence: 'the date still holds its ground',
    distractors: ['the summer ticket', 'a box', 'the date'], quote: 'holds its ground',
    effect: 'The phrase gives the fading date resilience, suggesting one part of the memory resists disappearance.',
    alternative: 'The unclosing box may suggest the memory feels intrusive rather than simply precious.', more: 'whether the speaker revisits or hides the ticket',
    structure: 'The poem contrasts thinning ink with a date that remains.', structureEffect: 'The contrast separates fading physical evidence from persistent significance.'
  },
  {
    key: 'tideline', form: 'prose', genre: 'environmental fiction', voice: 'first person', theme: 'stewardship and consequence',
    text: `Yesterday the tideline glittered. Today, close up, the brightness was bottle caps and torn foil. I filled one sack, then another, while gulls stepped around me as if I were the visitor.`,
    mood: 'disillusioned resolve', moodSpans: ['the brightness was bottle caps and torn foil', 'I filled one sack, then another'],
    inference: 'the narrator moves from admiration to determined action', evidence: 'I filled one sack, then another',
    distractors: ['the tideline', 'gulls', 'the visitor'], quote: 'glittered',
    effect: 'The attractive verb is corrected by close-up detail, exposing how distance disguised pollution as beauty.',
    alternative: 'The gulls may prompt the narrator to question whether people belong responsibly in the habitat.', more: 'how human presence is described elsewhere',
    structure: 'The second sentence corrects the first impression.', structureEffect: 'The reversal enacts a move from surface appearance to uncomfortable knowledge.'
  }
];

const candidates = [
  ...expand('mood', 44, buildMood),
  ...expand('quote', 44, buildQuote),
  ...expand('effect', 43, buildEffect),
  ...expand('response', 43, buildResponse),
  ...expand('retrieval', 43, buildRetrieval),
];

pack.question_variants = [...curated, ...candidates];
pack.version = '0.2.0';
pack.qa.readiness_status = 'draft';
pack.qa.notes = 'Year 7 literary inference pilot reaches 220 variants with three curated questions preserved semantically and structurally unchanged and 217 deterministic review candidates. All generated micro-extracts are original NexusLearn text with explicit rights metadata across prose, poetry and drama-like writing. Coverage includes precise evidence, explicit and inferred meaning, mood, character, theme, imagery, structure, writer effect, evidence sufficiency, overclaiming, competing defensible interpretations and discriminating additional evidence. Auto-marked items use exact-span links; all 43 short responses require complete rubrics and teacher/adult moderation. SEND routes, pressure-free retrieval and optional reviewed ElevenLabs readings are included; browser TTS is prohibited.';

validateBank(pack, curated, candidates, curatedSnapshot);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`literature-inference-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`literature-inference-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`literature-inference-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`literature-inference-bank forms=${summary(candidates, (variant) => variant.body.source_metadata.form)}`);
console.log(`literature-inference-bank moderated_open=${candidates.filter((variant) => variant.format === 'short-response').length} audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, 'utf8');
  console.log(`literature-inference-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error('Year 7 literature-inference bank is out of date; run generate-y7-literature-inference-bank.mjs --write.');
  console.log('literature-inference-bank deterministic check passed');
} else {
  console.log('literature-inference-bank dry-run; pass --write to update the pack');
}

function buildMood(extract, index, id) {
  return autoCandidate({
    id, index, extract, format: 'evidence-highlight', blueprint: 'mood-word-highlights', band: index < 15 ? 'developing' : 'expected',
    prompt: `Mood evidence ${index + 1}: highlight the exact spans that most strongly create ${extract.mood}.`,
    choices: [...extract.moodSpans, ...extract.distractors.slice(0, 2)], answer: extract.moodSpans, spans: extract.moodSpans,
    hints: ['Choose connotative words or actions, not merely an interesting object.', 'Test each span against the named mood and retain only direct evidence.'],
    explanation: `${quoted(extract.moodSpans)} create ${extract.mood}; the other details occur in the extract but carry less direct mood evidence.`,
    tag: 'retelling_not_inference', focus: 'mood_and_atmosphere'
  });
}

function buildQuote(extract, index, id) {
  return autoCandidate({
    id, index, extract, format: 'analysis-builder', blueprint: 'quote-relevance-tests', band: index < 15 ? 'developing' : 'expected',
    prompt: `Evidence relevance ${index + 1}: which exact quotation best supports the inference that ${extract.inference}?`,
    choices: [extract.evidence, ...extract.distractors], answer: extract.evidence, spans: [extract.evidence],
    hints: ['Restate the inference, then ask what each quotation actually proves.', 'Prefer the shortest sufficient quotation over a vivid but unrelated detail.'],
    explanation: `“${extract.evidence}” directly supports the inference that ${extract.inference}; the distractors are merely interesting or less relevant.`,
    tag: 'irrelevant_evidence', focus: 'quote_relevance'
  });
}

function buildEffect(extract, index, id) {
  const family = index % 4;
  let prompt;
  let answer;
  let choices;
  let span;
  let focus;
  if (family === 0) {
    span = extract.quote; focus = 'language_effect';
    prompt = `Which analysis most precisely explains “${extract.quote}”?`;
    answer = extract.effect;
    choices = [answer, 'The quotation is effective because it is a good quotation.', 'It retells the event but does not interpret the wording.', 'It guarantees that every reader has exactly one emotion.'];
  } else if (family === 1) {
    span = extract.evidence; focus = 'explicit_and_inferred_meaning';
    prompt = 'Which statement correctly separates explicit detail from inference?';
    answer = `The text explicitly states “${extract.evidence}”; from this, ${extract.inference} can be inferred rather than treated as directly stated fact.`;
    choices = [answer, `The text explicitly states that ${extract.inference}, so no evidence link is needed.`, 'Nothing can be inferred unless a narrator explains it directly.', 'The quotation is interesting but cannot support interpretation.'];
  } else if (family === 2) {
    span = extract.evidence; focus = 'competing_interpretations';
    prompt = 'Which comparison handles competing interpretations responsibly?';
    answer = `The inference that ${extract.inference} is supported by “${extract.evidence}”. However, ${extract.alternative} Evidence about ${extract.more} would help discriminate between them.`;
    choices = [answer, 'Only the first interpretation can be true because literary evidence has one fixed meaning.', 'Both interpretations are equally strong without textual evidence.', 'The alternative is false because it is less obvious.'];
  } else {
    span = extract.quote; focus = 'sentence_and_structure_effect';
    prompt = 'Which analysis explains a structural choice rather than merely naming it?';
    answer = `${extract.structure} ${extract.structureEffect}`;
    choices = [answer, 'The writer uses structure, which automatically creates interest.', 'The events occur in this order because that is what happened.', 'The structure forces every reader to agree.'];
  }
  return autoCandidate({
    id, index, extract, format: 'analysis-builder', blueprint: 'writer-effect-bridges', band: family < 2 ? 'secure' : 'stretch',
    prompt: `Analysis bridge ${index + 1}: ${prompt}`, choices, answer, spans: [span],
    hints: ['Name the choice, explain what it suggests here and limit the claim to the evidence.', 'Avoid generic reader-effect formulas; acknowledge alternatives when wording permits them.'],
    explanation: answer, tag: family === 2 ? 'single_interpretation_as_fact' : family === 0 ? 'claim_without_effect' : 'overclaiming', focus
  });
}

function buildResponse(extract, index, id) {
  const focus = ['character motive or change', 'mood and atmosphere', 'theme', 'connotation or imagery', 'sentence or structural choice', 'competing interpretations and evidence sufficiency'][index % 6];
  const rubric = [
    { id: 'interpretation', description: `Offers a defensible interpretation focused on ${focus}, beyond retelling.`, required: true },
    { id: 'exact_evidence', description: 'Uses exact relevant evidence or an accurately identified structural feature.', required: true },
    { id: 'analysis_link', description: 'Explains how language, action or structure supports the interpretation.', required: true },
    { id: 'precision_and_limit', description: 'Uses suggests or may and avoids universal reader-response claims.', required: true },
    { id: 'alternative_or_sufficiency', description: 'Where appropriate, weighs another reading or names evidence needed to discriminate.', required: index % 3 === 2 }
  ];
  return openCandidate({
    id, index, extract, focus, rubric,
    prompt: `Moderated analysis ${index + 1}: write 2–4 sentences analysing ${focus}. Use precise evidence, explain the link and state a limit or alternative where relevant.`,
    hints: ['Begin with a specific inference, then choose the shortest quotation that supports it.', `You could use “${extract.evidence}”; analyse its wording or position rather than adding a generic reader-effect phrase.`],
    explanation: `A defensible response may argue that ${extract.inference}, using “${extract.evidence}”, while recognising that ${extract.alternative.toLowerCase()} Adult moderation judges relevance and precision.`,
    tag: index % 3 === 2 ? 'single_interpretation_as_fact' : 'claim_without_effect'
  });
}

function buildRetrieval(extract, index, id) {
  const family = index % 3;
  const span = family === 0 ? extract.evidence : family === 1 ? extract.quote : extract.moodSpans[0];
  const focus = family === 0 ? 'character or speaker inference' : family === 1 ? 'connotation or imagery' : 'mood';
  return autoCandidate({
    id, index, extract, format: 'evidence-highlight', blueprint: 'literature-inference-retrieval', band: index % 5 === 0 ? 'intro' : 'developing',
    prompt: `Spaced retrieval ${index + 1}: highlight the shortest exact span that best supports ${focus}.`,
    choices: [span, ...extract.distractors], answer: [span], spans: [span],
    hints: ['Choose evidence directly tied to the named focus.', 'A short relevant span is stronger than a longer quotation chosen because it sounds vivid.'],
    explanation: `“${span}” is the most precise available span for ${focus}.`, tag: 'irrelevant_evidence', focus, retrieval: true
  });
}

function autoCandidate({ id, index, extract, format, blueprint, band, prompt, choices, answer, spans, hints, explanation, tag, focus, retrieval = false }) {
  const fullId = `${prefix}${id}`;
  const rotated = rotate([...new Set(choices)], index % choices.length);
  const useAudio = index % 16 === 0;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      text: extract.text,
      choices: rotated,
      selectable_spans: format === 'evidence-highlight' ? rotated : undefined,
      evidence_spans: spans,
      linked_evidence_span: spans[0],
      analysis_focus: focus,
      source_metadata: metadata(extract),
      auto_mark: true,
      canonical_integrity: 'exact_span_and_answer_evidence_link',
      retrieval_schedule: retrieval ? [1, 3, 7, 14, 30] : undefined,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_literary_evidence_reasoning`,
      variant_blueprint_id: blueprint,
      review_batch: 'y7-literature-inference-pilot-a',
      ...accessibility(fullId),
      ...(useAudio ? audio(fullId) : { audio_required: false })
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: autoFeedback(answer, spans, explanation, tag),
    difficulty: { intro: 3, developing: 4, expected: 6, secure: 7, stretch: 8 }[band],
    status: 'review',
    misconception_tag: tag,
    animation_hook: format === 'evidence-highlight' ? 'mood-word-highlight' : 'analysis-chain-build'
  };
}

function openCandidate({ id, index, extract, focus, rubric, prompt, hints, explanation, tag }) {
  const fullId = `${prefix}${id}`;
  const useAudio = index % 16 === 0;
  const exemplarSpans = [extract.evidence, extract.quote].filter((span, position, all) => extract.text.includes(span) && all.indexOf(span) === position);
  return {
    id: fullId,
    format: 'short-response',
    body: {
      prompt,
      text: extract.text,
      analysis_focus: focus,
      source_metadata: metadata(extract),
      response_kind: 'moderated_short_response',
      auto_mark: false,
      teacher_or_adult_moderation_required: true,
      moderation_status: 'required_before_approval',
      rubric,
      exemplar_evidence_spans: exemplarSpans,
      difficulty_band: 'stretch',
      evidence_purpose: 'short-analysis-responses_moderated_literary_analysis',
      variant_blueprint_id: 'short-analysis-responses',
      review_batch: 'y7-literature-inference-pilot-a',
      ...accessibility(fullId),
      ...(useAudio ? audio(fullId) : { audio_required: false })
    },
    expected_answer: { rubric: rubric.map((criterion) => criterion.id), moderation_required: true },
    hints,
    explanation,
    feedback: {
      correct: 'No automatic correctness decision is made. A teacher or reviewing adult applies the rubric.',
      repair: 'Check for one defensible inference, exact relevant evidence and an explanation of the wording or structure. Replace retelling and generic reader-effect wording.',
      evidence: `Possible evidence includes ${quoted(exemplarSpans)}, but moderation may accept other exact relevant spans.`,
      misconception_check: tag,
      support_message: 'Compose with keyboard, switch, eye gaze, AAC, speech-to-text placeholder or adult scribing. Speech and handwriting are optional.',
      retry: 'Drafts remain available. Revise one rubric criterion at a time and resubmit without penalty.'
    },
    difficulty: 8,
    status: 'review',
    misconception_tag: tag,
    animation_hook: 'analysis-bridge-test'
  };
}

function accessibility(id) {
  return {
    response_mode: 'keyboard_switch_eye_gaze_aac_speech_to_text_or_adult_scribed',
    supported_interaction: 'Use keyboard, switch scanning, eye-gaze dwell, AAC/pointing, speech-to-text placeholder or adult scribing; selectable spans never require dragging, handwriting or speech.',
    interaction_route: { keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, speech_to_text_placeholder: true, adult_scribed: true, drag_required: false, handwriting_required: false, speech_required: false },
    send_support: { line_focus: true, chunked_extract: true, simplified_text_same_reasoning: true, glossary_support: true, one_analysis_link_at_a_time: true, correct_links_preserved: true },
    low_sensory: true,
    reduced_motion_static_route: true,
    undo_available: true,
    retry_without_penalty: true,
    timer_allowed: false,
    speed_score_allowed: false,
    speed_rewards_allowed: false,
    streaks_allowed: false,
    lives_allowed: false,
    browser_tts_allowed: false,
    browser_tts_fallback: 'prohibited',
    gamification: { mission: 'restore one calm archive evidence thread', reward: 'an evidence marker for precision or thoughtful revision', timer: false, speed_reward: false, streak: false, lives: false, loss_on_error: false, retry_message: 'Keep relevant evidence, open one reasoning clue and revise without losing progress.' },
    accessibility_id: `access-${id}`
  };
}

function audio(id) {
  return { audio_optional: true, audio_asset_id: `literature-reading-${id}`, audio_provider: 'ElevenLabs', audio_asset_status: 'required_human_listening_review', human_listening_approval_required: true, audio_route: 'produced_reviewed_extract_reading' };
}

function metadata(extract) {
  return { source_id: `nexuslearn-original-${extract.key}`, origin: 'original_for_nexuslearn', copyright_status: 'original_copyright_safe_micro_extract', author_credit: 'NexusLearn original content', form: extract.form, genre: extract.genre, voice: extract.voice, theme: extract.theme, age_suitability: 'Year 7 transition', external_source: false };
}

function autoFeedback(answer, spans, explanation, tag) {
  const shown = Array.isArray(answer) ? quoted(answer) : `“${answer}”`;
  return {
    correct: `The canonical evidence link supports ${shown}. ${explanation}`,
    repair: tag === 'irrelevant_evidence' ? 'Put the inference beside each quotation and test whether the exact words prove it. Keep the smallest sufficient span.' : tag === 'single_interpretation_as_fact' ? 'Use suggests or may, link both readings to evidence and name what further evidence would distinguish them.' : 'Move from choice to connotation or structure to inference; remove plot retelling and generic reader-response claims.',
    evidence: `Exact linked evidence: ${quoted(spans)}. Each span occurs verbatim in the original extract.`,
    misconception_check: tag,
    support_message: 'Use line focus, simplified text with the same reasoning, keyboard, switch, eye gaze, AAC or adult scribing; no drag, speech, handwriting or speed is required.',
    retry: 'Relevant spans and completed links remain visible. Use one relevance clue and retry without penalty.'
  };
}

function expand(label, count, builder) {
  return Array.from({ length: count }, (_, index) => {
    const extract = extracts[index % extracts.length];
    return builder(extract, index, `${label}-${String(index + 1).padStart(3, '0')}-${extract.key}`);
  });
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 3 || JSON.stringify(currentPack.question_variants.slice(0, 3)) !== authoredSnapshot) throw new Error('Curated variants changed or moved.');
  if (generated.length !== 217 || currentPack.question_variants.length !== pilotTarget) throw new Error('Expected 217 generated and 220 total variants.');
  const blueprintMap = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || !formats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateSourceAndSpans(variant);
    validateAccess(variant);
    if (variant.body.prompt.length > 620 || variant.body.text.length > 700) throw new Error(`${variant.id} exceeds prompt or extract length limits.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.support_message) throw new Error(`${variant.id} lacks rich feedback.`);
    if (variant.format === 'short-response') validateRubric(variant);
    else {
      if (variant.body.auto_mark !== true || variant.body.choices.length < 4) throw new Error(`${variant.id} lacks canonical auto-mark data.`);
      const answers = Array.isArray(variant.expected_answer.value) ? variant.expected_answer.value : [variant.expected_answer.value];
      for (const answer of answers) if (!variant.body.choices.includes(answer)) throw new Error(`${variant.id} does not offer its canonical answer.`);
      if (typeof variant.expected_answer.value === 'string' && /makes the reader feel/i.test(variant.expected_answer.value)) throw new Error(`${variant.id} uses formulaic effect analysis.`);
    }
  }
  const allocation = { 'mood-word-highlights': 44, 'quote-relevance-tests': 44, 'writer-effect-bridges': 43, 'short-analysis-responses': 43, 'literature-inference-retrieval': 43 };
  for (const [blueprint, expected] of Object.entries(allocation)) {
    const actual = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint).length;
    if (actual !== expected) throw new Error(`${blueprint} expected ${expected}, found ${actual}.`);
  }
  for (const format of currentPack.practice.formats) if (!generated.some((variant) => variant.format === format)) throw new Error(`Required format ${format} is unused.`);
}

function validateSourceAndSpans(variant) {
  const source = variant.body.source_metadata;
  if (!source || source.origin !== 'original_for_nexuslearn' || source.external_source !== false || source.copyright_status !== 'original_copyright_safe_micro_extract' || !source.source_id.startsWith('nexuslearn-original-')) throw new Error(`${variant.id} lacks original-source metadata.`);
  const canonical = extracts.find((extract) => source.source_id === `nexuslearn-original-${extract.key}`);
  if (!canonical || canonical.text !== variant.body.text || canonical.form !== source.form || canonical.genre !== source.genre || canonical.voice !== source.voice || canonical.theme !== source.theme) throw new Error(`${variant.id} does not match its canonical original extract metadata.`);
  const spans = [...(variant.body.evidence_spans ?? []), ...(variant.body.selectable_spans ?? []), ...(variant.body.exemplar_evidence_spans ?? [])];
  for (const span of spans) if (!variant.body.text.includes(span)) throw new Error(`${variant.id} contains non-exact span: ${span}`);
  if (variant.body.linked_evidence_span && !variant.body.text.includes(variant.body.linked_evidence_span)) throw new Error(`${variant.id} has an invalid answer-evidence link.`);
}

function validateRubric(variant) {
  const rubric = variant.body.rubric;
  const ids = ['interpretation', 'exact_evidence', 'analysis_link', 'precision_and_limit', 'alternative_or_sufficiency'];
  if (variant.body.auto_mark !== false || variant.body.teacher_or_adult_moderation_required !== true || variant.body.moderation_status !== 'required_before_approval' || variant.expected_answer.moderation_required !== true) throw new Error(`${variant.id} falsely auto-approves an open response.`);
  if (!Array.isArray(rubric) || rubric.length !== 5 || ids.some((id) => !rubric.some((criterion) => criterion.id === id && criterion.description && typeof criterion.required === 'boolean'))) throw new Error(`${variant.id} has an incomplete rubric.`);
  if (JSON.stringify(variant.expected_answer.rubric) !== JSON.stringify(rubric.map((criterion) => criterion.id))) throw new Error(`${variant.id} has non-canonical rubric ids.`);
}

function validateAccess(variant) {
  const route = variant.body.interaction_route;
  if (!route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_scribed || route.drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
  if (!variant.body.send_support?.simplified_text_same_reasoning || !variant.body.send_support?.line_focus || variant.body.low_sensory !== true || variant.body.reduced_motion_static_route !== true) throw new Error(`${variant.id} lacks SEND support.`);
  if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.speed_rewards_allowed !== false || variant.body.gamification?.speed_reward !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
  if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== 'prohibited') throw new Error(`${variant.id} permits browser TTS.`);
  if (variant.body.audio_asset_id && (variant.body.audio_provider !== 'ElevenLabs' || variant.body.audio_asset_status !== 'required_human_listening_review' || variant.body.human_listening_approval_required !== true || variant.body.audio_route !== 'produced_reviewed_extract_reading')) throw new Error(`${variant.id} has invalid audio metadata.`);
}

function quoted(spans) { return spans.map((span) => `“${span}”`).join(' and '); }
function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll('\\', '/'); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(','); }
