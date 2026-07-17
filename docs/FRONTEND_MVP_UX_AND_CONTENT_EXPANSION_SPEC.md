# NexusLearn Frontend MVP, UX and Content Expansion Specification

Status: active product direction
Owner: product, curriculum and engineering
Scope: frontend-first MVP hardening before wider subject expansion

## 1. Product decision

The first release should be a polished, trustworthy MVP for the existing three
subjects:

- English
- Mathematics
- Science

Years 1-7 remain in scope, but the product must be honest about the current
curriculum boundary. The current packs are not a complete UK-wide curriculum.
The first release should therefore be described as an England-aligned,
three-subject adaptive learning MVP until wider subject coverage is built and
reviewed.

The correct order is:

1. Make the child, family, teacher and platform-admin journeys coherent.
2. Make the three-subject learning loop delightful, accessible and measurable.
3. Put produced audio and human listening QA into the normal operating UI.
4. Complete teacher verification and release controls.
5. Expand into Computing and History.
6. Add Spanish and French as curriculum-mapped language pathways.

This prevents the product from growing curriculum breadth faster than it can
deliver a consistent, safe and enjoyable experience.

## 2. Current frontend audit

### What is already valuable

- The visual identity is distinctive: dark Nexus worlds, bright portal accents,
  a companion character and a clear child-safe tone.
- The runtime already supports adaptive mission selection, SEND-oriented
  profiles, reduced motion, high contrast, larger targets, audio-first routes,
  multiple response modes and persistent evidence.
- Missions have teaching steps, practice, feedback, rewards and animation hooks.
- Parent, family, school-admin and platform-admin surfaces already exist.
- ElevenLabs-produced narration is represented as a governed asset set, with
  technical validation separated from human listening approval.

### Current experience problems to fix

- The landing page can show zero years, objectives and subjects when the API is
  unavailable. That looks like an empty product rather than an honest loading or
  connection state.
- The child portal presents many world cards, but the relationship between a
  learner profile, year group, subject, daily route and next mission is not
  obvious enough.
- Repeated `Login` labels on portals make the cards feel like locked marketing
  tiles instead of the beginning of a predictable child journey.
- The same bright/dark visual language is not yet a consistent interaction
  system across child, parent, teacher and admin surfaces.
- Progress is often expressed as system language (runtime, evidence, route,
  configuration) before the user is told what to do next.
- The admin readiness view has the right reports but is too report-oriented for
  a teacher or audio reviewer who needs to listen, decide and record evidence.
- Audio files can be inspected through generated HTML, but human listening QA
  is not yet a first-class in-product workflow.
- Teacher verification exists as a separate evidence workflow; it needs clearer
  links from objective readiness, mission evidence and intervention review.

## 3. Experience architecture

The product should use four deliberately different lanes with one shared design
system.

### Child lane

`Access card -> Profile supports -> Today's route -> Warm up -> Learn -> Practise -> Finish -> World growth`

The child should always know:

- where they are;
- what they are learning;
- what to try next;
- how support changes the route;
- what they earned or built;
- that mistakes are useful and safe.

### Family lane

`Create account -> Add child -> Choose support profile -> See next step -> Read evidence -> Adjust preferences`

Family language should explain learning evidence without exposing internal
implementation terms. The family view must distinguish engagement, accuracy,
mastery confidence, retention and teacher evidence.

### Teacher lane

`School access -> Classes/groups -> Learner profile -> Objective evidence -> Add observation -> Review intervention -> Plan next step`

Teacher actions must be fast, auditable and contextual. A teacher should not
need to understand the content-generation pipeline to verify a child's work.

### Platform-admin lane

`Sign in -> Release health -> Access and organisations -> Curriculum -> Audio QA -> Readiness -> Audit`

Admin navigation should be organised by operating job, not by database entity.
The existing CRUD editors remain available, but readiness and review work must
be easier to find than raw configuration.

## 4. MVP navigation and page contracts

### Public landing page

Primary message: “A playful learning universe that makes real progress visible.”

Required content:

- clear MVP scope: England Years 1-7, English, Mathematics and Science;
- child entry, family entry and school entry as distinct calls to action;
- three proof points: adaptive support, produced narration and evidence-rich
  missions;
