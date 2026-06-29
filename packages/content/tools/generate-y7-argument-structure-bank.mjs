#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y7-argument-structure.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y7-argument-structure-bank-";
const pilotTarget = 240;
const reviewBatch = "y7-argument-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y7-argument-structure") throw new Error("This generator only supports the Year 7 argument-structure pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const cases = [
  {
    key: "library-hours",
    claim: "The school library should stay open until 5 pm on two weekdays.",
    reason: "Some pupils need a quiet supervised place to study after lessons.",
    evidence: "In the fictional case-file survey, 68 of 100 respondents said they would use an after-school study space.",
    counterargument: "Later opening would require extra staff time.",
    rebuttal: "A four-week, two-day trial using a voluntary rota could test demand while limiting extra staffing.",
    topicFact: "The library has blue chairs and six display shelves.",
    weakEvidence: "One pupil says every library should stay open late.",
    unreliableEvidence: "An undated anonymous post claims that nobody studies at home.",
  },
  {
    key: "refill-station",
    claim: "The school should install a drinking-water refill station.",
    reason: "Convenient refilling could reduce disposable bottle use.",
    evidence: "A fictional five-day waste audit counted 430 disposable drinks bottles in school bins.",
    counterargument: "Installation and maintenance would cost money.",
    rebuttal: "The school could compare a supplier's full-year cost with current waste costs before running one monitored trial.",
    topicFact: "Reusable bottles are sold in many colours.",
    weakEvidence: "A pupil says refill stations look modern.",
    unreliableEvidence: "A bottle advert says its brand will solve all plastic waste.",
  },
  {
    key: "movement-break",
    claim: "Long afternoon lessons should include a two-minute movement break.",
    reason: "A brief planned pause may help pupils return attention to the task.",
    evidence: "In the fictional four-week class trial, average reminders in the final twenty minutes fell from nine to five.",
    counterargument: "A break could reduce teaching time or become disruptive.",
    rebuttal: "The routine could be timed, taught and reviewed after four weeks using both learning time and reminder data.",
    topicFact: "Some sports sessions last longer than classroom lessons.",
    weakEvidence: "One learner says moving is always more fun than sitting.",
    unreliableEvidence: "A clip with no source promises that two minutes of movement guarantees top grades.",
  },
  {
    key: "quiet-zone",
    claim: "The dining hall should include a small quieter seating zone at lunch.",
    reason: "A lower-noise option could make lunch more accessible for pupils who find busy sound difficult.",
    evidence: "In the fictional access review, 31 of 45 respondents who used the trial zone said it helped them remain in the dining hall.",
    counterargument: "Separating a zone might reduce available seating or make users feel singled out.",
    rebuttal: "An optional mixed-use zone with movable signs could protect choice, and seating use could be checked before expansion.",
    topicFact: "The dining hall menu changes each week.",
    weakEvidence: "One person says quiet spaces are obviously better for everyone.",
    unreliableEvidence: "An anonymous message claims that all noise is harmful.",
  },
  {
    key: "cycle-storage",
    claim: "The school should add covered cycle storage.",
    reason: "Keeping cycles dry and secure could make cycling a more practical option.",
    evidence: "The fictional travel survey records 54 pupils who cycle sometimes but identifies lack of covered storage as a barrier for 29 of them.",
    counterargument: "The shelter would use space and require funding.",
    rebuttal: "A scaled plan can compare two locations, costs and pedestrian routes before any funding decision.",
    topicFact: "Professional cycle races can cover hundreds of kilometres.",
    weakEvidence: "A keen cyclist says every school needs the largest possible shelter.",
    unreliableEvidence: "A shelter company says its product makes every journey safe.",
  },
  {
    key: "pollinator-patch",
    claim: "Part of the school grounds should become a pollinator-friendly planting patch.",
    reason: "A varied patch could provide food and shelter for more insect species.",
    evidence: "In the fictional grounds survey, the mixed-flower test patch recorded eight insect types while the same-sized short-grass area recorded three.",
    counterargument: "The patch would need maintenance and could reduce open grass space.",
    rebuttal: "A small edge plot with a maintenance plan could be reviewed after one growing season before any larger change.",
    topicFact: "Some flowers appear in paintings and logos.",
    weakEvidence: "A gardener says wild-looking areas are always beautiful.",
    unreliableEvidence: "A seed advert claims one packet will rescue every insect species.",
  },
  {
    key: "digital-newspaper",
    claim: "The school should publish a monthly pupil newspaper.",
    reason: "A newspaper could give pupils a structured audience for reporting and commentary.",
    evidence: "In the fictional interest form, 42 pupils offered to report, edit, illustrate or fact-check a trial edition.",
    counterargument: "Printing a newspaper could waste paper.",
    rebuttal: "A digital-first edition with a few shared print copies would provide access while limiting paper use.",
    topicFact: "Some national newspapers began more than a century ago.",
    weakEvidence: "One pupil says newspapers are the most exciting clubs.",
    unreliableEvidence: "An unsigned post says a newspaper instantly improves every writer.",
  },
  {
    key: "device-loan",
    claim: "The library should offer a small supervised device-loan scheme for homework.",
    reason: "A loan scheme could reduce barriers when a pupil temporarily lacks a suitable device.",
    evidence: "The fictional half-term log records 37 occasions when homework support was requested because no suitable device was available.",
    counterargument: "Devices could be damaged, lost or expensive to manage.",
    rebuttal: "A limited in-library trial with sign-out records and protective cases could test benefit and risk before home loans are considered.",
    topicFact: "Devices are available with different screen sizes.",
    weakEvidence: "One learner says new technology always fixes learning problems.",
    unreliableEvidence: "A retailer claims its device makes homework effortless for everyone.",
  },
  {
    key: "community-garden",
    claim: "An unused corner of the community centre should become a shared garden.",
    reason: "A garden could provide a practical place for local groups to grow plants together.",
    evidence: "In the fictional consultation, 56 residents expressed interest and three groups offered scheduled volunteer sessions.",
    counterargument: "Interest might fade and the area could become neglected.",
    rebuttal: "A one-bed pilot with named weekly responsibilities would test whether participation continues before the site expands.",
    topicFact: "Gardens can contain paths, pots and benches.",
    weakEvidence: "A resident says gardening is the best hobby.",
    unreliableEvidence: "A social post promises that every community garden succeeds.",
  },
  {
    key: "museum-youth-evening",
    claim: "The local museum should trial an early-evening event for young people.",
    reason: "A different time and format could make the collection accessible to more young visitors.",
    evidence: "The fictional booking test filled 72 of 80 free places and collected 51 requests for another event.",
    counterargument: "An evening event would add staffing and security costs.",
    rebuttal: "One ticketed pilot in existing opening hours could gather attendance, cost and access evidence before a regular programme is proposed.",
    topicFact: "Museums display objects from many periods.",
    weakEvidence: "One visitor says evening events sound cool.",
    unreliableEvidence: "An influencer says every young person loves museums at night.",
  },
  {
    key: "reading-choice",
    claim: "Each Year 7 reading unit should include one choice from a teacher-approved shortlist.",
    reason: "Limited choice can support engagement while preserving shared curriculum goals.",
    evidence: "In the fictional six-week comparison, completion rose from 74% to 86% when classes chose one of three equally challenging texts.",
    counterargument: "Different choices could make discussion and assessment less consistent.",
    rebuttal: "Shared themes, challenge criteria and one common comparison task could keep assessment consistent across the shortlist.",
    topicFact: "Book covers use many styles of lettering.",
    weakEvidence: "A reader says choice makes every book enjoyable.",
    unreliableEvidence: "An online list with no author ranks one novel as perfect for all pupils.",
  },
  {
    key: "bus-shelter",
    claim: "The council should investigate a shelter at the busiest school-bus stop.",
    reason: "A shelter could provide safer, drier waiting space in poor weather.",
    evidence: "The fictional two-week count records an average of 46 waiting passengers at 3:30 pm and no covered space at that stop.",
    counterargument: "A shelter could obstruct the pavement or cost more than its benefit.",
    rebuttal: "An accessibility survey and scaled pavement plan should test clearance, use and cost before a final decision.",
    topicFact: "Buses can use electric, diesel or hybrid power.",
    weakEvidence: "One passenger says shelters make every street look better.",
    unreliableEvidence: "A manufacturer claims its shelter improves every bus route.",
  },
];

