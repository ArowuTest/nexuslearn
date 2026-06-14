# Curriculum Research and Build Blueprint

Status: Build-governing standard  
Scope: England Years 1-7, home, tutoring and school use  
Updated: 2026-06-14

## 1. Product Standard

NexusLearn must become a teaching system, not a question bank. The curriculum
build is therefore treated as product engineering: researched, versioned,
reviewed, tested with learners and measurable through evidence.

An objective is not production-ready until the platform can:

- teach the concept clearly before assessment
- show the idea through animation, audio, text and manipulation
- probe prerequisites before calling an answer wrong
- detect likely misconceptions and route to repair
- practise across varied formats and contexts
- adapt for SEND, sensory, attention, reading and audio needs
- collect explainable evidence for parents, teachers and the adaptive engine
- survive QA, safeguarding, accessibility and teacher review

## 2. Source Hierarchy

Use this source hierarchy when building curriculum packs.

1. Statutory source of truth
   - GOV.UK National Curriculum collection
   - National Curriculum framework for key stages 1 to 4
   - Subject programmes of study and attainment targets
2. Official supporting guidance
   - DfE non-statutory maths guidance
   - NCETM materials where they clarify progression
   - DfE assessment frameworks where relevant
3. Evidence-informed pedagogy
   - Education Endowment Foundation evidence summaries
   - High-quality subject association guidance
   - Cognitive science principles used cautiously and teacher-reviewed
4. School/product evidence
   - Access requests and pilot demand
   - Teacher feedback
   - Pupil outcome data
   - Misconception and hint-use analytics

No commercial worksheet, blog, AI output or unofficial sequence should override
the statutory curriculum source. AI can accelerate drafting, but human review
must approve every published pack.

## 3. Year and Key Stage Translation

NexusLearn uses year groups because parents and children understand them. The
research layer must also keep the statutory key-stage alignment.

- Year 1: Key Stage 1
- Year 2: Key Stage 1
- Year 3: Key Stage 2
- Year 4: Key Stage 2
- Year 5: Key Stage 2
- Year 6: Key Stage 2
- Year 7: Key Stage 3 transition

Year 7 must not be treated as "more Year 6". It should bridge KS2 mastery into
KS3 expectations: algebraic thinking, proportional reasoning, scientific models,
disciplinary vocabulary, longer reading, text evidence and subject-specialist
habits.

## 4. Subject Coverage Model

### Build Priority

1. Mathematics
2. English reading
3. Phonics, spelling and morphology
4. English writing, grammar and punctuation
5. Science
6. Computing
7. Geography
8. History
9. Design and technology
10. Art and design, music, languages, PSHE-style wellbeing and cross-curricular
    knowledge

### Statutory Breadth

The product roadmap should eventually support all National Curriculum subjects
where a digital learning experience makes sense. PE, music performance, art
practice and design build tasks can still have digital support, but should be
framed honestly: concept teaching, vocabulary, analysis, planning, reflection
and evidence capture, not a replacement for physical or creative practice.

### Local and Optional Subjects

Religious education and PSHE differ by school/local setup. They should be
tenant-configurable content channels, not hardcoded core curriculum. Safeguarding
and age-appropriateness review must be stricter for these channels.

## 5. Curriculum Object Model

Each objective pack must include:

- source alignment: statutory source, key stage, year, subject, strand and
  source statement
- child objective: short, age-appropriate "I can..." style learning goal
- prerequisite graph: direct prerequisites and diagnostic probes
- misconception map: at least three likely wrong ideas, each with a repair path
- vocabulary: tiered terms, child-friendly explanations, audio script and visual
  anchor
- teaching model: concept launch, explanation, worked example and "try it with
  me" guided practice
- manipulative: the concrete/visual/interactive model children use before
  assessment
- adaptive practice: intro, developing, expected and secure tasks
- retrieval plan: review days, mixed practice and interleaving rules
- evidence model: what counts as progress, mastery and secure retention
- adult reporting language: parent summary, teacher evidence and next action
- animation plan: hooks for intro, thinking, hint, repair, success, mastery and
  world growth
- inclusion variants: low-sensory, reduced motion, audio-first, reading support,
  dyslexia-friendly, ADHD/chunked, autism/predictability and confidence-first
  variants
- QA state: draft, review, pilot, approved, published, archived

## 6. Objective Decomposition Rules

Statutory statements are often too broad for a single game mission. Decompose
them into teachable objectives using these rules:

- one objective should usually fit into a 5-12 minute child mission
- one objective should have a clear assessment signal
- one objective should have no more than one primary new concept
- if two misconceptions need different repairs, split or create sub-objectives
- if the objective requires multiple representations, define them as required
  formats rather than separate unrelated objectives
