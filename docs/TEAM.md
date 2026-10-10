# Team workflow (two developers, two laptops, GitHub)

## Ownership

| Area                                               | Owner     | Paths                                                                                                                                                                                |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pipeline / backend                                 | **Dev A** | `packages/core/src/{ingest,retrieve,ground,align,providers}`, `apps/server/src/{db/repositories,jobs,routes,sandbox}`, `eval/`, `samples/`, `packages/features/{verifier,conflicts}` |
| Product / agent / UI                               | **Dev B** | `apps/web/`, `apps/server/src/agent/`, `packages/features/{study-agent,problem-finder,handwriting-repair,prerequisites,semester-tracker,mistake-diagnosis}`                          |
| **Shared contracts** (PR must be approved by both) | Dev A + B | `packages/core/src/{types,plugin,vector,config-schema}.ts`, `apps/server/src/db/migrations/`, `apps/server/src/plugins/loader.ts`, `docs/API.md`, root config, `.github/`            |

`.github/CODEOWNERS` encodes this table. Replace the placeholder handles `@DEV_A_GITHUB` and
`@DEV_B_GITHUB` with the real GitHub usernames, then turn on "Require review from Code Owners".

## Phase split

- **Dev A:** Phase 1a (ingestion), 1b backend (retrieval, alignment, grounding), 1c (eval + seed), Verifier sandbox, Conflicts.
- **Dev B:** Phase 1b screens (Courses, Upload, Alignment Map, Viewer, Coverage), then Study Agent, Problem Finder, Handwriting Repair, Prerequisites, Semester Tracker, Mistake Diagnosis.

Dev B builds against the contracts in `packages/core/src/types.ts` and `docs/API.md` using
`LLM_PROVIDER=mock` and seeded data, so neither person waits on the other.

## Rules

1. `main` is protected. Work on a branch (`a/feat-chunker`, `b/feat-viewer`) and merge by squash PR.
2. Commit messages use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
3. CI (typecheck, lint, format check, test) must pass before merge. Run `pnpm typecheck && pnpm lint && pnpm test` first.
4. Never commit `.env` or any key. Real keys live only in your local `.env` (git-ignored).
5. A feature package never imports another feature package. It talks to core through `PluginContext`.
6. Changing a shared contract: open a PR titled `contract: ...` and say what breaks. Both approve.

### Migrations

Migrations are append-only and numbered. Never edit an applied migration; add a new one.
To avoid number clashes: Dev A uses `001-199`, Dev B uses `200-299`.

### Lockfile conflicts

If `pnpm-lock.yaml` conflicts: take `main`'s version (`git checkout --theirs pnpm-lock.yaml` while
rebasing, or `git checkout origin/main -- pnpm-lock.yaml`), then run `pnpm install` and commit.

### Panel registry

A feature adds one line to `apps/web/src/features/registry.ts` (Dev B owns this file).

## First-time setup on the second laptop

```bash
git clone <repo-url>
cd <repo>
node -v            # 22 or newer
npm i -g pnpm      # or: corepack enable
pnpm install
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
pnpm test
pnpm dev                 # server :3001, web :5173
```

`pnpm seed` loads the sample course once Phase 1c lands.

## Linking this repo to GitHub (one person, once)

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Then: Settings > Branches > protect `main` (require PR, require CI, require code owner review), and
Settings > Collaborators > add the second developer.