const routeModes = [
  { key: "console", label: "Debate console", representation: "connected argument map" },
  { key: "cards", label: "Case-file cards", representation: "numbered static cards" },
  { key: "outline", label: "Outline route", representation: "indented text outline" },
  { key: "audio", label: "Optional audio route", representation: "scripted card descriptions" },
];

const fallacyCases = [
  { key: "ad-hominem", text: "Do not accept Sam's cycle-storage plan because Sam is bad at sport.", question: "What is wrong with this response?", answer: "It attacks the person instead of testing the plan's reasons and evidence.", choices: ["It attacks the person instead of testing the plan's reasons and evidence.", "It gives too many reliable statistics.", "It fairly qualifies the original claim.", "It supplies a direct counterexample."], explanation: "The comment targets Sam rather than the proposal. A fair response should examine space, cost, safety or evidence, not an unrelated feature of the speaker.", tag: "personal_attack" },
  { key: "straw-person", text: "The proposal asks for one quiet lunch zone. A reply says, 'They want everyone to eat in complete silence.'", question: "Which diagnosis is most accurate?", answer: "The reply exaggerates the proposal into an easier position to reject.", choices: ["The reply exaggerates the proposal into an easier position to reject.", "The reply quotes the proposal exactly.", "The reply adds directly relevant evidence.", "The reply offers a measured compromise."], explanation: "The response replaces an optional small zone with compulsory silence for everyone. A strong counterargument must address the actual limited proposal.", tag: "straw_person" },
  { key: "false-choice", text: "Either the school installs the largest refill station immediately or it does not care about plastic waste.", question: "Why is the reasoning weak?", answer: "It presents only two extremes although trials, smaller stations and other waste measures are possible.", choices: ["It presents only two extremes although trials, smaller stations and other waste measures are possible.", "It contains a cautious qualification.", "It compares several realistic options.", "It uses a representative audit."], explanation: "The sentence creates a false dilemma. More than two responses are available, so the argument must compare realistic alternatives rather than force extremes.", tag: "false_dilemma" },
  { key: "hasty-generalisation", text: "Two pupils disliked the trial newspaper, so no Year 7 pupil would read it.", question: "What is the evidence problem?", answer: "A claim about every Year 7 pupil is drawn from an extremely small unrepresentative sample.", choices: ["A claim about every Year 7 pupil is drawn from an extremely small unrepresentative sample.", "The evidence is too detailed to evaluate.", "The conclusion is narrower than the evidence.", "The sample includes every relevant reader."], explanation: "Two responses cannot justify a universal conclusion about a whole year group. The writer needs a larger, more representative sample and a qualified claim.", tag: "hasty_generalisation" },
  { key: "bandwagon", text: "Most people in an online poll clicked 'yes', so the device-loan plan must be fair and affordable.", question: "Which limit matters most?", answer: "Popularity alone does not establish fairness, affordability or whether the poll sample is representative.", choices: ["Popularity alone does not establish fairness, affordability or whether the poll sample is representative.", "A popular view is automatically proven.", "Online polls always measure cost accurately.", "The conclusion is valid because it uses the word 'most'."], explanation: "A popularity result may describe respondents, but it does not by itself prove separate claims about fairness or cost. Sampling and relevant evidence still matter.", tag: "bandwagon" },
  { key: "circular", text: "The reading-choice plan is the best plan because no other plan is as good.", question: "Why does this fail as a reason?", answer: "It repeats the judgement in different words without supplying independent support.", choices: ["It repeats the judgement in different words without supplying independent support.", "It gives a measurable comparison.", "It acknowledges a strong counterargument.", "It identifies a reliable source."], explanation: "The reason assumes the claim it is meant to prove. Useful support would name criteria and evidence, such as challenge, completion or discussion quality.", tag: "circular_reasoning" },
  { key: "cause-correlation", text: "Attendance rose during the museum poster campaign, so the poster must have caused every extra visit.", question: "What qualification is needed?", answer: "The timing is consistent with an effect, but other changes must be checked before claiming the poster caused every increase.", choices: ["The timing is consistent with an effect, but other changes must be checked before claiming the poster caused every increase.", "Events occurring together always prove one caused the other.", "The attendance figures should be ignored completely.", "A colourful poster cannot affect any decision."], explanation: "The pattern can support investigation but does not isolate a cause. Prices, exhibitions, weather or group bookings may also have changed.", tag: "correlation_as_cause" },
  { key: "slippery-slope", text: "If one movement break is allowed, lessons will soon contain no teaching at all.", question: "What must a sound argument ask?", answer: "Whether there is evidence for each step from one timed break to the extreme outcome.", choices: ["Whether there is evidence for each step from one timed break to the extreme outcome.", "Whether the extreme outcome sounds dramatic.", "Whether one step always guarantees every later step.", "Whether the speaker can repeat the warning more strongly."], explanation: "The claim jumps from a controlled two-minute routine to an extreme endpoint without supporting the intermediate steps. Each proposed link needs evidence.", tag: "slippery_slope" },
  { key: "irrelevant-authority", text: "A famous actor recommends a particular pollinator seed mix, so it must be the best ecological choice for this site.", question: "Which source check is needed?", answer: "Check relevant ecological expertise and local evidence rather than treating fame as authority.", choices: ["Check relevant ecological expertise and local evidence rather than treating fame as authority.", "Fame makes every claim reliable.", "No source can ever be useful.", "The most confident voice supplies the strongest evidence."], explanation: "Authority is relevant only when expertise and evidence fit the claim. Local conditions and a suitable ecological source matter more than unrelated fame.", tag: "irrelevant_authority" },
  { key: "loaded-language", text: "Only a heartless council would question the brilliant bus-shelter plan.", question: "How should this be repaired?", answer: "Remove the attack and praise, then compare accessibility, use, cost and pavement evidence.", choices: ["Remove the attack and praise, then compare accessibility, use, cost and pavement evidence.", "Add more insulting adjectives.", "Treat emotional force as measured evidence.", "Avoid all counterarguments."], explanation: "Loaded language pressures agreement without testing the proposal. Neutral criteria allow a reader to evaluate both the claim and legitimate concerns.", tag: "loaded_language_as_evidence" },
  { key: "link-check", text: "The survey found demand for later library hours. Therefore, every pupil will achieve higher grades.", question: "Which judgement best checks the logical link?", answer: "The evidence supports possible demand, not the much broader certainty about every pupil's grades.", choices: ["The evidence supports possible demand, not the much broader certainty about every pupil's grades.", "The word 'therefore' proves the conclusion.", "Demand and grades mean exactly the same thing.", "A survey can establish any later outcome."], explanation: "A connective cannot create a relationship that the evidence does not support. The conclusion must be narrowed or backed by additional achievement evidence.", tag: "connective_without_logic" },
];

