# NexusLearn — Structured Implementation Plan

**Working title:** NexusLearn ("WonderPath Learning")
**Scope:** UK Years 1–7 adaptive, gamified learning platform for children, parents, and schools.
**This document** is the build-governing plan. It consolidates the original Master PRD with the agreed enhancements (animation architecture, content pipeline, audio tiers, tightened MVP). The original PRD remains the product vision source; where this plan narrows scope, this plan wins for build order.

---

## 1. Product North Star

> Children should feel like they are playing, exploring and achieving — while parents and schools can clearly see that real curriculum learning is happening.

Three quality bars every slice must pass:

1. **Feels like a game, not a worksheet** — every interaction has motion, sound, and immediate feedback (<100ms response).
2. **Every activity maps to a National Curriculum objective** — with prerequisites, misconceptions, and a mastery model behind it.
3. **Runs beautifully on a school Chromebook** — 60fps target, graceful degradation, reduced-motion and low-sensory modes.

## 2. Architecture

```
nexuslearn/
├── apps/
│   ├── web/          # Next.js 14 + TypeScript + Tailwind — all UI, game worlds, dashboards
│   └── api/          # Go 1.22 — REST API, adaptive engine, mastery model
├── packages/
│   └── content/      # Curriculum content as versioned JSON (objectives, activities, questions)
├── docs/             # This plan, ADRs, content pipeline docs
└── infra/            # render.yaml, deployment config
```

**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS. Game scenes: PixiJS for world rendering; rigged SVG characters animated via CSS/JS spring physics; Framer-Motion-style micro-interactions; Web Audio API for synthesized + CC0 sound.
**Backend:** Go (chi router), PostgreSQL, JWT auth with role-based access (8 roles), layered architecture (handlers → services → repositories), migrations via golang-migrate.
**Hosting:** Vercel (web), Render (API + managed PostgreSQL).
**Audio strategy (tiered):** Produced, human-listened audio is required for child-facing narration and phonics. Years 1–2 use SSP-reviewed phoneme/word recordings and warm UK narration; companion and narrator batches may use a studio neural voice or human actor only after listening, safeguarding and accessibility approval. Every activity carries an optional `audio_url`; null shows an honest unavailable/preparation state and never silently falls back to browser TTS.

## 3. Art & Animation Strategy (no asset packs required)

Perceived quality in children's apps is ~70% motion/feedback, ~30% static art. Strategy:

