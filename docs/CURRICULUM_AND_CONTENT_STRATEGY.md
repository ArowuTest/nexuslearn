# Curriculum and Content Strategy

Status: Build-governing content plan  
Scope: UK Years 1-7 across core and foundation subjects

Companion implementation assets:

- `docs/CURRICULUM_RESEARCH_AND_BUILD_BLUEPRINT.md`
- `packages/content/research/uk-y1-y7-curriculum-source-map.json`
- `packages/content/templates/objective-pack.schema.json`
- `packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json`
- `docs/OBJECTIVE_PACK_IMPORTER.md`

## 1. Why This Matters

The curriculum is the product. Animation makes the experience memorable, but curriculum quality makes the platform valuable to parents and schools.

The platform must not become a collection of random games. Every activity, mission, reward and report must be anchored to a curriculum objective and produce evidence.

Every objective needs a full learning resource pack before it is considered
production-ready:

- teach moment with child-facing explanation, worked example and audio script
- animated concept model showing the idea visually before assessment begins
- guided "try it with me" interaction where the child manipulates the concept
- prerequisite probe to find missing foundations before a child is marked wrong
- misconception probes with specific repair prompts
- practice set across at least three interaction formats where appropriate
- adaptive assessment items at intro, developing, expected and secure levels
- hint ladder, feedback copy, parent explanation and teacher evidence language
- animation hooks for intro, thinking, success, repair and mastery moments
- accessibility variant notes for low-sensory, audio-first and reading-support modes

Public access requests from parents, schools and tutoring organisations should
feed the content roadmap. If demand clusters around a year group, subject or
intervention need, that evidence should influence which resource packs are
produced and QA-tested first.

## Adaptive Inclusion Profile

The platform should treat learning support as a core personalisation system, not
as a hidden accessibility checkbox. Parents and schools can optionally declare
support needs such as ADHD, autism, dyslexia, dyscalculia, dyspraxia,
speech/language needs, sensory sensitivity, working-memory support, processing
speed support, EAL, hearing/vision support, fine-motor support and
anxiety/confidence needs.

Those declarations must be translated into practical learning adaptations:

- predictable routines and warm-up rituals
- shorter missions or extended processing time
- lower sensory load, reduced motion and quieter celebration styles
- audio-first or audio-visual prompts
- visual steps, worked examples and chunked instructions
- gentler repair language for confidence-sensitive learners
- high-challenge mode for learners who need stretch rather than repetition
- companion tone, reward type and world feedback matched to the child

The declared profile should never be the only signal. The adaptive engine should
combine parent/school-declared support needs with observed response patterns,
confidence, hint use, speed, error type and repair success. The goal is a better
learning approach, not a medical label.

## Teaching-First Standard

NexusLearn must teach before it tests. A content pack is not complete if it only
contains questions, even if there are hundreds of variants. Question volume gives
practice coverage; it does not, by itself, teach the concept.

Each production objective should therefore include this learning sequence:

1. Concept launch: a short animated hook that places the idea inside the child's
   world and explains why it matters.
2. Explicit teaching: child-facing explanation, vocabulary, visual model and
   narrated worked example.
3. Manipulative exploration: the child moves, builds, sorts, traces, highlights,
   balances, speaks or listens to interact with the concept before being judged.
4. Guided practice: scaffolded tasks with hints, modelled steps and companion
   prompts.
5. Misconception check: targeted probes for likely wrong ideas, with repair
   activities rather than generic incorrect feedback.
6. Independent practice: varied question and task formats, including generated
   variants where safe.
7. Teach-back: the child explains or demonstrates the idea to the companion once
   they are ready.
8. Mastery and retention: spaced retrieval, mixed contexts and evidence across
   formats before the objective can be marked secure.

The content system should distinguish these item types in schema and admin UI:

- lesson: the ordered teaching journey for one objective or tightly related
  objective cluster
- lesson_step: explanation, animation, worked example, prompt, audio and
  accessibility variant for each teaching moment
- manipulative: reusable interactive model such as array builder, number line,
  fraction wall, phoneme blender, sentence builder, map explorer or simulation
  slider
- activity: the playable mission container that wraps teaching, practice,
  repair and reward
- question_variant: one assessable item inside practice or review
- repair: misconception-specific reteach path
- evidence_rule: what counts as objective progress for parent, teacher and
  adaptive-engine reporting

Admin and content tooling should make this visible. Content authors should see
whether an objective has a teach moment, manipulative, misconception repair,
practice variants, audio, animation hooks, SEND adaptations and adult reporting
language. Objectives missing those fields should remain draft or pilot content,
not production curriculum.

The curriculum research/build blueprint and objective-pack schema are the
production contract for this standard. New curriculum content should be created
as objective packs first, then promoted into database-backed activities,
questions, rewards, assets and runtime configuration only after review.

The objective-pack importer is the first implementation of that promotion path.
It validates pack quality, compiles admin API payloads and can publish reviewed
packs through protected admin endpoints without manual copy-paste.