const claimCandidates = cross(cases, routeModes, (item, route, index) => {
  const sentences = [item.claim, item.reason, item.evidence, item.counterargument, item.rebuttal];
  return candidate({
    id: `roles-${item.key}-${route.key}`,
    format: "argument-map",
    blueprint: "claim-role-sorts",
    band: "intro",
    strand: index % 2 ? "reasons" : "claims",
    coverage: ["claims", "reasons", "evidence", "counterarguments", "rebuttals"],
    prompt: `${route.label}: map the claim, reason, evidence, counterargument and rebuttal in this fictional ${item.key.replaceAll("-", " ")} case.`,
    body: { sentences: rotate(sentences, index % sentences.length), roles: ["claim", "reason", "evidence", "counterargument", "rebuttal"], representation: route.representation },
    answer: [`claim: ${item.claim}`, `reason: ${item.reason}`, `evidence: ${item.evidence}`, `counterargument: ${item.counterargument}`, `rebuttal: ${item.rebuttal}`],
    hints: ["Find the position the writer wants the reader to accept, then ask why it is proposed.", "Evidence supports a reason; a rebuttal responds directly to the counterargument rather than repeating the claim."],
    explanation: `The claim states the proposal, the reason explains its value, and the fictional case-file evidence supplies specific support. The counterargument identifies a fair limitation, while the rebuttal answers that exact limitation with a measured next step.`,
    tag: index % 2 ? "claim_reason_confusion" : "opinion_treated_as_evidence",
    repair: "Use the static five-level outline: position -> why -> support -> fair challenge -> direct response. Move one card at a time or answer by role name.",
  });
});