| World | Visual approach |
|---|---|
| Y1 Number Garden / Letter Zoo | Flat-vector SVG characters (rigged per-part: eyes, limbs), paper-collage style backgrounds |
| Y2 Enchanted Storybook | Paper cut-out collage style, particle trails, narrated pages |
| Y3 Explorer Islands | SVG adventure map, animated boat, badge system |
| Y4 Dino-Craft | **Procedural voxel/isometric world in PixiJS** — terrain blocks, snap-grid building, fossil bursts |
| Y5 Space Engineers / Eco Cities | Futuristic dashboard UI (code's home turf), animated orbits, resource meters |
| Y6 Quest Academy | Sleek academy halls, challenge rooms, boss-battle progress |
| Y7 Future Worlds | Simulation labs, mission boards, strategy UI |

**Shared animation principles (from PRD §14):** purposeful, fast, non-blocking, skippable, sensory-adjustable, reduced-motion safe. Four rendering tiers: full → standard → low → static accessible.

**Signature engagement systems (additions to the PRD):**
1. **Persistent companion with memory** — levels up, remembers struggles, asks the child to teach it back (teach-back = retrieval practice).
2. **My World persistence** — every mastered objective adds a permanent piece to the child's island/garden/city. Children return to see their world, not their score.
3. **Mistake Museum** — defeated misconceptions become trophies ("I used to mix up 6×8 — not anymore").
4. **Class quests** — co-op (not competitive) whole-class building goals.
5. **Adaptive celebration intensity** — auto-tuned to the child's reward-intensity/sensory profile.
6. **Daily warm-up orbit** — predictable 5-minute opening ritual fed by the spaced-repetition queue (1/3/7/14/30-day intervals).

## 4. Adaptive Engine v1 (deliberately simple, explainable)

- **Mastery score 0–100 per objective** (PRD §10.3 bands kept: Not Started → Introduced → Developing → Nearly Secure → Expected → Secure/Greater Depth).
- **Elo-style update:** each question has a difficulty rating; correct answers move mastery up proportional to difficulty vs current mastery; errors move it down gently. Speed and hint usage damp the gain.
- **Mastery requires distribution over time:** cap on mastery gained per day per objective forces spaced performance (no "mastered in one sitting").
- **Back-scaffolding:** repeated failure triggers prerequisite probe — short diagnostic across the objective's prerequisite list to find the broken foundation, then routes there, then re-escalates.
- **Rules, not ML, for v1** — every decision must be explainable to a teacher in one sentence. ML comes post-data (Phase 5).

## 5. Curriculum Content Pipeline (the real cost driver)

Content lives in `packages/content` as versioned JSON, validated by schema in CI:

```
objective: { id, year, subject, strand, topic, statement, prerequisites[],
             misconceptions[], mastery_threshold, parent_explanation, teacher_notes }
lesson:    { id, objective_id, title, teaching_goal, steps[], audio_script,
             animation_hooks, accessibility_variants }
step:      { kind: concept-launch|teach|worked-example|guided-practice|repair|teach-back,
             model, prompt, narration, manipulative, scaffold }
activity:  { id, objective_id, type, difficulty, game_mechanic, prompt, audio_url,
             assets, lesson_steps[], interactions[] }
question:  { id, activity_id, format, body, options/answer, hints[], explanation,
             misconception_tags[] }
```

The platform must teach before it tests. A production objective is not complete
because it has many questions; it is complete only when it has a child-facing
teaching sequence, an animated or interactive concept model, guided practice,
misconception repair, adaptive practice variants, teach-back where appropriate
and adult reporting language. Questions provide variation and evidence, but
lessons and manipulatives carry the teaching.

Production flow: AI-drafted (objective-anchored, PRD §22 guardrails) → schema-validated → human-reviewed → published with version stamp. Interaction formats are a fixed engineering vocabulary (each is built once, reused everywhere): `tap-choice`, `drag-sort`, `drag-build`, `number-pad`, `word-build`, `trace`, `sequence`, `match-pairs`, `free-write` (marked later), `timed-recall`.

## 6. Build Slices (vertical, each ends deployed and demoable)

### Slice 1 — Walking Skeleton + First Playable (THIS BUILD)
- Monorepo, CI-ready structure, deployed to Vercel + Render.
- Go API: health, JWT auth skeleton, roles, demo endpoints.
- Beautiful public landing page (the product's face for parents/schools).
- Child entry screen (avatar tiles, PIN pad pattern).
- **Playable Year 4 Dino-Craft mission:** times-table fluency → power the dinosaur incubator. Full juice: snap interactions, particle bursts, companion reactions, XP, mastery meter, low-stress error handling ("Almost! 7 groups of 8… let's build it"), reduced-motion toggle.
- Parent progress glimpse (static-data dashboard shell).

### Slice 2 — Adaptive Core
- PostgreSQL schema v1 (identity, curriculum, progress, rewards — PRD §18 subset).
- Adaptive engine v1 + mastery model live; spaced-repetition queue; warm-up orbit.
- ~50 Year 3–4 maths objectives with full content through the pipeline.
- Real parent dashboard (progress by subject, gaps, recommendations).

### Slice 3 — School Module
- School onboarding, classes, groups, bulk CSV pupil upload, login cards (QR + PIN).
- Teacher dashboard: assignments, completion, mastery heatmap, suggested groups.
- Pupil login without email (school code + username + PIN / picture password).

### Slice 4 — Year 1–2 Storybook World
- Audio-led UX (pre-generated narration), phonics blending animation, letter tracing (canvas stroke capture), word-build, picture passwords.
- Accessibility suite completed: low-sensory mode, dyslexia font, high contrast, text size, keyboard nav.

### Slice 5 — English Reading + Reporting
- Reading comprehension formats, fluency tracking, writing tasks.
- School/SENCO reports, CSV/PDF export, intervention groups.

### Slice 6+ — Scale (PRD Phases 3–5)
- Years 5–7 worlds, science/foundation subjects, CMS, MIS integration (Wonde/GroupCall), trusts, AI-assisted content under review rules.

## 7. Compliance & Safeguarding (Phase 1 commitments)

UK GDPR + **ICO Age Appropriate Design Code**: data minimisation, high-privacy defaults, no public child profiles, no chat, no behavioural ads, no dark patterns or manipulative streaks; parent/school consent flows; audit logs; soft-delete for school records; school data export/delete controls. (PRD §20 adopted in full.)

## 8. Non-Functional Targets

API p95 < 300ms · learning screen load < 2s · interactions feel instant (<100ms feedback) · 99.5% uptime MVP · daily backups · works on Chrome/Edge/Safari, Chromebooks, tablets, whiteboards.

## 9. Acceptance Criteria

PRD §28's 18 criteria adopted verbatim as the programme-level definition of done. Each slice carries its own subset.

## 10. Decisions Log

| Decision | Choice | Why |
|---|---|---|
| Art | Code-drawn (SVG rigs + procedural PixiJS) first | £0, animatable per-part, swap-in path for commissioned art later |
| Audio | Browser TTS → Piper MP3s → ElevenLabs character voices | Narration is pre-generated; cost is pennies per content batch |
| Adaptive v1 | Rules + Elo-style mastery | Explainable to teachers; ML needs data we don't have yet |
| MVP cut | One world, maths-first, full architecture | Prove the loop; content scales after engine |
| Repo | Private monorepo | Single deploy story, shared types via content package |
