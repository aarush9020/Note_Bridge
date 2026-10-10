# Contract requests

Use this file when you need a change in a file the other laptop owns (see `docs/TEAM.md`).
Add a new entry at the top. The owner replies in the entry and moves it to "Done" when applied.

Entry format:

```
### <short title> (from Laptop A|B, YYYY-MM-DD)
- File(s): <path>
- Change wanted: <what and why>
- Status: open | done | declined (<reason>)
```

## Open

### Confirm owners of upload and job routes, `samples/`, server wiring (from Laptop A, 2026-10-10)

- File(s): `apps/server/src/routes/*` (upload, job events), `samples/**`, `apps/server/src/{app,index,config,seed}.ts`
- Change wanted: the ownership list does not name these. Laptop A is treating them as Engine
  (provisional, see `docs/TEAM.md`). Laptop B: reply here if you disagree.
- Status: open

### `docs/BRIEF.md` is still a placeholder (from Laptop A, 2026-10-10)

- File(s): `docs/BRIEF.md`
- Change wanted: the full brief has not been saved yet, so Phase 1a was built from the plan in
  conversation rather than from Section 7. Paste the brief so it can be checked against the code.
- Status: open

### FYI for Laptop B: Phase 1a changes to shared files (from Laptop A, 2026-10-10)

- `packages/core/src/providers/llm.ts`: `LLMProvider` gained an optional `vision()` method (used for
  scanned pages and handwritten notes). `MockProvider` implements it. No existing caller breaks.
- `apps/server/src/db/migrations/002_ingest.sql`: new columns on `documents` (status, warnings,
  page_quality, ...), `sections`/`chunks` (ordinal, exception) and `jobs` (document_id, error).
  `types.ts` was NOT changed, so these are not on the shared types yet. If the UI needs
  `warnings` or per-page quality, ask here and Laptop A will add them to `types.ts` and the API.
- Root files: `pnpm-lock.yaml` changed (new dependencies `pdfjs-dist`, `pdf-lib`,
  `@fastify/multipart`). Run `pnpm install` after pulling.
- New routes: see "Implemented (Phase 1a)" in `docs/API.md`.
- Status: open (read and reply when seen)

## Done

_(none yet)_
