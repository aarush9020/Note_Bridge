import type { Chunk, Citation } from '../types';

/** Interface only in Phase 0. Implemented in Phase 1b (owner: Dev A). */

export interface GroundedAnswer {
  text: string;
  citations: Citation[];
  /** Computed (not LLM-reported) confidence, 0..1. */
  confidence: number;
  abstained: boolean;
}

export interface Grounder {
  /** True only if `quote` appears verbatim (after whitespace normalisation) in the chunk text. */
  verifyQuote(chunk: Chunk, quote: string): boolean;
  /** Reject or repair answers that cite chunks/pages that were not retrieved. */
  validateAnswer(answer: GroundedAnswer, retrieved: Chunk[]): GroundedAnswer;
}