const evidenceCandidates = cross(cases, routeModes, (item, route, index) => candidate({
  id: `evidence-${item.key}-${route.key}`,
  format: "evidence-rank",
  blueprint: "evidence-relevance-rankings",
  band: "expected",
  strand: "evidence_quality",
  coverage: ["evidence", "evidence_quality", "logical_links"],
  prompt: `${route.label}: which fictional case-file evidence most directly and credibly supports this reason: ${item.reason}`,
  body: { reason: item.reason, choices: rotate([item.evidence, item.weakEvidence, item.topicFact, item.unreliableEvidence], index % 4), ranking_criteria: ["relevance", "specificity", "source_quality", "sufficiency"], representation: route.representation },
  answer: item.evidence,
  hints: ["Underline the exact idea in the reason that needs support, then remove choices that merely share the topic.", "Prefer specific, traceable evidence from the supplied case file; still state what one item cannot prove on its own."],
  explanation: `${item.evidence} directly measures a feature named in the reason and identifies its fictional case-file basis. The other choices are personal preference, topic-only information or a source making an unsupported sweeping claim, so they provide weaker support.`,
  tag: index % 2 ? "source_confidence_equals_reliability" : "topic_related_not_supportive",
  repair: "Compare two cards at a time using the prompts: relevant to what, specific how, from whom, based on what, and enough for which size of claim?",
}));

