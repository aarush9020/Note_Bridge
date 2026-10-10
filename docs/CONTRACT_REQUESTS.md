# Contract requests (from Laptop B — Experience)

Change requests for the **shared** contract. Per `docs/TEAM.md`, Dev B does **not** edit core / db /
eval or the contract files (`packages/core/src/types.ts`, `docs/API.md`). Anything the Phase 1b
screens need from the shared surface is filed here for the contract owner instead.

Owner: Dev A (contract). Status: **open**. Raised during Phase 1b (screens).

## 1. `Coverage` type + `/coverage` response shape

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

## 2. `PUT /api/edges/:id` request body

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

## 3. `GET /api/courses/:id/sections` shape

**Assumption:** returns a **flat `Section[]`** where each item carries `documentId` + `parentId`
(the viewer builds the tree client-side via `parentId`). Please confirm it is flat and not
pre-nested. If nesting is planned, tell me the node shape and I will drop `buildSectionTree`.

## 4. `Section` has no `role` (used to classify book vs professor units)

**Observation:** `Section` carries `documentId` but not the document `role`, so the client must
join sections → documents to tell book sections from professor units (done in
`computeCoverage` and the Alignment Map remap list). This works, but if the owner prefers, a
denormalized `role` on `Section` (or including `role` in the `/sections` payload) would save a
second round-trip. Non-blocking.

## Notes

- Screens build against `packages/core/src/types.ts` (the shared contract; `api-contract.ts` is not
  present in this repo) and mock fixtures shaped to match it, because the REST endpoints and seed
  data are Dev A's Phase 1b/1c work. Toggling `VITE_USE_MOCK_API=false` switches the client to the
  real endpoints with no code change.
