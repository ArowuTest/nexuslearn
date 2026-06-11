# NexusLearn Master Implementation Plan

Status: Build-governing plan  
Scope: UK Years 1-7, home and school use, curriculum-mapped adaptive learning  
Product ambition: best-in-class interactive learning system for primary, transition and early secondary support

## 1. Product Mission

NexusLearn should help children master real curriculum objectives through animated, interactive learning worlds while giving parents, teachers and schools trustworthy evidence of progress.

The platform is not a single Year 4 game. The flagship creative model should be a wider Nexusverse / Wonderpath Map: a living learning universe with a personal hub, age-tuned realms, subject portals, persistent world growth, companion team, Mistake Museum, create mode and class co-op quests. The first proof slice can use a Year 4 Dino Lab biome because it is measurable, engaging and technically representative, but the full product is a Years 1-7 curriculum and learning platform across Maths, English, Science and wider foundation subjects.

## 2. Non-Negotiable Product Principles

1. Curriculum before content.
   Every activity must map to a curriculum objective, prerequisite skills, misconceptions, assessment evidence and mastery rules.

2. Learning before entertainment.
   Animation must clarify, motivate or reinforce learning. Decorative animation is allowed only when it supports attention, feedback or world persistence.

3. One engine, many worlds.
   Each year group gets a different world, tone and interaction style, but the platform should reuse shared systems: curriculum graph, activity runtime, mastery engine, rewards, accessibility, dashboards and analytics.

4. Explainable adaptation.
   The system must be able to explain why it moved a child forward, scaffolded, revised, paused or alerted an adult.

5. Safe for children by design.
   No public profiles, no open chat, no behavioural advertising, no manipulative streaks, no unnecessary data collection, high privacy defaults and clear adult controls.

6. Inclusive by default.
   Reduced motion, low-sensory mode, audio support, dyslexia-friendly options, keyboard/touch support and short-session modes must be core architecture, not later decoration.

7. Content production is a first-class product function.
   The curriculum, question banks, hints, audio scripts, interaction templates and review workflows are as important as the code.

## 3. Audience Model

### Children

Children enter a world tuned to their year group. They complete short missions, receive scaffolded feedback, build a persistent world and revisit learning through spaced practice.

### Parents and Guardians

Parents need simple progress explanations, home support recommendations, confidence signals, weekly summaries and reassurance that the platform is safe.

### Teachers

Teachers need assignment control, objective-level evidence, group views, suggested interventions, low-friction pupil login and exportable reports.

### Schools and Trusts

Schools need bulk onboarding, class/group management, safeguarding confidence, data protection controls, role-based access, reporting, MIS integration roadmap and predictable pricing.

### Platform Team

Admins need CMS tools, content QA workflows, curriculum versioning, feature flags, audit logs, asset management and content analytics.

## 4. Full Product Scope

### Year Coverage

- Year 1: Key Stage 1 foundations, phonics, early number, audio-led interface
- Year 2: KS1 consolidation, phonics, reading fluency, sentence building, SATs-style readiness
- Year 3: Lower KS2 transition, times tables, fractions, paragraphs, science/geography exploration
- Year 4: Multiplication Tables Check, fractions, area/perimeter, grammar, science systems
- Year 5: Deeper reasoning, decimals/percentages, Earth and space, longer reading and writing
- Year 6: SATs readiness, multi-step reasoning, reading inference, writing quality, transition confidence
- Year 7: Secondary bridge, algebra foundations, ratio, science labs, literature, geography/history thinking

### Flagship World Model

The world model should be bigger than "Dino-Craft". Use this structure:

- Central Nexus Hub: the child's personal learning home.
- Year Realms: age-tuned worlds for Years 1-7.
- Subject Portals: Maths, English, Science and wider curriculum missions.
- Persistent World Growth: mastery changes the world permanently.
- Companion Team: bounded learning companions with educational roles.
- Mistake Museum: repaired misconceptions become trophies.
- Create Mode: children use knowledge to build, explain and design.
- Class Co-op Quests: shared class progress without public leaderboards.

Year 4 should be reframed as **Inventor Wilds**, with Dino Lab as one biome alongside Volcano Workshop, Crystal Caves, Rainforest Canopy, River Engineering Zone and Sky Bridge Observatory.

### Subject Coverage

Phase priority:

1. Mathematics
2. English Reading
3. Phonics and Spelling
4. English Writing and Grammar
5. Science
6. Computing
7. Geography
8. History
9. Design and Technology
10. Art, Music, PSHE-style knowledge and cross-curricular projects

## 5. Product Architecture

### Shared Platform Systems

- Identity and roles
- Pupil login without email
- Parent and school accounts
- Curriculum graph
- Content CMS
- Activity runtime
- Adaptive engine
- Mastery and spaced repetition
- Rewards and inventory
- Persistent world state
- Companion memory
- Mistake Museum
- Reporting and exports
- Accessibility settings
- Event analytics
- Audit logs
- Data protection controls

### Frontend

- Next.js and TypeScript
- Shared component system
- PixiJS or Canvas for game scenes where needed
- Rive or sprite/state-machine animation for companions
- CSS/Framer-style motion for UI
- Web Audio API plus pre-generated narration
- Offline-aware asset and lesson cache

### Backend