const paragraphCandidates = cross(cases, routeModes, (item, route, index) => {
  const explanationLink = `This evidence matters because it gives a specific indication that ${item.reason.charAt(0).toLowerCase()}${item.reason.slice(1)}`;
  const order = [item.claim, item.reason, item.evidence, explanationLink];
  return candidate({
    id: `paragraph-${item.key}-${route.key}`,
    format: "paragraph-build",
    blueprint: "coherent-paragraph-builds",
    band: "developing",
    strand: index % 2 ? "logical_links" : "paragraph_structure",
    coverage: ["claims", "reasons", "evidence", "paragraph_structure", "logical_links"],
    prompt: `${route.label}: order the fictional case-file sentences into a coherent argument paragraph, then check that the final sentence explains relevance.`,
    body: { sentences: rotate(order, (index + 1) % order.length), connective_bank: ["because", "for example", "however", "this matters because", "therefore"], accepted_surface_variation: "equivalent punctuation or a logically coherent reason-evidence order may be teacher-reviewed", representation: route.representation },
    answer: order,
    hints: ["Establish the claim and reason before presenting the evidence that supports that reason.", "A connective labels a relationship; the final explanation must actually show how the evidence supports the reason."],
    explanation: `The ordered route moves from claim to reason to relevant fictional evidence and then interprets that evidence. This creates a visible logical link instead of relying on a list of topic-related statements or on connectives that do not match the reasoning.`,
    tag: index % 2 ? "connective_without_logic" : "points_listed_without_links",
    repair: "Use numbered move-up and move-down controls, keep all sentences visible, and rehearse with the frame: claim because reason; for example evidence; this matters because explanation.",
  });
});

const rebuttalCandidates = cross(cases, routeModes, (item, route, index) => candidate({
  id: `rebuttal-${item.key}-${route.key}`,
  format: "reason-choice",
  blueprint: "counterargument-rebuttal-tests",
  band: "secure",
  strand: index % 2 ? "rebuttals" : "counterarguments",
  coverage: ["counterarguments", "rebuttals", "logical_links"],
  prompt: `${route.label}: inspect the displayed claim and fair counterargument. Which rebuttal answers that exact concern most precisely?`,
  body: { claim: item.claim, counterargument: item.counterargument, choices: rotate([item.rebuttal, "People who raise that concern simply dislike change.", "The proposal is good, so the concern does not matter.", item.topicFact], index % 4), respectful_disagreement_required: true, representation: route.representation },
  answer: item.rebuttal,
  hints: ["Restate the real concern in neutral words before testing each response.", "Choose a qualification, evidence need or practical solution that answers the concern without attacking a person or changing the subject."],
  explanation: `${item.rebuttal} responds to the stated limitation with a proportionate test or safeguard. The alternatives dismiss the speaker, repeat the claim circularly or introduce an irrelevant fact, so they do not build a rebuttal bridge.`,
  tag: index % 2 ? "dismissal_instead_of_rebuttal" : "counterargument_weakens_claim",
  repair: "Use the private rehearsal frame: some may reasonably argue ___; this matters because ___; however, the proposal can respond by ___. No public performance is required.",
}));