- preserve the statutory source link on every derived objective

Example:

Statutory statement:

> Solve problems involving similar shapes where the scale factor is known or can
> be found.

Derived Year 6/7-ready objectives:

- identify corresponding sides in similar shapes
- find a scale factor from two corresponding lengths
- use a scale factor to find a missing length
- distinguish multiplicative scaling from additive increase
- explain whether two shapes are similar using evidence

## 7. Teaching Sequence Standard

Every production objective follows this learning sequence.

1. Warm-up retrieval
   - 2-3 prerequisite or spaced-review prompts
   - low-stakes and predictable
2. Concept launch
   - short animated story reason
   - key vocabulary introduced with audio
3. Explicit teaching
   - child-facing explanation
   - visual model
   - worked example
4. Guided manipulation
   - child builds, sorts, traces, highlights, drags, listens, predicts or
     simulates the idea
5. Checkpoint
   - one diagnostic task to decide whether to scaffold, practise or repair
6. Misconception repair
   - targeted reteach if the error pattern is detected
7. Independent practice
   - varied tasks across required formats
8. Teach-back
   - the child explains or demonstrates the idea to the companion
9. Mastery and retention
   - score update, spaced review scheduling and persistent world growth

## 8. Research Workflow

### Stage 1: Source Capture

- collect official source links
- record source title, publisher, date and key-stage scope
- classify statutory, official-supporting, evidence or internal-pilot
- add source to the research register

### Stage 2: Curriculum Mapping

- map subject strands and topics by year/key stage
- identify where National Curriculum statements span several years
- identify transition objectives from Year 6 to Year 7
- mark which objectives are statutory, derived, prerequisite or enrichment

### Stage 3: Objective Graph

- write objective IDs using stable slugs
- add prerequisites and misconception links
- attach required formats and retention cadence
- add parent and teacher reporting language

### Stage 4: Pack Design

- define concept launch, manipulative and lesson steps
- choose interaction templates and animation hooks
- write SEND/adaptation variants
- define the evidence rule

### Stage 5: Variant Production

- generate or author question/task variants
- write hints, explanations and repair copy
- create audio scripts and visual/animation briefs
- tag difficulty and misconception probes

### Stage 6: Review and Pilot

- curriculum review
- teacher review
- accessibility and SEND review
- safeguarding/content review
- readiness report review
- child usability pilot
- outcome and engagement data review

### Stage 7: Release

- approve content version
- publish to runtime
- monitor errors, repairs, hint use and dropout
- schedule improvement cycle

## 9. Best-in-Class Research Register Fields

Every source record should include:

- source_id
- title
- publisher
- source_type
- jurisdiction
- key_stages
- subjects
- url
- publication_date
- last_checked
- status
- licensing_notes
- curriculum_use
- notes

This gives us an auditable chain from official curriculum source to child
mission and adult report.

## 10. Content Pack Volume Targets

Pilot objective:

- 1 concept launch
- 1 worked example
- 1 guided manipulative
- 2-3 misconception repairs
- 3 required formats where appropriate
- 30-80 question/task variants
- 1 parent summary
- 1 teacher evidence statement
- 1 low-sensory variant
- 1 audio-first variant for younger years or reading-support profiles

Mature objective:

- 1-2 concept launches by context
- 2-4 worked examples
- 2+ manipulatives or representations
- 3-6 misconception repairs
- 80-150 question/task variants
- 10+ spaced retrieval variants
- 5+ mixed-context variants
- full audio scripts for Years 1-3 and optional audio for Years 4-7
- animation hooks for all major states

High-stakes transition objectives such as Year 6 SATs readiness and Year 7
algebra/science bridge should receive mature packs earlier.

## 11. Subject-Specific Build Standards

### Mathematics

Maths objectives must include:

- concrete/pictorial/abstract progression
- representation mapping such as number line, base-ten, arrays, bar model,
  fraction wall, graph, table or algebra tiles
- efficient strategy prompts
- misconception-specific repair
- fluency, reasoning and problem-solving variants
- retention and mixed-practice schedule

Animation should show structure: regrouping, scaling, equal parts, equality,
movement along a number line, or transformation. Avoid animation that merely
celebrates without clarifying the mathematics.

### English Reading

Reading objectives must include:

- age-appropriate text or extract bank
- vocabulary pre-teach where necessary
- retrieval, inference, prediction, summarising and evidence tasks
- highlighting or evidence selection interactions
- oral/audio supports
- explanation prompts that separate "answer" from "evidence"

