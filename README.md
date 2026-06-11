# NexusLearn (WonderPath Learning)

UK Years 1–7 adaptive learning platform — game-quality interactive worlds, curriculum-mapped mastery, parent & school dashboards.

## Structure

- `apps/web` — Next.js 14 frontend (Vercel)
- `apps/api` — Go REST API (Render)
- `packages/content` — versioned curriculum content (JSON)
- `docs` — implementation plan & product docs

## Local development

```bash
# API
cd apps/api && go run ./cmd/server   # :8080

# Web
cd apps/web && npm install && npm run dev   # :3000
```

## Docs

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the build-governing plan.