## 2. Curriculum Structure

The curriculum graph should use this hierarchy:

1. Key Stage
2. Year Group
3. Subject
4. Strand
5. Topic
6. Subtopic
7. Objective
8. Skill Statement
9. Prerequisites
10. Misconceptions
11. Activity Templates
12. Mastery Evidence
13. Reporting Language

## 3. Subject Roadmap

### Phase A: Core Proof Subjects

Mathematics:

- Number and place value
- Addition and subtraction
- Multiplication and division
- Fractions, decimals and percentages
- Measurement
- Geometry
- Statistics
- Ratio and proportion
- Algebra foundations

English Reading:

- Decoding and fluency
- Vocabulary
- Retrieval
- Inference
- Prediction
- Sequencing
- Summarising
- Authorial choice
- Comparative reading

Phonics and Spelling:

- Grapheme-phoneme correspondence
- Blending
- Segmenting
- Common exception words
- Prefixes and suffixes
- Spelling patterns
- Morphology

English Writing and Grammar:

- Sentence construction
- Punctuation
- Grammar
- Vocabulary choice
- Paragraphing
- Cohesion
- Planning
- Editing
- Writing for purpose and audience

Science:

- Plants
- Animals including humans
- Materials
- Rocks
- Light
- Forces
- Electricity
- Sound
- Earth and space
- Evolution and inheritance
- Working scientifically

### Phase B: Wider Curriculum

Computing:

- Algorithms
- Debugging
- Data
- Networks
- Digital literacy
- Programming concepts

Geography:

- Maps
- Place knowledge
- Human and physical geography
- Climate
- Rivers
- Settlements
- Fieldwork skills

History:

- Chronology
- Source interpretation
- Civilisations
- British history
- Change and continuity
- Cause and consequence

Design and Technology:

- Design criteria
- Structures
- Mechanisms
- Materials
- Food and nutrition
- Evaluation

Creative and PSHE-style Knowledge:

- Art concepts
- Music knowledge
- Wellbeing and citizenship where appropriate for schools
- Cross-curricular projects

## 4. Year Group Learning Worlds and Curriculum Role

### Year 1: Number Garden and Letter Zoo

Curriculum role:

- Early number sense
- Counting
- Simple addition and subtraction
- Shape
- Phonics
- CVC words
- Listening comprehension

Interaction style:

- Audio-first
- Tap, drag, sort, trace
- Large targets
- Minimal text
- Very short sessions

### Year 2: Storybook Kingdom

Curriculum role:

- Reading fluency
- Phonics consolidation
- Sentence building
- Number bonds
- Place value
- Basic measures
- Early science concepts

Interaction style:

- Narrated stories
- Word blocks
- Picture-supported vocabulary
- Gentle sequencing
- Tracing and sorting

### Year 3: Explorer Islands

Curriculum role:

- Times tables foundations
- Fractions
- Paragraphs
- Grammar expansion
- Rocks, fossils and plants
- Maps and compass directions

Interaction style:

- Missions across islands
- Field journal
- Drag-build
- Interactive diagrams
- Short reasoning tasks

### Year 4: Dino-Craft Lab

Curriculum role:

- Multiplication Tables Check
- Written methods
- Fractions
- Area and perimeter
- Coordinates
- Grammar
- States of matter
- Electricity and habitats

Interaction style:

- Isometric building
- Timed recall where appropriate
- Arrays and manipulatives
- Fossil misconceptions
- Companion teach-back

### Year 5: Space Engineers and Eco Cities

Curriculum role:

- Fractions, decimals and percentages
- Multi-step reasoning
- Earth and space
- Forces
- Complex sentences
- Reading inference
- Geography and climate data

Interaction style:

- Systems balancing
- Resource meters
- Simulations
- Mission briefings
- Longer but chunked tasks

### Year 6: Quest Academy

Curriculum role:

- SATs readiness
- Arithmetic fluency
- Reasoning
- Reading comprehension
- Grammar precision
- Writing quality
- Science consolidation

Interaction style:

- Training arenas
- Skill rooms
- Low-pressure timed practice
- Intervention paths
- Exam confidence mode

### Year 7: Future Worlds Lab

Curriculum role:

- Secondary transition
- Algebra foundations
- Ratio and scale
- Scientific method
- Literature foundations
- Geography and history analysis
- Computing logic

Interaction style:

- Simulations
- Labs
- Strategy missions
- Independent learning dashboard
- Study habits and self-regulation

## 5. Objective Pack Schema

Each objective should be produced as a complete pack.