For Year 7, include disciplinary reading: literature, science explanations,
history/geography sources and argument texts.

### Phonics, Spelling and Morphology

Younger-year packs must include:

- audio as a primary interface, not an afterthought
- grapheme/phoneme mapping
- blending and segmenting manipulatives
- common exception word handling
- handwriting/tracing where relevant
- minimal reading load before the child has the skill

### Writing, Grammar and Punctuation

Writing objectives must include:

- sentence or paragraph builders
- editing interactions
- model/non-model comparisons
- spoken rehearsal
- vocabulary choices by purpose and audience
- teacher/AI-assisted review strategy for longer free writing

### Science

Science objectives must include:

- disciplinary vocabulary
- model/simulation or diagram interaction
- observe-predict-explain tasks
- misconception probes
- working scientifically links
- evidence distinction between naming, explaining and applying

Science animations should show invisible mechanisms: particle movement,
circuits, forces, light, sound, life processes and system relationships.

## 12. Adaptive and Inclusion Standards

Every pack must define how it changes for:

- ADHD or attention support: shorter missions, predictable steps, immediate
  goal clarity, reduced working-memory load
- autism or high-structure support: consistent routines, explicit transitions,
  optional reduced social flourish, clear visual sequence
- dyslexia/reading support: audio, chunked text, visual anchors, reduced copying
- dyscalculia/maths support: concrete models, number sense probes, lower symbol
  density, repeated representation mapping
- sensory sensitivity: reduced motion, quieter colours, no sudden celebration
- processing-speed support: extra time, fewer timed tasks, step-by-step reveal
- anxiety/confidence support: gentle repair language, private progress, no
  shame loops
- EAL: vocabulary pre-teach, image support, oral rehearsal, clear context

The support profile should modify delivery, not lower expectation automatically.

## 13. Animation and Interaction Quality Bar

Every animation must have a job:

- explain a concept
- direct attention
- give feedback
- mark progress
- reduce cognitive load
- create delight after effort

Each objective pack should specify:

- scene: world/biome/subject portal
- intro animation
- concept animation
- manipulative interaction
- hint animation
- repair animation
- success animation
- mastery/world-growth animation
- reduced-motion fallback
- low-sensory colour/motion treatment

## 14. Content Readiness Gates

Draft:

- source mapped
- objective written
- basic prerequisites and misconceptions captured

Review:

- teaching sequence drafted
- manipulative selected
- first variants written
- animation hooks defined
- inclusion variants drafted

Pilot:

- runtime-approved activity exists
- at least 30 variants for the objective or a justified smaller set
- hints and explanations complete
- parent and teacher language complete
- readiness score above pilot threshold

Published:

- teacher reviewed
- accessibility reviewed
- safeguarding reviewed
- readiness score at ready threshold
- pilot evidence checked
- no critical usability defects

Archived:

- superseded by a new content version or removed from runtime

## 15. Build Order

The build should expand in proof packs, not thin coverage everywhere.

1. Year 4 maths fluency and area proof pack
2. Year 1 phonics and early number proof pack
3. Year 6 SATs/transition maths and reading proof pack
4. Year 7 algebra and science bridge proof pack
5. Year 2 sentence punctuation and two-digit calculation
6. Year 3 fractions and plants
7. Year 5 inference, fractions and Earth/space
8. Wider computing, geography and history foundation packs

Each proof pack must include child runtime, adult reporting, adaptive support,
admin configuration and readiness reporting.

## 16. Acceptance Criteria

A curriculum build slice is accepted only when:

- official source links are recorded
- objectives are mapped by year, subject, strand and topic
- every objective has prerequisites and misconceptions
- every runtime objective has at least one teaching activity
- every runtime objective has published assessment/practice variants
- required formats are represented
- hints, explanations and repair paths exist
- animation hooks and reduced-motion alternatives exist
- parent and teacher reporting language is written
- readiness report shows pilot or ready status
- tests or validation checks prevent draft content being served to children
- docs and source registers are updated

## 17. Sources Checked

- GOV.UK National Curriculum collection:
  https://www.gov.uk/government/collections/national-curriculum
- GOV.UK National Curriculum framework for key stages 1 to 4:
  https://www.gov.uk/government/publications/national-curriculum-in-england-framework-for-key-stages-1-to-4
- GOV.UK Mathematics programmes of study:
  https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study
- GOV.UK English programmes of study:
  https://www.gov.uk/government/publications/national-curriculum-in-england-english-programmes-of-study
- GOV.UK Science programmes of study:
  https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study
- Education Endowment Foundation Teaching and Learning Toolkit:
  https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit
