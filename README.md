# Gyan Setu

Bridge between a professor's slides/notes and the course textbook: aligns them, flags conflicts,
and answers study questions with verified citations. Runs fully offline in mock mode (no API key).

## Quick start

Requires Node 22+ and pnpm (`npm i -g pnpm` or `corepack enable`).

```bash
pnpm install
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
pnpm dev                 # server http://127.0.0.1:3001, web http://localhost:5173
```

With no key set, `LLM_PROVIDER=mock` and `EMBEDDINGS_PROVIDER=mock` are used. Put real keys only in
`.env` (git-ignored); they are never logged.

## Scripts

| Command          | What it does                                        |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Start server and web app                            |
| `pnpm typecheck` | TypeScript check in every package                   |
| `pnpm lint`      | ESLint                                              |
| `pnpm format`    | Prettier (write); `pnpm format:check` to check      |
| `pnpm test`      | Vitest (always uses mock providers)                 |
| `pnpm seed`      | Load the sample course (placeholder until Phase 1c) |

## Layout

- `apps/server` - Fastify API, SQLite (better-sqlite3), plugin loader
- `apps/web` - Vite + React + Tailwind
- `packages/core` - shared types, config, providers, vector index, plugin contract
- `packages/features/*` - feature plugins (added from Phase 2)
- `docs/` - see `TEAM.md`, `API.md`, `ROADMAP.md`, `CLINE_USAGE.md`

Two developers work on this through GitHub: read `docs/TEAM.md` first.
