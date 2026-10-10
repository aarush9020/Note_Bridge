import { describe, expect, it } from 'vitest';
import { buildStructure, chunkDocument, extractExercises, type ChunkDraft } from '../../src';
import { makePage } from './helpers';

function chunksFor(lines: string[], role: 'book' | 'notes' = 'book'): ChunkDraft[] {
  const pages = [makePage(1, [{ text: '1 Practice', size: 20 }, ...lines])];
  const { sections } = buildStructure({ pages, outline: [], role, docTitle: 'B' });
  return chunkDocument(
    { documentId: 'd1', docTitle: 'B', pages, sections },
    { minTokens: 5, maxTokens: 400 },
  );
}

describe('extractExercises', () => {
  it('detects exercises and their labels', () => {
    const ex = extractExercises(
      'd1',
      chunksFor([
        'Exercise 1.1 A cart moves at 4 m/s for 3 s. Find the displacement.',
        'Exercise 1.2 A ball falls for 2 s. Find its final speed.',
      ]),
    );
    expect(ex.map((e) => e.label)).toEqual(['Exercise 1.1', 'Exercise 1.2']);
    expect(ex[0]!.statement).toBe('A cart moves at 4 m/s for 3 s. Find the displacement.');
    expect(ex[0]!.page).toBe(1);
  });

  it('matches a separate "Solution to Exercise N" chunk by number', () => {
    const ex = extractExercises(
      'd1',
      chunksFor([
        'Exercise 1.1 A cart moves at 4 m/s for 3 s. Find the displacement.',
        'Exercise 1.2 A ball falls for 2 s. Find its final speed.',
        'Solution to Exercise 1.2: v = g t = 9.8 x 2 = 19.6 m/s.',
      ]),
    );
    const e11 = ex.find((e) => e.key === '1.1')!;
    const e12 = ex.find((e) => e.key === '1.2')!;
    expect(e12.hasSolution).toBe(true);
    expect(e12.solution).toBe('v = g t = 9.8 x 2 = 19.6 m/s.');
    expect(e11.hasSolution).toBe(false);
    expect(e11.solution).toBeNull();
  });

  it('reads an inline solution out of the statement', () => {
    const ex = extractExercises('d1', chunksFor(['Exercise 1.1 Find 2 + 2. Solution: 4.']));
    expect(ex[0]!.statement).toBe('Find 2 + 2.');
    expect(ex[0]!.solution).toBe('4.');
    expect(ex[0]!.hasSolution).toBe(true);
  });

  it('pairs an unnumbered solution that directly follows the exercise', () => {
    const ex = extractExercises('d1', chunksFor(['Exercise 1.1 Find 3 + 3.', 'Solution: 6.']));
    expect(ex[0]!.hasSolution).toBe(true);
    expect(ex[0]!.solution).toBe('6.');
  });

  it('never invents a solution for an exercise that has none', () => {
    const ex = extractExercises(
      'd1',
      chunksFor(['Exercise 3.4 Prove that momentum is conserved.']),
    );
    expect(ex).toHaveLength(1);
    expect(ex[0]!.hasSolution).toBe(false);
    expect(ex[0]!.solution).toBeNull();
  });

  it('links each exercise to its chunk and gives stable ids', () => {
    const chunks = chunksFor(['Exercise 1.1 Find 3 + 3.']);
    const a = extractExercises('d1', chunks);
    const b = extractExercises('d1', chunks);
    expect(a[0]!.chunkId).toBe(chunks.find((c) => c.kind === 'exercise')!.id);
    expect(a[0]!.id).toBe(b[0]!.id);
    expect(extractExercises('d2', chunks)[0]!.id).not.toBe(a[0]!.id);
  });

  it('returns nothing when there are no exercises', () => {
    expect(extractExercises('d1', chunksFor(['Plain explanatory text about force.']))).toEqual([]);
  });
});
