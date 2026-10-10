# Verifier and code sandbox (Phase 3)

Status: implemented with a **mock script writer**. Written on Laptop B. In the current
`docs/TEAM.md` and `.github/CODEOWNERS`, `apps/server/src/sandbox/` and
`packages/features/verifier/` belong to Laptop B. (`docs/ROADMAP.md` still lists Phase 3 under owner
A; that row has not been reconciled.) `docs/BRIEF.md` was still a placeholder when this was built,
so Section 10-B could not be checked. The result shape below is an **assumption** and is proposed
for the shared contract (Laptop A to confirm or amend).

## Sandbox (`apps/server/src/sandbox/`)

| Rule           | Behaviour                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Interpreters   | Exactly `python3` and `node`. Anything else is rejected with `disallowed_interpreter` before a process is spawned.     |
| Temp directory | Code is written to a fresh `gyan-sandbox-*` directory, which is the working directory and is deleted afterwards.       |
| Timeout        | 10 s ceiling. A caller may ask for less, never more. The whole process tree is killed.                                 |
| Output cap     | 10 KB for stdout + stderr combined. At the cap the process is killed and the result has `truncated: true`.             |
| Environment    | Stripped to an allowlist (`PATH`, plus `SystemRoot`, `TEMP`, ... on Windows). No API keys or other server variables.   |
| Docker         | `docker run --rm --network none --read-only --cap-drop ALL` with memory, CPU and pid limits, when Docker is available. |
| No Docker      | Runs as a local subprocess and logs a warning once. Network and filesystem isolation are **not** enforced.             |
| `SANDBOX_MODE` | `auto` (Docker if present, else local), `docker` (fail loudly if absent), `local` (always local).                      |

Cross-platform process handling: no shell is used. On Windows the tree is killed with
`taskkill /PID <pid> /T /F`; on POSIX the child runs in its own process group and the group is
signalled. `python3` falls back to `python` on Windows when `python3` does not exist.

## Verifier (`packages/features/verifier/`)

`POST /api/plugins/verifier/verify` with `{ claim, expected, language? }` returns one of:

```ts
type VerifyResult =
  | { status: 'verified'; claim; expected; actual; ran }
  | { status: 'mismatch'; claim; expected; actual; diff: DiffLine[]; ran }
  | { status: 'error'; claim; reason; message; stderr? };
// ran = { language: 'python3' | 'node'; code; durationMs; mode: 'docker' | 'local' }
// DiffLine = { kind: 'same' | 'removed' | 'added'; text }
// reason = invalid_request | no_script | sandbox_unavailable | sandbox_error | timeout
//        | output_limit | script_failed
```

The script-writing step is a `ScriptWriter`. `MockScriptWriter` returns canned scripts and fails with
`no_script` for a claim it does not know; the real agent replaces it later. The server injects the
sandbox into the plugin (`attachSandbox`), so the feature package never spawns processes and
`PluginContext` is unchanged.

Questions for Dev A:

- Is `status` / `reason` the right vocabulary, and should this type move to `packages/core/src/types.ts`?
- Should a single number match within a relative tolerance of `1e-9` (current assumption)?

## Badge (`apps/web/`)

`<VerifiedBadge result={...} />` (`src/components/VerifiedBadge.tsx`) shows "Verified by running code",
a mismatch diff, or a neutral "Could not verify". Its logic is the pure `toBadgeModel()` in
`src/lib/verify.ts`. The web app keeps a type mirror in `src/lib/verifyTypes.ts` until the type is in
`@gyan/core`.

## Not covered

- Docker mode is untested on this machine (Docker is not installed). Only the argument builder and
  the mode selection are tested, with an injected detector.
- Local mode does not isolate the network or the filesystem; a script can still read files the
  server user can read.
