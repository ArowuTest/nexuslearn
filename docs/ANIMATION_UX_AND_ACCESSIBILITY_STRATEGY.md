# Animation, UX and Accessibility Strategy

Status: Build-governing experience plan  
Scope: Child learning worlds, parent/school dashboards and accessibility

## 1. Experience Goal

NexusLearn should feel like a high-quality interactive learning world, not a worksheet with badges. The animation system must make learning clearer, feedback warmer and progress more visible.

Great animation is not volume. Great animation is timing, responsiveness, purpose, character and restraint.

## 2. Animation Principles

Every animation must be:

- Purposeful
- Fast
- Responsive
- Non-blocking
- Skippable where needed
- Reduced-motion safe
- Low-sensory compatible
- Smooth on school Chromebooks
- Reusable across content

## 3. Animation Technology Stack

### Game and Learning Scenes

Use PixiJS or Canvas for:

- Isometric world maps
- Drag-build activities
- Particle effects
- Physics-lite feedback
- Simulation scenes
- Map and timeline interactions
- Reward bursts

### Companion and Characters

Use Rive, Lottie, spritesheets or hand-rigged SVG depending on maturity.

Recommended path:

1. Hand-rigged SVG for prototype companions.
2. Rive for production companions with state machines.
3. Spritesheets for repeated world effects.

Companion state examples:

- Idle
- Listening
- Thinking
- Encouraging
- Celebrating
- Quiet celebration
- Confused
- Asking teach-back
- Low-sensory mode

### UI Motion

Use CSS and component-level animation for:

- Buttons
- Progress bars
- Tabs
- Modals
- Cards
- Dashboard transitions
- Loading states

Dashboard UI should be calmer than child worlds. Teachers need scanning and efficiency, not spectacle.

### Audio

Use tiered audio:

1. Browser speech synthesis as fallback.
2. Pre-generated narration for Year 1-2 and phonics.
3. Higher-quality generated or recorded voices for companion, narrator and key story moments.

Browser text-to-speech is not a release-quality child voice. It must not be
used for phonics, teaching narration or companion dialogue. Released voice
assets require a warm, natural UK delivery, human listening approval and
consistent loudness mastering. Phonemes additionally require SSP-specialist
approval, pure pronunciation without an added schwa and no music underneath.
Short Web Audio chimes may remain for non-verbal UI feedback when they are
gentle, optional and independently mutable.

Audio must always have:

- Mute control
- Captions or visible text
- Replay button
- No sudden loud sounds
- Low-sensory alternative

### Asset Production Manifest

Produced visual/audio work is tracked in
`packages/content/roadmaps/asset-production-manifest.json` and checked by
`packages/content/tools/asset-manifest-check.mjs`.

The manifest is the bridge between product ambition and release safety. It
tracks companion states, world portals, future world backdrops, interactive
manipulatives and narration assets by status, year coverage, runtime use,
format, accessibility guarantees and remaining production gaps.

Runtime child assets must be at least `prototype` status, include reduced
motion, low-sensory, labelling and Chromebook-budget coverage, and remain
behind feature flags where rollout risk exists. Planned assets can be designed
early, but they must not be treated as complete production art.

## 4. Rendering Tiers

The app should support four experience tiers.

Every interaction format also has a renderer-readiness status in
`packages/content/roadmaps/interaction-renderer-registry.json`. A curriculum
question can move into approved, published or live runtime status only when its
current renderer contract is implemented, scoreable and accessible. Planned
high-value formats such as circuit building, ratio tables, sentence builders,
graph/table input and rubric-scored short responses stay in review until their
real renderer and feedback loop exist.

### Full Animation

- Character state animations
- Particles
- Scene transitions
- Sound effects
- Reward bursts
- Ambient scene motion

### Standard Animation

- Character reactions
- Reduced particles
- Simple transitions
- Sound effects

### Low Animation

- Minimal transitions
- No particles
- No ambient motion
- Short character reactions only

### Static Accessible

- No motion beyond necessary state changes
- Clear text
- Strong focus states
- Audio optional
- Keyboard-friendly

## 5. Year Group UX Direction

### Year 1

Design tone:

- Soft, concrete, audio-first, friendly

UX:

- Large targets
- One instruction at a time
- Tap and drag
- No time pressure
- High praise frequency
- Visual counting objects
- Narration-first

Animation:

- Gentle bounces
- Soft animal reactions
- Letter and number morphs
- No flashing or fast effects

### Year 2

Design tone:

- Storybook, magical, confidence-building

UX:

- Narrated pages
- Word highlighting
- Sentence blocks
- Picture support
- Trace paths
- Short reading missions

Animation:

- Page turns
- Glowing trails
- Phonics blending movement
- Gentle reward sparkles

### Year 3

Design tone:

- Adventure, discovery, curiosity

UX:

- Islands and maps
- Tools and badges
- Field journal
- Drag-build reasoning
- Interactive diagrams

Animation:

- Boat travel
- Map unlocks
- Puzzle doors
- Badge reveals

### Year 4

Design tone:

- Dino research, craft, building, fast feedback

UX:

- Isometric habitats
- Incubators
- Fossil lab
- Array builders
- Timed fluency only when educationally appropriate
- Mistake Museum

