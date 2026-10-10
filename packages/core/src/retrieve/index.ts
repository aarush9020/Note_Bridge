import type { Chunk, Citation } from '../types';

/** Interface only in Phase 0. Implemented in Phase 1b (owner: Dev A). */

export interface RetrievalQuery {
  courseId: string;
  text: string;
  /** Optional hint: restrict to these document ids. */
  documentIds?: string[];
  topK?: number;
}

export interface RetrievedChunk {
  chunk: Chunk;
  score: number;
}

export interface RetrievalResult {
  hits: RetrievedChunk[];
  /** True when evidence is too weak to answer; callers must abstain. */
  abstain: boolean;
  abstainReason?: string;
}

export interface Retriever {
  retrieve(q: RetrievalQuery): Promise<RetrievalResult>;
}

export type { Citation };
