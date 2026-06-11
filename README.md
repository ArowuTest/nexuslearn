# NexusLearn / WonderPath Learning

NexusLearn is a planned UK Years 1-7 adaptive learning platform for children, parents and schools.
The product goal is to combine curriculum-mapped mastery, animated learning worlds, explainable
adaptation, accessibility and clear adult reporting.

This repository currently contains the early web/API scaffold and the build-governing product
documentation. The current playable mission is a Year 4 Dino-Craft proof slice, but the platform
is explicitly planned for Years 1-7 across Maths, English, phonics, writing, science and wider
curriculum subjects.

## Current Apps

- `apps/web` - Next.js frontend for child worlds and dashboards
- `apps/api` - Go API scaffold for learning evidence and demo mission endpoints
- `docs` - product, curriculum, animation and implementation plans

## Key Planning Documents

- `docs/MASTER_IMPLEMENTATION_PLAN.md`
- `docs/FLAGSHIP_EXPERIENCE_VISION.md`
- `docs/CURRICULUM_AND_CONTENT_STRATEGY.md`
- `docs/ANIMATION_UX_AND_ACCESSIBILITY_STRATEGY.md`
- `docs/IMPLEMENTATION_PLAN.md`

## Local Development

```bash
cd apps/api
go run ./cmd/server
```

```bash
cd apps/web
npm install
npm run dev
```

## Product Framing

The flagship direction is the Nexusverse / Wonderpath Map: a personal hub, age-tuned realms,
subject portals, persistent world growth, companion team, Mistake Museum, create mode and class
co-op quests. Year 4 Inventor Wilds and its Dino Lab biome are the first proof of the engine, not
the whole product. All architecture should remain year-agnostic and subject-agnostic:

- curriculum graph
- activity runtime
- mastery engine
- world state
- companion logic
- accessibility settings
- reporting
- school model

## Deployment Targets

- Frontend: Vercel
- API: Render
- Database: PostgreSQL on Render or equivalent managed Postgres
- Assets: object storage and CDN in later slices

## Token Safety

Do not commit API tokens, deployment tokens or personal access tokens. Use provider dashboards or
temporary local environment variables only.