const transferCandidates = cross(fallacyCases, routeModes, (item, route, index) => candidate({
  id: `transfer-${item.key}-${route.key}`,
  format: "argument-map",
  blueprint: "argument-transfer-retrieval",
  band: "retrieval",
  strand: index % 3 === 0 ? "logical_links" : "fallacies",
  coverage: ["fallacies", "logical_links", "evidence_quality", "counterarguments"],
  prompt: `${route.label}: '${item.text}' ${item.question}`,
  body: { extract: item.text, choices: rotate(item.choices, index % item.choices.length), fallacy_name_optional: true, reasoning_description_scored: true, representation: route.representation },
  answer: item.answer,
  hints: ["Describe what the reasoning does before trying to remember a fallacy label.", "Check whether the conclusion follows from relevant evidence and whether the real claim or person has been treated fairly."],
  explanation: `${item.explanation} Naming the pattern can help retrieval, but the scored reasoning is the accurate description of the broken link and a fair way to repair it.`,
  tag: item.tag,
  repair: "Use the fallacy-free route: identify the exact claim, identify the supplied support, test the link, and rewrite a narrower conclusion or request better evidence.",
}));

const generated = [...claimCandidates, ...evidenceCandidates, ...paragraphCandidates, ...rebuttalCandidates, ...transferCandidates];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional prompt and card playback uses only referenced ElevenLabs assets after human listening approval. Browser TTS is prohibited; visible text, line focus, partner reading and AAC routes remain complete when audio is unavailable.";
pack.qa.notes = "Year 7 argument structure reaches the 240-item pilot target with four preserved curated variants and 236 deterministic review candidates spanning claims, reasons, evidence, counterarguments, rebuttals, paragraph structure, logical links, evidence quality and age-appropriate fallacy diagnosis. Fictional training evidence is labelled as such. Every generated item includes supported SEND interactions, static and reduced-load routes, rich repair feedback, optional policy-compliant ElevenLabs references and private debate-mission progress without timers, leaderboards, streak loss, public performance or peer comparison. Independent English, teacher, SEND, accessibility, safeguarding, audio, renderer and pilot review remain required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`argument-structure-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`argument-structure-bank blueprints=${summary(generated, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`argument-structure-bank strands=${summary(generated, (variant) => variant.body.argument_strand)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`argument-structure-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 7 argument-structure bank is out of date; run generate-y7-argument-structure-bank.mjs --write.");
  console.log("argument-structure-bank deterministic check passed");
} else {
  console.log("argument-structure-bank dry-run; pass --write to update the pack");
}

