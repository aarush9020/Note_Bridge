# Roadmap

Status key: done / in progress / planned / cut (with reason).

| Phase | Scope                                                                   | Owner | Status  |
| ----- | ----------------------------------------------------------------------- | ----- | ------- |
| 0     | Scaffold, contracts, migration, MockProvider, server + web skeleton, CI | both  | done    |
| 1a    | Ingestion: PDF extraction, quality gate, offsets, structure, chunker    | A     | planned |
| 1b    | Retrieval, alignment, grounding (backend)                               | A     | planned |
| 1b    | Screens: Courses, Upload, Alignment Map, Viewer, Coverage               | B     | planned |
| 1c    | Eval harness, `docs/EVAL.md`, synthetic physics sample, `pnpm seed`     | A     | planned |
| 2     | Study Agent (`@cline/sdk`, falls back to MockAgent)                     | B     | planned |
| 3     | Verifier (sandbox)                                                      | A     | planned |
| 4     | Conflicts                                                               | A     | planned |
| 5     | Problem Finder                                                          | B     | planned |
| 6     | Handwriting Repair                                                      | B     | planned |
| 7     | Prerequisites                                                           | B     | planned |
| 8     | Semester Tracker, Mistake Diagnosis                                     | B     | planned |
| 9     | Stretch features, only if time remains                                  | -     | planned |

## Cuts

None yet. Any cut is recorded here with the date and reason.

## Known limitations

- Docker is not installed on the primary dev machine, so the sandbox runs as a local subprocess and
  network isolation is not enforced. A warning is logged at startup.
- The Verifier (Phase 3) is built with a mock script writer; the Docker path is untested here. See
  `docs/VERIFIER.md`.
- Real LLM providers and local embeddings are not implemented yet (Phase 1a); asking for them fails
  loudly instead of silently using the mock.