- honest service state when the API is unavailable;
- no unverified claims of complete UK curriculum coverage.

### Child portal

The top of the page must show a three-step route:

1. Warm up — retrieve one idea.
2. Mission — learn and practise the next objective.
3. Grow — earn a world update and schedule the next review.

World cards should show year, world name, the available MVP subjects and a
single action label such as “Use your access card” or “Continue mission”.

### Mission page

The mission shell should keep a stable structure across all years:

- compact route breadcrumb;
- mission title and curriculum focus;
- progress rail for Learn, Practise and Finish;
- support controls grouped in one predictable place;
- companion feedback with a calm fallback;
- produced audio replay beside the relevant teaching text;
- visible response-mode alternatives where the learner profile permits them;
- end-of-mission summary that explains evidence, reward and next review.

### Family and teacher pages

Both pages should use the same status vocabulary:

- Starting
- Practising
- Secure for now
- Review due
- Needs a different explanation
- Teacher observation added

Percentages can be shown as supporting detail, but should not be the primary
meaning of progress.

### Admin readiness and review

The readiness area should open with an action board:

- curriculum gaps;
- audio awaiting listening;
- packs awaiting independent review;
- renderer or asset blockers;
- release decisions requiring evidence.

Each queue item must have an owner, reason, evidence requirement and next
action. Static reports remain available for audit and export.

## 5. Shared design system

### Visual language

- Use dark indigo for the Nexus world, warm cream for adult explanation, and
  one accent per subject or world.
- Keep rounded shapes, but use fewer competing card styles.
- Use one primary action per panel and one quiet secondary action.
- Use icon plus text for critical actions; colour alone must never carry state.
- Use the companion for warmth and orientation, not as decoration on every
  surface.

### Type and content

- Short headings, plain-English instructions and one idea per paragraph.
- Year 1-3 copy should be audio-led and concrete.
- Years 4-7 copy can introduce subject vocabulary, but definitions remain
  visible and replayable.
- Adult views can expose evidence detail behind progressive disclosure.

### Motion and sound

- Motion should communicate state: route opening, focus, progress, repair and
  reward.
- No continuous motion is required to understand a task.
- Reduced-motion and low-sensory modes must remove ambient effects without
  removing curriculum evidence or reward meaning.
- Produced narration is the only learning narration route. Browser text to
  speech must not be used as a quality substitute.

## 6. Gamification contract

Gamification must reinforce learning rather than compete with it.

Every mission should have:

- a named objective;
- one meaningful warm-up;
- a teach moment;
- supported practice;
- an independent or alternative-format check;
- a visible evidence outcome;
- a small world-building or collection reward;
- a clear reason to return through spaced review.

Rewards should vary by learner profile: world building, collecting, story or
challenge. Leaderboards remain off by default. Celebration intensity must follow
the learner's profile and never punish an incorrect answer.

The shared progression vocabulary is:

`Notice -> Try -> Repair -> Prove -> Grow -> Return`

This sequence should be recognisable in English, Mathematics and Science and
should remain reusable when new subjects are added.

## 7. SEND and inclusion contract

Support changes access, pacing and representation—not the learner's entitlement
to ambitious curriculum content.

The UI must make the following options easy to discover and consistent across
modules:

- audio-first and replay;
- visual steps and worked examples;
- reduced reading load and chunked text;
- high contrast and large targets;
- simplified controls and keyboard/switch-compatible response paths;
- reduced motion and low-sensory celebration;
- short-burst sessions and predictable routines;
- extra processing time;
- confidence-first or challenge-forward reward styles.

Support choices should be explained to adults and quietly reflected to children
as helpful tools, never as labels that define them.

## 8. Audio and teacher verification workflow

### Audio listening QA

The admin UI should provide a first-class queue backed by the generated
narration priority report. Each item includes:

- Year, subject pack and lesson/vocabulary label;
- text preview;
- ElevenLabs voice and production binding;
- an embedded MP3 player;
- criteria: natural, clear, pronunciation, age suitable;
- reviewer name, decision and notes;
- rejection reasons and re-record recommendation;
- a visible distinction between technical pass and listening approval.

The current generated report identifies 874 technically valid assets awaiting
human listening approval. No asset should be treated as production-approved
because its MP3 merely exists.

