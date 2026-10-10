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

## Contract requests (from Laptop B — Experience)

Change requests for the **shared** contract. Per `docs/TEAM.md`, Dev B does **not** edit core / db /
eval or the contract files (`packages/core/src/types.ts`, `docs/API.md`). Anything the Phase 1b
screens need from the shared surface is filed here for the contract owner instead.

Owner: Dev A (contract). Status: **open**. Raised during Phase 1b (screens).

### 1. `Coverage` type + `/coverage` response shape

**Why:** `docs/API.md` lists `GET /api/courses/:id/coverage` but its response is explicitly
"TBD in Phase 1b" (API.md line 27). The Coverage screen needs a stable shape.

**Current workaround (B-owned, temporary):** `apps/web/src/lib/types.ts` defines a local
`Coverage` view type, and `apps/web/src/lib/format.ts#computeCoverage` derives it from
`edges + sections + documents`. `getCoverage()` in `apps/web/src/lib/api.ts` currently returns this
derived value. This must be replaced by the real endpoint response when it lands.

**Requested contract shape** (proposed; please confirm or amend):

```ts
interface Coverage {
  courseId: string;
  /** Fraction (0..1) of professor units with a confirmed/remapped book section. */
  matchedRatio: number;
  /** Professor units with no confirmed book counterpart. */
  professorOnly: Section[];
  /** Book sections with no professor counterpart. */
  bookOnly: Section[];
}
```

Questions for the owner:

- Should `matchedRatio` count only `confirmed`/`remapped` edges (current assumption), or also
  `proposed` ones with non-null `bookSectionId`?
- Are `professorOnly` / `bookOnly` **sections** (current assumption) or ids?

### 2. `PUT /api/edges/:id` request body

**Why:** The Alignment Map confirms / rejects / remaps an edge. Please confirm the body.

**Assumed shape:**

```ts
interface UpdateEdgeBody {
  status: EdgeStatus; // 'proposed' | 'confirmed' | 'rejected' | 'remapped'
  bookSectionId?: string; // required when status === 'remapped'
}
```

Questions:

- Does `remapped` require `bookSectionId` (server should 422 otherwise)? Confirmed?
- Does `confirmed`/`rejected` ignore `bookSectionId` if sent?

### 3. `GET /api/courses/:id/sections` shape

**Assumption:** returns a **flat `Section[]`** where each item carries `documentId` + `parentId`
(the viewer builds the tree client-side via `parentId`). Please confirm it is flat and not
pre-nested. If nesting is planned, tell me the node shape and I will drop `buildSectionTree`.

### 4. `Section` has no `role` (used to classify book vs professor units)

**Observation:** `Section` carries `documentId` but not the document `role`, so the client must
join sections → documents to tell book sections from professor units (done in
`computeCoverage` and the Alignment Map remap list). This works, but if the owner prefers, a
denormalized `role` on `Section` (or including `role` in the `/sections` payload) would save a
second round-trip. Non-blocking.

### Notes

- Screens build against `packages/core/src/types.ts` (the shared contract; `api-contract.ts` is not
  present in this repo) and mock fixtures shaped to match it, because the REST endpoints and seed
  data are Dev A's Phase 1b/1c work. Toggling `VITE_USE_MOCK_API=false` switches the client to the
  real endpoints with no code change.

### Laptop B confirmation: ownership in TEAM.md

> Note: this section was written against the earlier Dev A / Dev B ownership table. `docs/TEAM.md`
> has since been replaced by the Laptop A / Laptop B version. In it, `sandbox/`, `verifier/` and
> `conflicts/` belong to Laptop B, and `problem-finder` and `handwriting-repair` belong to Laptop A
> (the reverse of the table below for those features). That version of `docs/TEAM.md` and
> `.github/CODEOWNERS` is the current source of truth; Laptop B has not yet re-confirmed it.

Status: **accepted, with the small additions below.** Raised by Laptop B (Dev B, Experience).

We accept the ownership table in `docs/TEAM.md` as written: Dev B owns `apps/web/`,
`apps/server/src/agent/` and the six B feature packages (`study-agent`, `problem-finder`,
`handwriting-repair`, `prerequisites`, `semester-tracker`, `mistake-diagnosis`). Dev A owns the
pipeline, backend routes, jobs, sandbox, `eval/`, `samples/` and the `verifier` / `conflicts`
packages. We also accept the phase split, the migration ranges (Dev B uses `200-299`) and the rule
that Dev B does not edit shared contract files directly.

Caveat: `docs/BRIEF.md` is still a placeholder, so we could not check this table against the brief's
own section numbers. This confirmation holds until the brief is pasted in; we will re-check then.

The following paths exist in the repo but have no owner in `TEAM.md` / `.github/CODEOWNERS`. Proposed
owners are suggestions for Dev A to confirm; none of these changes are made by Laptop B because they
touch shared files.

| Path                                                                                                                                                    | Problem                                                                                                  | Proposed                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `apps/server/src/{app,config,index,seed}.ts`, `apps/server/src/db/index.ts`                                                                             | Server bootstrap files are not in any row                                                                | Shared (both approve)                 |
| `apps/server/test/`, `packages/core/test/`                                                                                                              | Tests have no row                                                                                        | Follow the code they test             |
| `packages/core/src/index.ts`                                                                                                                            | Core barrel file is not listed; it re-exports contracts                                                  | Shared (both approve)                 |
| `docs/` except `API.md` (`BRIEF.md`, `ROADMAP.md`, `CLINE_USAGE.md`, `CONTRACT_REQUESTS.md`)                                                            | No owner                                                                                                 | Shared, or one owner per file         |
| Root config: `tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`, `vitest.setup.ts`, `.prettierrc`, `.nvmrc`, `.env.example`, `pnpm-lock.yaml` | TEAM.md says "root config" is shared, but CODEOWNERS lists only `package.json` and `pnpm-workspace.yaml` | Add to the shared block in CODEOWNERS |
| `README.md`                                                                                                                                             | No owner                                                                                                 | Shared                                |

Things that look wrong or unclear:

1. **Chat endpoint split.** `POST /api/courses/:id/chat` (SSE) lives under `apps/server/src/routes/`
   (Dev A), but the agent behind it lives in `apps/server/src/agent/` (Dev B). Please confirm Dev B
   may add the chat route file inside `routes/`, or name a different location for the route.
2. **Seeding.** `pnpm seed` is Dev A's Phase 1c work, but `apps/server/src/seed.ts` is unowned. We
   propose Dev A owns it.
3. **Mock provider.** `packages/core/src/providers/` (including `mock.ts`) is Dev A's, but Dev B
   builds against `LLM_PROVIDER=mock`. Dev B will request changes to the mock by issue or PR comment
   rather than editing it.
4. **CODEOWNERS handles.** `@DEV_A_GITHUB` and `@DEV_B_GITHUB` are still placeholders, so no
   ownership is enforced yet.
5. **Paths that do not exist yet.** `packages/core/src/{ingest,align}`, `apps/server/src/{jobs,routes,sandbox,agent}`,
   `eval/`, `samples/` and every `packages/features/*` package are listed but not created. This is
   expected; it only means the table has not been tested against the real tree.
6. **Migrations.** CODEOWNERS makes both developers approve every change under `db/migrations/`,
   while TEAM.md gives each developer a numbering range. We suggest keeping both approvals for now;
   no change requested.
