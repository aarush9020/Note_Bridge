import { describe, expect, it } from 'vitest';
import { IngestError, MockProvider, ingestDocument } from '../../src';
import { TINY_PNG, buildPdf, prose } from './helpers';
import { ingestInput } from './pipeline-fixtures';

const scannedSecondPage = () =>
  buildPdf([
    { paras: [{ text: '1 Intro', size: 20 }, { text: prose(8) }] },
    { paras: [], image: true },
  ]);

describe('ingestDocument (edge cases)', () => {
  it('fails clearly when no page is readable', async () => {
    const blank = await buildPdf([{ paras: [] }, { paras: [] }]);
    await expect(ingestDocument(ingestInput(blank))).rejects.toThrow(/No readable text/);
    await expect(ingestDocument(ingestInput(blank))).rejects.toBeInstanceOf(IngestError);
  });

  it('skips a scanned page with a warning when no page renderer is available', async () => {
    const result = await ingestDocument(ingestInput(await scannedSecondPage()));
    expect(result.warnings.join(' ')).toMatch(/Page 2 needs vision/);
    expect(result.pageQuality.find((q) => q.page === 2)!.verdict).toBe('reject');
  });

  it('reads a scanned page through the vision fallback when a renderer exists', async () => {
    const llm = new MockProvider().whenImage(
      TINY_PNG,
      'Newton second law states that the net force equals mass times acceleration of the object.',
    );
    const result = await ingestDocument(
      ingestInput(await scannedSecondPage(), { llm, renderPage: async () => TINY_PNG }),
    );
    expect(result.pageQuality.find((q) => q.page === 2)!.verdict).toBe('ok');
    expect(result.chunks.map((c) => c.text).join(' ')).toContain('net force equals mass');
  });

  it('warns when printed page numbers cannot be detected', async () => {
    const bytes = await buildPdf([{ paras: [{ text: '1 Intro', size: 20 }, { text: prose(8) }] }]);
    const result = await ingestDocument(ingestInput(bytes));
    expect(result.pageOffset).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/printed page numbers/);
  });
});

describe('ingestDocument (slides and notes)', () => {
  it('makes one section per slide and does not fit book page offsets', async () => {
    const bytes = await buildPdf([
      {
        paras: [
          { text: 'Velocity', size: 24 },
          { text: 'v = dx/dt, the rate of change of position.' },
        ],
      },
      {
        paras: [
          { text: 'Newton Second Law', size: 24 },
          { text: 'F = m a, force equals mass times acceleration.' },
        ],
      },
    ]);
    const result = await ingestDocument(ingestInput(bytes, { role: 'slides', title: 'Lecture 1' }));
    expect(result.sections.map((s) => s.title)).toEqual(['Velocity', 'Newton Second Law']);
    expect(result.pageOffset).toBe(0);
    expect(result.warnings.join(' ')).not.toMatch(/printed page numbers/);
    expect(result.chunks.map((c) => c.sectionIndex)).toEqual([0, 1]);
  });

  it('ingests a handwritten-note image through vision', async () => {
    const llm = new MockProvider().whenImage(
      TINY_PNG,
      'Velocity is the rate of change of position.\nAcceleration is the rate of change of velocity.',
    );
    const result = await ingestDocument(
      ingestInput(TINY_PNG, { role: 'notes', title: 'My notes', llm }),
    );
    expect(result.pageCount).toBe(1);
    expect(result.chunks.map((c) => c.text).join(' ')).toContain('rate of change of position');
    expect(result.sections).toHaveLength(1);
  });
});
