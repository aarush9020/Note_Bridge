# API contract (draft, shared between Dev A and Dev B)

This is the agreed shape of the REST and SSE API. Types live in `packages/core/src/types.ts`.
Changing this file needs approval from both developers. Endpoints marked _planned_ are not
implemented yet; Dev B can mock them in the web app until they land.

## Implemented (Phase 0)

| Method | Path                               | Response                                                     |
| ------ | ---------------------------------- | ------------------------------------------------------------ |
| GET    | `/api/health`                      | `{ ok, llmProvider, embeddingsProvider, plugins: string[] }` |
| GET    | `/api/config`                      | Effective config with secrets replaced by `***redacted***`   |
| any    | `/api/plugins/<plugin id>/<route>` | Routes returned by a plugin's `register()`                   |

## Planned

| Method | Path                         | Purpose                                           | Body / response              |
| ------ | ---------------------------- | ------------------------------------------------- | ---------------------------- |
| GET    | `/api/courses`               | List courses                                      | `Course[]`                   |
| POST   | `/api/courses`               | Create course                                     | `{ name }` -> `Course`       |
| POST   | `/api/courses/:id/documents` | Upload a file (multipart) with `role`             | -> `{ document, jobId }`     |
| GET    | `/api/courses/:id/documents` | List documents                                    | `Document[]`                 |
| GET    | `/api/courses/:id/sections`  | Section tree for all documents                    | `Section[]`                  |
| POST   | `/api/courses/:id/align`     | Start alignment                                   | -> `{ jobId }`               |
| GET    | `/api/courses/:id/edges`     | Alignment edges                                   | `Edge[]`                     |
| PUT    | `/api/edges/:id`             | Confirm / reject / remap an edge                  | `{ status, bookSectionId? }` |
| GET    | `/api/courses/:id/coverage`  | Coverage and `professor_only` / `book_only` lists | _TBD in Phase 1b_            |
| GET    | `/api/jobs/:id/events`       | **SSE** progress stream                           | events below                 |
| POST   | `/api/courses/:id/chat`      | **SSE** study-agent stream                        | events below                 |

## SSE events

Progress stream (`/api/jobs/:id/events`): each message is a JSON `JobProgress`.

Chat stream: `text` (delta string), `tool-started`, `tool-finished`, `usage` (`Usage`), `done`,
`error`. Final answers carry `Citation[]` and a computed `confidence`.

## Error shape

`{ "error": { "code": "string", "message": "human readable" } }` with a matching HTTP status.
