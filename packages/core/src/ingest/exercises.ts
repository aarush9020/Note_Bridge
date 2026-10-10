import { createHash } from 'node:crypto';
import { EXERCISE_START, INLINE_SOLUTION, SOLUTION_START } from './patterns';
import type { ChunkDraft, ExerciseDraft } from './types';

/**
 * Pull exercises out of chunks and pair each with its solution when one exists.
 * Solutions may be inline ("Exercise 2.3 ... Solution: ...") or separate chunks that start with
 * "Solution" / "Solution to Exercise 2.3" (anywhere in the same document).
 * An exercise with no solution keeps `hasSolution = false`; we never invent one.
 */
export function extractExercises(documentId: string, chunks: ChunkDraft[]): ExerciseDraft[] {
  // Solutions that name an exercise number.
  const byKey = new Map<string, string>();
  const unnumbered: Array<{ idx: number; text: string }> = [];
  chunks.forEach((c, idx) => {
    if (c.kind !== 'text' || !/^solution\b/i.test(c.text)) return;
    const m = c.text.match(SOLUTION_START);
    const body = c.text.slice(m?.[0].length ?? 0).trim();
    if (m?.[1]) {
      if (!byKey.has(m[1])) byKey.set(m[1], body);
    } else {
      unnumbered.push({ idx, text: body });
    }
  });

  const out: ExerciseDraft[] = [];
  chunks.forEach((c, idx) => {
    if (c.kind !== 'exercise') return;
    const m = c.text.match(EXERCISE_START);
    if (!m?.[1]) return;
    const key = m[1];
    const label = `Exercise ${key}`;
    let statement = c.text.slice(m[0].length).trim();
    let solution: string | null = null;

    const inline = statement.match(INLINE_SOLUTION);
    if (inline && inline.index !== undefined) {
      solution = statement.slice(inline.index + inline[0].length).trim() || null;
      statement = statement.slice(0, inline.index).trim();
    }
    if (!solution) solution = byKey.get(key) ?? null;
    if (!solution) {
      // An unnumbered "Solution" chunk directly after the exercise belongs to it.
      const next = unnumbered.find((u) => u.idx === idx + 1);
      if (next) solution = next.text || null;
    }

    out.push({
      id:
        'ex_' +
        createHash('sha1').update(`${documentId}|${key}|${statement}`).digest('hex').slice(0, 16),
      chunkId: c.id,
      label,
      key,
      statement,
      hasSolution: solution !== null,
      solution,
      page: c.page,
    });
  });
  return out;
}