Animation:

- Snap-to-grid tiles
- Fossil bursts
- Companion reactions
- Incubator charge
- Habitat construction

### Year 5

Design tone:

- Space engineering and eco-city systems

UX:

- Resource balancing
- Mission dashboards
- Simulations
- Multi-step reasoning
- Data interpretation

Animation:

- Orbits
- Resource meters
- Engine charge
- City growth
- Simulation feedback

### Year 6

Design tone:

- Quest academy, confidence, mastery

UX:

- Skill arenas
- Booster paths
- Low-pressure timed tasks
- Strategy explanations
- Teacher-assigned practice

Animation:

- Training room unlocks
- Boss progress bars
- Skill badges
- Calm success states

### Year 7

Design tone:

- Future lab, independence, secondary transition

UX:

- Labs
- Mission boards
- Simulations
- Study planning
- Self-regulation prompts

Animation:

- Sophisticated but calmer
- Simulation movement
- Data visualisation
- Blueprint building

## 6. Signature Engagement Systems

### Persistent Companion

Each child has a companion that:

- Reacts to progress
- Remembers recent learning safely
- Encourages after mistakes
- Asks teach-back questions
- Adapts celebration intensity

Companion memory should be bounded and educational:

- Recent objectives
- Repaired misconceptions
- Preferred celebration level
- Confidence patterns
- Accessibility needs

It must not pretend to be a human friend or provide open-ended chat.

### Persistent World

Mastery should visibly change the world:

- Garden grows
- Bridge repairs
- Islands unlock
- Dino habitats expand
- Space station modules activate
- Quest academy rooms open
- Future lab simulations unlock

World changes should be linked to objective mastery, not arbitrary time spent.

### Mistake Museum

Misconceptions become collectible learning trophies once repaired.

Examples:

- "I used to mix up 6 x 8 and 7 x 8."
- "I used to count every multiplication fact from 1."
- "I used to think area and perimeter were the same."

This reframes errors as visible progress.

### Teach-Back Mode

After mastery, the companion asks the child to teach it:

- Choose the best explanation
- Order the steps
- Build a model
- Fill a missing sentence
- Explain with blocks

This is retrieval practice and metacognition disguised as play.

### Class Quests

School classes can work toward shared goals:

- Build a bridge
- Restore a library
- Power a lab
- Complete a habitat

No public ranking by child. Contributions can include effort, improvement and mastery.

## 7. Accessibility Requirements

Required from early build:

- Reduced motion
- Low-sensory mode
- Mute and volume controls
- Replay audio
- Adjustable text size
- Dyslexia-friendly option
- High contrast
- Keyboard navigation
- Touch-friendly controls
- Clear focus states
- No essential information conveyed by colour alone
- No flashing effects
- No task failure caused solely by slow input unless fluency is the explicit objective

## 8. Performance Requirements

Targets:

- First learning screen interactive within 2 seconds after initial load where possible
- Child feedback under 100ms
- 60fps target for simple scenes
- Smooth on common Chromebooks
- Asset preloading for next activity
- Graceful fallback when API is cold or offline

Asset rules:

- Compress images
- Prefer vector or procedural art where appropriate
- Reuse spritesheets
- Lazy-load non-current worlds
- Preload only next likely activities

## 9. UI Quality Rules

Child UI:

- Clear focus
- Few choices at once
- Large buttons
- Strong visual hierarchy
- Minimal adult language
- Immediate feedback
- State visible without reading long text

Parent UI:

- Plain-English explanations
- Next steps
- Progress trends
- Confidence and effort signals
- No overwhelming analytics

Teacher UI:

- Dense but calm
- Filterable
- Exportable
- Objective-first
- Grouping and intervention focused
- Avoid decorative game styling in operational screens

## 10. First Production Art Direction

The prototype can use CSS/SVG/procedural visuals. Production should introduce:

- Rive companion rigs
- A reusable tile and prop library for each world
- A shared motion vocabulary
- Scene-specific sound palette
- Audio narration scripts
- Icon system
- Brand guide

Do not commission large amounts of art before the interaction templates and curriculum packs are stable.

Current Phase 3 runtime position:

- The child mission now uses a Learning Studio renderer rather than one generic
  quiz surface.
- Numeric work has array/energy visuals.
- Phonics and early reading formats can show audio/listen chips.
- Letter-formation formats can show a traced path, start dot and reduced-motion
  fallback path.
- Writing formats can show sentence/theme cards and paragraph grouping choices.
- Science model formats can show particle chambers, movement states and
  model-sort/explain-choice panels.
- These are code-native first-pass renderers. Production still needs real art,
  touch-tested drag/drop, stroke recognition, richer simulation controls, Rive
  companions, audio narration and per-world asset libraries.

## 11. Acceptance Criteria

An animated activity is ready only when:

- It maps to an objective.
- The interaction teaches or assesses the skill.
- Correct and incorrect states are both designed.
- There is a scaffolded retry.
- It works with reduced motion.
- It works with sound off.
- It works on mobile/tablet/Chromebook sizes.
- It produces evidence for reporting.
- It has a content authoring path for more variants.
