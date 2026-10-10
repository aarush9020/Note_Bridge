import type { ChunkKind } from '../types';

/** Internal ingestion types. The shared, persisted shapes live in ../types.ts. */

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestError';
  }
}

/** One visual line of text on a page. */
export interface Line {
  text: string;
  x: number;
  /** PDF coordinates: larger y is higher on the page. */
  y: number;
  /** Font size in points. */
  size: number;
  /** True when a larger-than-normal vertical gap precedes this line (paragraph break). */
  gapBefore: boolean;
}

/** A page of extracted text. `page` is the 1-based PDF page index. */
export interface PageText {
  page: number;
  width: number;
  height: number;
  lines: Line[];
  /** Lines joined by newline. */
  text: string;
  hasImages: boolean;
}

export interface OutlineItem {
  title: string;
  /** 1-based PDF page, or null if the destination could not be resolved. */
  page: number | null;
  children: OutlineItem[];
}

export type HeadingSource = 'outline' | 'heuristic' | 'slides' | 'single';

export interface SectionDraft {
  index: number;
  parentIndex: number | null;
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
  /** Where this section's body starts. */
  anchor: { page: number; line: number };
  source: HeadingSource;
}

/**
 * - short: fewer than the minimum tokens (tiny section, or a short run beside a definition).
 * - oversize: a definition/example/exercise kept whole even though it exceeds the maximum.
 */
export type ChunkException = 'short' | 'oversize';

export interface ChunkDraft {
  id: string;
  sectionIndex: number;
  kind: ChunkKind;
  /** Display and quote text. Never contains the context header. */
  text: string;
  /** Used for embeddings only. */
  contextHeader: string;
  page: number;
  tokenCount: number;
  quality: number;
  /** First chunk of the same section; null for that first chunk itself. */
  parentId: string | null;
  prevId: string | null;
  nextId: string | null;
  exception?: ChunkException;
}

export interface ExerciseDraft {
  id: string;
  chunkId: string;
  label: string;
  /** Number part of the label, e.g. "2.3". Used to match solutions. */
  key: string;
  statement: string;
  hasSolution: boolean;
  solution: string | null;
  page: number;
}

export type PageVerdict = 'ok' | 'vision' | 'reject';

export interface PageQuality {
  page: number;
  /** 0 (garbled) .. 1 (clean). */
  score: number;
  verdict: PageVerdict;
  reasons: string[];
  formulaHeavy: boolean;
  scanned: boolean;
}

export interface Progress {
  stage: string;
  /** 0..1, never decreases within one run. */
  progress: number;
  message: string;
}

export type ProgressFn = (p: Progress) => void;