function candidate({ id, format, blueprint, band, strand, coverage, prompt, body, answer, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...body,
      argument_strand: strand,
      coverage_tags: coverage,
      training_evidence_status: "fictional_case_file_for_reasoning_practice_not_a_real_world_source",
      evidence_purpose: `${strand}_argument_reasoning`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      difficulty_band: band,
      response_mode: "tap_keyboard_switch_eye_gaze_aac_oral_partner_or_adult_scribed",
      supported_interactions: ["tap", "keyboard", "switch_scan", "eye_gaze", "aac", "oral_choice", "partner_scan", "adult_scribed"],
      interaction_support: { keyboard: true, switch_scan: true, touch: true, eye_gaze: true, aac: true, oral_or_partner_response: true, precision_drag_required: false, move_up_down_alternative: true, undo_available: true, answer_by_role_label: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, line_focus: true, tinted_background_option: true, chunked_card_view: true, readable_font_option: true, role_labels_persistent: true },
      reduced_visual_load: true,
      reduced_language_route: "one claim-and-support link at a time with vocabulary definitions and sentence stems",
      static_layout_available: true,
      reduced_motion_alternative: "instant numbered outline with persistent labelled links and no animated card movement",
      no_timer: true,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      public_performance_required: false,
      peer_comparison_allowed: false,
      sentence_stems: ["The claim is ___ because ___.", "The evidence supports the reason because ___.", "A fair challenge is ___; a direct response is ___."],
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_voice_profile: "calm_UK_secondary_narration_subject_to_approval",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      unavailable_audio_state: "complete_visible_text_partner_or_aac_route",
      gamification: {
        mission: "restore one reasoning route in the Future Worlds civic forum archive",
        debate_mode: "private_rehearsal_or_fictional_case_review",
        reward: "one calm evidence beacon for explaining a sound reasoning link",
        individual_progress_only: true,
        loss_on_error: false,
        streak_pressure: false,
        leaderboard: false,
        public_performance: false,
        peer_comparison: false,
        retry_message: "That route gives us a useful clue. Inspect one reasoning link, revise it and try again without penalty.",
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Reasoning route secured. ${explanation}`,
      repair,
      reasoning_check: "Name the claim, identify what supports it, and explain whether that exact support justifies the size of the conclusion.",
      respectful_disagreement: "Challenge the reasoning or evidence, not the person. Acknowledging a fair concern does not require agreement.",
      evidence_limit: "The item uses a labelled fictional training case. State what its supplied evidence supports and what further evidence would still be needed.",
    },
    difficulty: { intro: 3, developing: 5, expected: 6, secure: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "evidence-rank" ? "evidence-strength-scale" : format === "paragraph-build" ? "argument-route-build" : format === "reason-choice" ? "rebuttal-bridge-test" : strand === "fallacies" ? "logic-link-debug" : "argument-route-build",
  };
}

function cross(items, routes, builder) {
  const variants = [];
  for (const item of items) {
    for (const route of routes) variants.push(builder(item, route, variants.length));
  }
  return variants;
}

function validateBank(currentPack, authored, candidates) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}.`);
  if (candidates.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const formats = new Set(currentPack.practice.formats);
  const requiredCoverage = new Set(["claims", "reasons", "evidence", "counterarguments", "rebuttals", "paragraph_structure", "logical_links", "evidence_quality", "fallacies"]);
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
    if (!variant.body.dyslexia_support?.increased_spacing || !variant.body.dyslexia_support?.line_focus || !variant.body.dyslexia_support?.chunked_card_view || variant.body.reduced_visual_load !== true || !variant.body.reduced_language_route) throw new Error(`${variant.id} lacks SEND scaffolds.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.leaderboard_allowed !== false || variant.body.public_performance_required !== false || variant.body.peer_comparison_allowed !== false) throw new Error(`${variant.id} introduces social or time pressure.`);
    if (variant.body.gamification?.loss_on_error !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.individual_progress_only !== true || variant.body.gamification?.peer_comparison !== false) throw new Error(`${variant.id} has unsuitable gamification.`);
    if (variant.body.audio_optional !== true || variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} violates optional audio policy.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.reasoning_check || !variant.feedback?.respectful_disagreement || !variant.feedback?.evidence_limit || variant.hints.length < 2 || variant.explanation.length < 110) throw new Error(`${variant.id} lacks rich feedback.`);
    if (variant.body.training_evidence_status !== "fictional_case_file_for_reasoning_practice_not_a_real_world_source") throw new Error(`${variant.id} does not label fictional evidence.`);
    if (Array.isArray(variant.expected_answer.value)) {
      if (variant.format === "paragraph-build" && !sameMembers(variant.expected_answer.value, variant.body.sentences)) throw new Error(`${variant.id} paragraph answer does not use every sentence exactly once.`);
      if (variant.format === "argument-map" && variant.expected_answer.value.length !== variant.body.sentences.length) throw new Error(`${variant.id} role map is incomplete.`);
    } else {
      if (!Array.isArray(variant.body.choices) || new Set(variant.body.choices).size !== variant.body.choices.length || variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must offer its answer exactly once.`);
    }
    for (const tag of variant.body.coverage_tags) actualCoverage.add(tag);
    actualFormats.add(variant.format);
    actualBlueprints.add(variant.body.variant_blueprint_id);
  }
  requireCoverage("content", requiredCoverage, actualCoverage);
  requireCoverage("formats", formats, actualFormats);
  requireCoverage("blueprints", new Set(blueprints.keys()), actualBlueprints);
  const allocation = countBy(candidates, (variant) => variant.body.variant_blueprint_id);
  const expectedAllocation = { "claim-role-sorts": 48, "evidence-relevance-rankings": 48, "coherent-paragraph-builds": 48, "counterargument-rebuttal-tests": 48, "argument-transfer-retrieval": 44 };
  for (const [id, expected] of Object.entries(expectedAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
}

function sameMembers(left, right) { return left.length === right.length && new Set(left).size === left.length && left.every((item) => right.includes(item)); }
function requireCoverage(label, required, actual) { const missing = [...required].filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = countBy(items, keyFor); return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
