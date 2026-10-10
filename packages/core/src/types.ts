/**
 * SHARED CONTRACT - changes require a PR approved by both developers (see docs/TEAM.md).
 */

export type SourceRole = 'book' | 'slides' | 'notes';

/** How a professor unit (slide/note section) relates to a book section. */
export type Relation = 'same' | 'extends' | 'conflicts' | 'professor_only' | 'book_only';

export type EdgeStatus = 'proposed' | 'confirmed' | 'rejected' | 'remapped';

export type JobKind = 'ingest' | 'align';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Course {
  id: string;
  name: string;
  createdAt: string;
}

export interface Document {
  id: string;
  courseId: string;
  role: SourceRole;
  title: string;
  /** sha256 of file bytes; used as ingestion cache key. */
  contentHash: string;
  pageCount: number;
  /** printed page number = pdf page index + pageOffset. */
  pageOffset: number;
  createdAt: string;
}

export interface Section {
  id: string;
  documentId: string;
  parentId: string | null;
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
  summary: string | null;
}

export type ChunkKind = 'text' | 'definition' | 'example' | 'exercise' | 'formula';

export interface Chunk {
  id: string;
  documentId: string;
  sectionId: string | null;
  parentId: string | null;
  prevId: string | null;
  nextId: string | null;
  kind: ChunkKind;
  /** Text shown to the user and quoted from. */
  text: string;
  /** Context header (doc > section path) used for embeddings only, never displayed or quoted. */
  contextHeader: string;
  page: number;
  tokenCount: number;
  /** 0 (garbled) .. 1 (clean). */
  quality: number;
}

export interface Exercise {
  id: string;
  documentId: string;
  chunkId: string | null;
  label: string;
  statement: string;
  hasSolution: boolean;
  solution: string | null;
  page: number;
}

export interface Edge {
  id: string;
  courseId: string;
  profUnitId: string;
  bookSectionId: string | null;
  relation: Relation;
  /** Computed confidence 0..1 (never taken directly from the LLM). */
  confidence: number;
  rationale: string;
  status: EdgeStatus;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  page: number;
  printedPage: number;
  quote: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface JobProgress {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  /** 0..1 */
  progress: number;
  message: string;
}
