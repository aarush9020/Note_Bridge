/**
 * Re-export the shared contract types so screens have a single import site.
 * Types come from `@gyan/core` (the agreed contract in packages/core/src/types.ts).
 *
 * NOTE: `Coverage` is NOT part of the core contract yet — the `/coverage` response shape is
 * still "TBD in Phase 1b" (docs/API.md). The temporary view type below is filed as a request
 * in docs/CONTRACT_REQUESTS.md and must be replaced once Dev A lands the real shape.
 */
import type {
  Course,
  Document,
  Section,
  Chunk,
  Exercise,
  Edge,
  Citation,
  Usage,
  JobProgress,
  SourceRole,
  Relation,
  EdgeStatus,
  JobKind,
  JobStatus,
} from '@gyan/core';

export type {
  Course,
  Document,
  Section,
  Chunk,
  Exercise,
  Edge,
  Citation,
  Usage,
  JobProgress,
  SourceRole,
  Relation,
  EdgeStatus,
  JobKind,
  JobStatus,
};

/** A professor unit (slide/note section) paired with its matched book section, for the Viewer. */
export interface MatchPair {
  edge: Edge;
  profSection: Section;
  bookSection: Section | null;
}

/**
 * TEMPORARY view type for the Coverage screen. Not in the core contract yet.
 * Filed in docs/CONTRACT_REQUESTS.md; remove once the contract defines it.
 */
export interface Coverage {
  courseId: string;
  /** Fraction (0..1) of professor units that have at least one confirmed/remapped book section. */
  matchedRatio: number;
  /** Professor units with no book counterpart. */
  professorOnly: Section[];
  /** Book sections with no professor counterpart. */
  bookOnly: Section[];
}