```json
{
  "id": "ma-y4-number-multiplication-12x12",
  "year": 4,
  "subject": "Mathematics",
  "strand": "Number",
  "topic": "Multiplication and division",
  "statement": "Recall multiplication and division facts for multiplication tables up to 12 x 12.",
  "prerequisites": [
    "ma-y2-count-in-2-5-10",
    "ma-y3-recall-3-4-8-tables",
    "ma-y3-arrays-repeated-addition"
  ],
  "misconceptions": [
    "confuses 6x8 and 7x8",
    "counts every fact from the start",
    "does not connect division facts to multiplication"
  ],
  "mastery": {
    "expected": 80,
    "secure": 90,
    "requires_retention_days": [1, 3, 7, 14, 30],
    "requires_formats": ["timed-recall", "array-build", "division-match"]
  },
  "teaching": {
    "concept_launch": "The incubator needs equal groups of energy cells.",
    "worked_example": "7 rows of 8 cells can be split into 5 rows of 8 and 2 rows of 8.",
    "manipulatives": ["array-builder", "factor-pair-tiles"],
    "teach_back_prompt": "Can you show your companion why 7 x 8 is 56?"
  },
  "adult_explanation": "Can recall mixed multiplication and division facts with increasing fluency.",
  "teacher_evidence": "Accuracy, speed, mixed recall, retention and reduced hint use."
}
```

## 6. Activity Pack Schema

```json
{
  "id": "act-dino-incubator-7x8",
  "objective_id": "ma-y4-number-multiplication-12x12",
  "world": "dino-craft",
  "type": "timed-recall",
  "difficulty": 6,
  "prompt": "Power the incubator with 7 x 8.",
  "lesson_steps": [
    {
      "kind": "teach",
      "animation": "array-grow",
      "audio_script": "Seven groups of eight means seven equal rows."
    },
    {
      "kind": "guided_practice",
      "interaction": "array-builder",
      "scaffold": "Build five rows first, then add two more rows."
    }
  ],
  "interaction": "number-pad",
  "hint_ladder": [
    "Think of 7 groups of 8.",
    "Build 7 rows with 8 blocks in each row.",
    "5 groups of 8 is 40. Add 2 more groups of 8."
  ],
  "success_animation": "incubator-charge",
  "error_animation": "array-scaffold",
  "reward_hook": "fossil-shard"
}
```

## 7. Interaction Vocabulary

Build each interaction type once and reuse it across subjects.

- Tap choice
- Number pad
- Drag sort
- Match pairs
- Drag build
- Array builder
- Sequence cards
- Word build
- Sentence build
- Highlight text
- Trace path
- Timeline arrange
- Map locate
- Simulation slider
- Free-write prompt
- Audio listen and choose
- Timed recall
- Teach-back explain

## 8. Content Volume Planning

The full product will require thousands of content items. The plan must treat content as a production pipeline.

Approximate pack targets:

- Pilot objective: 30-80 question variants
- Mature objective: 80-150 variants across formats
- Younger-year objective: fewer text items, more narrated and visual variants
- Reading objective: fewer objectives but larger passage and question sets
- Writing objective: prompts, examples, rubrics and teacher/AI-assisted review workflows

## 9. Review Workflow

1. Curriculum mapping
2. Objective pack drafted
3. Misconceptions and prerequisites reviewed
4. Activity formats selected
5. Question variants generated
6. Hints and explanations written
7. Audio scripts written
8. Accessibility review
9. Safeguarding/content review
10. Teacher review
11. Readiness report review
12. Pilot data review
13. Release to production

AI can help draft variants, hints and explanations, but every published pack needs human review before wide release.

The Admin Console Readiness tab and `/v1/admin/content/readiness` endpoint are
the Phase 3.6 operational gate. A pack is not "ready" merely because it contains
questions. It must show a complete curriculum objective, prerequisites,
misconceptions, mastery cadence, required formats, runtime-approved teaching
activity, hints, explanations, expected answers and animation hooks. Objectives
below the ready threshold should stay in draft or pilot status until the missing
items are resolved.

## 10. Mastery Model Requirements

Mastery must consider:

- Accuracy
- Speed where appropriate
- Hint usage
- Attempts
- Confidence
- Retention over time
- Difficulty
- Variety of contexts
- Question format coverage
- Misconception repair

Mastery must not be awarded from one correct answer.

## 11. Reporting Language

Reports should avoid jargon and avoid false precision.

Good:

- "Alex is secure with 3, 4 and 8 times tables, but still hesitates on 6 x 8 and 7 x 8."
- "The system is revisiting arrays because multiplication recall is affecting area questions."
- "Next focus: mixed multiplication facts and area of rectangles."

Avoid:

- "Alex is 72.193% proficient."
- "AI predicts low ability."
- "Failed objective."

## 12. Curriculum Build Order

Recommended order:

1. Year 4 Maths proof pack
2. Year 3 Maths prerequisite pack
3. Year 5 Maths extension pack
4. Year 1 phonics and number pack
5. Year 2 phonics, reading and sentence pack
6. Year 6 arithmetic and reading pack
7. Year 7 transition maths and science pack
8. Science foundation packs
9. Wider curriculum packs

This order gives the product a spine across Years 1-7 while keeping early build effort manageable.