- API service with clear domain boundaries
- PostgreSQL as source of truth
- Background jobs for reports, spaced review queue and analytics
- Object storage and CDN for assets
- Role-based access control
- Audit log and tenant separation

### Content Layer

- Versioned curriculum packs
- Objective graph
- Activity definitions
- Question banks
- Hints and explanations
- Misconception tagging
- Audio scripts
- Animation hooks
- Review state and approval workflow

## 6. Recommended Build Strategy

Build in vertical slices. Each slice must include curriculum, child experience, adaptive logic, adult reporting, accessibility and deployment. Avoid building isolated dashboards or isolated games that do not connect to learning evidence.

### Slice 0: Product Foundation and Planning

Deliverables:

- Master implementation plan
- Curriculum architecture
- Animation and UX strategy
- Data model and API specification
- Compliance checklist
- Design system direction
- Deployment architecture

Success condition:

- The team can explain what is being built, why, in what order and how quality will be measured.

### Slice 1: First Playable Proof

Scope:

- Year 4 Maths Dino-Craft
- 8-12 representative objectives
- Times tables, arrays, factor pairs, area/perimeter foundations
- Companion, world-building, feedback, mastery meter
- Parent dashboard preview
- API evidence logging

Why Year 4 first:

- It is not the whole product.
- It proves the hardest reusable systems: animated missions, adaptive maths, world persistence, objective reporting and school-device performance.

Success condition:

- Children understand and enjoy the loop.
- Adults understand the progress evidence.
- The system feels meaningfully better than a quiz.

### Slice 2: Adaptive Core and Content Engine

Scope:

- PostgreSQL schema
- Objective graph
- Content pack schema
- Activity runtime
- Mastery model v1
- Spaced review queue
- Prerequisite probing
- 40-60 Year 3-4 Maths objectives
- Real parent dashboard

Success condition:

- The app can select next activities from a curriculum graph and explain its decisions.

### Slice 3: Year 1-2 Audio and Phonics Foundation

Scope:

- Number Garden
- Storybook Kingdom
- Audio-led tasks
- Phonics blending animation
- Letter tracing workstream
- Picture-supported vocabulary
- Short-session mode
- Parent support guidance

Success condition:

- A Year 1 or Year 2 child can complete meaningful learning with minimal reading burden.

### Slice 4: School Pilot

Scope:

- School accounts
- Pupil login cards
- Classes and groups
- Teacher assignments
- Intervention groups
- CSV import
- Objective heatmaps
- Teacher recommendations
- Basic exports

Success condition:

- A teacher can set work, monitor objective gaps and group pupils for intervention.

### Slice 5: English Reading, Writing and Grammar

Scope:

- Reading passages
- Inference and retrieval questions
- Vocabulary support
- Sentence building
- Grammar missions
- Writing prompts
- Human/teacher review workflow for free writing

Success condition:

- The platform supports meaningful English learning, not just multiple-choice comprehension.

### Slice 6: Science and Wider Curriculum Worlds

Scope:

- Science simulations
- Geography maps and data
- History timelines and source tasks
- Computing logic puzzles
- Cross-curricular projects

Success condition:

- Foundation subjects enrich the worlds while staying objective-mapped.

### Slice 7: Scale, Compliance and Procurement Readiness

Scope:

- MIS integration exploration: Wonde, Groupcall or equivalent
- Multi-school trust support
- Advanced analytics
- Subscription and billing
- DPA pack
- DPIA pack
- Subprocessor list
- Accessibility audit
- Load testing

Success condition:

- The product is ready for serious school procurement conversations.

## 7. Quality Bar by Domain

### Child Experience

- First meaningful interaction within 10 seconds
- Task batches under 5 minutes for younger years
- Clear audio and visual instructions
- Feedback under 100ms
- Every incorrect answer gets a scaffold, not shame
- Progress changes the world visibly

### Learning Quality

- Objective-mapped
- Prerequisite-aware
- Misconception-aware
- Mastery over time, not one correct answer
- Spaced retrieval
- Multiple representations
- Teacher-explainable evidence

### Animation Quality

- Purposeful
- Smooth on Chromebook
- State-driven
- Sensory-adjustable
- Reusable across objectives
- Asset budgets defined before build

### Parent and Teacher Quality

- Plain-English explanations
- Objective-level progress
- Next-step recommendations
- Confidence and effort signals
- Exportable evidence
- No misleading vanity metrics

## 8. Immediate Priorities

1. Replace weak prototype UI with a stronger product-facing experience.
2. Write build-governing documentation for the full Years 1-7 product.
3. Define curriculum and content schemas.
4. Define animation pipeline and reusable interaction formats.
5. Add initial content packs for Year 4 Maths and Year 1 phonics as two contrasting examples.
6. Add real persistence and adaptive engine v1.
7. Prepare school pilot flows.

## 9. Decision: Pilot Does Not Equal Product

The first build slice can be Year 4 Maths, but all architecture must support Years 1-7 from day one. That means no hard-coded Year 4 assumptions in:

- Content schema
- Activity runtime
- Rewards model
- Accessibility settings
- Mastery model
- Dashboards
- User accounts
- Deployment architecture

The correct mental model is:

Year 4 Dino-Craft is the first proof of the engine. The engine is for the whole platform.