### Persistence requirement

The development UI may save review drafts locally while the backend review-ledger
endpoint is being completed. Production approval must be persisted server-side
with reviewer identity, timestamp, criteria, notes and a content/audio binding
hash. A stale review must be invalidated automatically if the script, voice or
MP3 changes.

### Teacher verification

Teacher verification should use the same action pattern:

`Open evidence -> observe -> choose outcome -> add note -> set next review -> save audit record`

Curriculum readiness should link directly to teacher evidence prompts, and the
teacher view should show the relevant objective, expected evidence, SEND access
route and recent attempts before a decision is recorded.

## 9. Content expansion backlog

Expansion is deliberately postponed until the MVP shell is stable.

### Wave 1: Computing

Build an England-first Years 1-7 pathway covering:

- algorithms and sequencing;
- creating, debugging and evaluating programs;
- data representation and information;
- networks, search and digital safety;
- digital content creation and responsible use.

Each pack needs a visual or manipulable interaction, not only multiple choice.
SEND alternatives should include block/step ordering, audio instructions,
keyboard operation and low-distraction code views.

### Wave 2: History

Build a chronologically coherent pathway rather than isolated fact quizzes:

- chronology and change;
- historical enquiry and evidence;
- local, national and global perspectives;
- vocabulary, source reliability and interpretation;
- explicit separation of evidence from invented narrative.

Missions should use source comparison, timelines, artefact classification and
explanation tasks. Sensitive historical content needs safeguarding and age-
appropriate review.

### Wave 3: Spanish and French

Languages should be designed as a friendly progression system, not a vocabulary
flashcard copy.

Each language needs:

- listening, speaking, reading and writing strands;
- pronunciation and phoneme support;
- retrieval with spaced return;
- sentence building and meaningful context;
- culture and communication tasks;
- accessible replay, slower audio and visual support;
- an England programme-of-study alignment layer with optional CEFR reporting.

The language engine should share the same mission loop but use language-specific
interaction templates: listen-and-choose, sound-to-word, phrase builder,
picture-to-sentence, role-play choice and short recorded response where consent,
safeguarding and technical support are ready.

### Expansion acceptance gate

No new subject is ready for release until it has:

- statutory source mapping and year/key-stage boundaries;
- a complete subject progression map;
- enough authored depth for the intended pilot, not only a sample;
- teaching, practice, assessment, animation and reward coverage;
- SEND and equivalent-response paths;
- audio scripts and produced audio where required;
- teacher, accessibility and safeguarding review;
- renderer and performance acceptance;
- evidence and reporting language for adults.

## 10. Delivery order

### Frontend hardening first

- [ ] Shared child journey chrome and route status vocabulary.
- [ ] Honest API loading, empty and unavailable states.
- [ ] Child portal redesign around warm-up, mission and growth.
- [ ] Consistent subject identity for English, Mathematics and Science.
- [ ] Mission support controls and audio replay made easier to find.
- [x] Audio listening queue embedded in admin readiness, with embedded playback,
  criteria capture and server review status.
- [ ] Teacher evidence links and review context improved.
- [ ] Responsive, keyboard and reduced-motion visual QA across all lanes.

### Then platform readiness

- [x] Server-persisted narration review ledger and stale-binding checks. Reviews
  are bound to the current script/audio hashes and cannot be saved against a
  changed manifest asset.
- [ ] Server-persisted teacher audio/content review decisions.
- [ ] Release dashboard that blocks production claims while human gates are open.
- [ ] Independent teacher and SEND review workflow.
- [ ] Pilot evidence and child-safety sign-off.

### Only then expand content

- [ ] Computing roadmap and first complete pilot set.
- [ ] History roadmap and first complete pilot set.
- [ ] Spanish roadmap and audio/pronunciation design.
- [ ] French roadmap and audio/pronunciation design.

## 11. Definition of frontend MVP done

The MVP frontend is ready when a new child, parent, teacher and admin can each
complete their primary journey without needing an internal explanation; when
every child mission presents the same understandable progression; when every
support mode is discoverable and tested; and when an authorised reviewer can
listen to produced narration, record a reasoned decision and see exactly whether
that decision is draft, technically valid, human-approved or release-blocked.
