import type { SourceRole } from '../types';
import type { ChunkOptions } from './chunker';

/**
 * Per-source-type tweaks. Books use the default 200-400 token chunks. Slides and notes are
 * terse, so a much lower minimum avoids gluing unrelated slides together (chunks never cross a
 * section boundary anyway, and each slide is its own section).
 */
export interface SourceAdapter {
  chunk: ChunkOptions;
  /** Detect printed page numbers? Only meaningful for books. */
  fitOffsets: boolean;
  /** Pull out exercises? */
  exercises: boolean;
}

export function adapterFor(role: SourceRole): SourceAdapter {
  switch (role) {
    case 'book':
      return { chunk: { minTokens: 200, maxTokens: 400 }, fitOffsets: true, exercises: true };
    case 'slides':
      return { chunk: { minTokens: 20, maxTokens: 400 }, fitOffsets: false, exercises: true };
    case 'notes':
      return { chunk: { minTokens: 40, maxTokens: 400 }, fitOffsets: false, exercises: true };
  }
}
