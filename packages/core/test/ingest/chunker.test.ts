import { describe, expect, it } from 'vitest';
import { buildStructure, chunkDocument, countTokens } from '../../src';
import { longSection, makePage, prose, run } from './helpers';

describe('chunkDocument sizes and kinds', () => {
  it('keeps normal text chunks within 200-400 tokens', () => {
    const { chunks } = run(longSection());
    const normal = chunks.filter((c) => c.kind === 'text' && !c.exception);
    expect(normal.length).toBeGreaterThan(0);
    for (const c of normal) {
      expect(c.tokenCount).toBeGreaterThanOrEqual(200);
      expect(c.tokenCount).toBeLessThanOrEqual(400);
    }
  });

  it('marks undersized chunks with a documented exception instead of hiding them', () => {
    const { chunks } = run([
      makePage(1, [{ text: '1 Tiny', size: 20 }, 'Short note about force.']),
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.exception).toBe('short');
  });

  it('emits definitions and examples as their own whole chunks', () => {
    const { chunks } = run(longSection());
    const def = chunks.find((c) => c.kind === 'definition')!;
    const ex = chunks.find((c) => c.kind === 'example')!;
    expect(def.text).toBe('Definition. Velocity is the rate of change of position with time.');
    expect(ex.text.startsWith('Example 1.')).toBe(true);
    expect(chunks.filter((c) => c.text.includes('rate of change of position')).length).toBe(1);
  });

  it('keeps an oversize definition whole and flags it', () => {
    const big = `Definition. ${prose(40, 'z')}`;
    const { chunks } = run([makePage(1, [{ text: '1 Big', size: 20 }, big])]);
    const defs = chunks.filter((c) => c.kind === 'definition');
    expect(defs).toHaveLength(1);
    expect(defs[0]!.exception).toBe('oversize');
    expect(defs[0]!.tokenCount).toBeGreaterThan(400);
  });

  it('honours custom token limits', () => {
    const pages = [makePage(1, [{ text: '1 Intro', size: 20 }, prose(12)])];
    const { sections } = buildStructure({ pages, outline: [], role: 'book', docTitle: 'B' });
    const chunks = chunkDocument(
      { documentId: 'd', docTitle: 'B', pages, sections },
      { minTokens: 20, maxTokens: 60 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(60);
  });

  it('countTokens grows with length', () => {
    expect(countTokens('a b c')).toBeLessThan(countTokens(prose(5)));
    expect(countTokens('')).toBe(0);
  });
});
