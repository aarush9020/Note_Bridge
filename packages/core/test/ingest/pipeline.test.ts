import { describe, expect, it } from 'vitest';
import { contentHash, ingestDocument } from '../../src';
import { bookBytes, embeddings, ingestInput } from './pipeline-fixtures';

describe('ingestDocument (book PDF)', () => {
  it('produces sections, chunks, exercises and one embedding per chunk', async () => {
    const result = await ingestDocument(ingestInput(await bookBytes()));
    expect(result.pageCount).toBe(3);
    expect(result.headingSource).toBe('heuristic');
    expect(result.sections.map((s) => s.title)).toEqual([
      '1 Kinematics',
      '1.1 Velocity',
      '1.2 Acceleration',
      '2 Newton Laws',
      '2.1 Second law',
    ]);
    expect(result.chunks.length).toBeGreaterThan(3);
    expect(result.embeddings).toHaveLength(result.chunks.length);
    expect(result.embeddings[0]).toHaveLength(64);
    expect(result.embeddingModel).toBe('mock-embeddings');

    expect(result.exercises.map((e) => [e.label, e.hasSolution])).toEqual([
      ['Exercise 1.1', false],
      ['Exercise 1.2', true],
    ]);
    expect(result.exercises[1]!.solution).toBe('v = g t = 19.6 m/s.');
  });

  it('fits the printed page offset from the footers', async () => {
    const result = await ingestDocument(ingestInput(await bookBytes()));
    expect(result.pageOffset).toBe(11);
    expect(result.offset.confidence).toBeGreaterThan(0.3);
  });

  it('reports the content hash of the bytes', async () => {
    const bytes = await bookBytes();
    expect((await ingestDocument(ingestInput(bytes))).contentHash).toBe(contentHash(bytes));
  });

  it('reports progress that only goes up and ends at 1', async () => {
    const seen: number[] = [];
    const stages = new Set<string>();
    await ingestDocument(
      ingestInput(await bookBytes(), {
        onProgress: (p) => {
          seen.push(p.progress);
          stages.add(p.stage);
        },
      }),
    );
    expect(seen.length).toBeGreaterThan(5);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
    expect(seen[seen.length - 1]).toBe(1);
    for (const s of ['extract', 'quality', 'structure', 'chunk', 'summaries', 'embed', 'done']) {
      expect(stages.has(s)).toBe(true);
    }
  });

  it('is deterministic: same bytes give the same chunk ids and embeddings', async () => {
    const bytes = await bookBytes();
    const a = await ingestDocument(ingestInput(bytes));
    const b = await ingestDocument(ingestInput(bytes));
    expect(b.chunks.map((c) => c.id)).toEqual(a.chunks.map((c) => c.id));
    expect(b.embeddings).toEqual(a.embeddings);
  });

  it('keeps context headers out of displayed text but includes them when embedding', async () => {
    const result = await ingestDocument(ingestInput(await bookBytes()));
    for (const c of result.chunks) expect(c.text).not.toContain('Physics >');
    const first = result.chunks[0]!;
    const [plain, withHeader] = await embeddings.embed([
      first.text,
      `${first.contextHeader}\n${first.text}`,
    ]);
    expect(result.embeddings[0]).toEqual(withHeader);
    expect(result.embeddings[0]).not.toEqual(plain);
  });
});
