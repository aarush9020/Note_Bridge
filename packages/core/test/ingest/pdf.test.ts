import { describe, expect, it } from 'vitest';
import { IngestError, extractPdf, itemsToLines } from '../../src';
import { buildPdf, prose } from './helpers';

describe('extractPdf', () => {
  it('extracts page count, text per page and top-to-bottom order', async () => {
    const bytes = await buildPdf([
      { paras: [{ text: '1.1 Velocity', size: 16 }, { text: prose(2) }] },
      { paras: [{ text: 'Second page text about acceleration.' }] },
    ]);
    const pdf = await extractPdf(bytes);
    expect(pdf.pageCount).toBe(2);
    const p1 = pdf.pages[0]!;
    expect(p1.page).toBe(1);
    expect(p1.lines[0]!.text).toBe('1.1 Velocity');
    expect(p1.lines[0]!.size).toBeCloseTo(16, 0);
    expect(p1.lines[1]!.size).toBeCloseTo(11, 0);
    expect(p1.lines[0]!.y).toBeGreaterThan(p1.lines[1]!.y);
    expect(p1.lines[1]!.gapBefore).toBe(true);
    expect(pdf.pages[1]!.text).toContain('Second page text about acceleration.');
    expect(pdf.outline).toEqual([]);
  });

  it('returns no lines for an empty page', async () => {
    const pdf = await extractPdf(await buildPdf([{ paras: [] }]));
    expect(pdf.pages[0]!.lines).toEqual([]);
    expect(pdf.pages[0]!.text).toBe('');
  });

  it('detects images on a page', async () => {
    const pdf = await extractPdf(await buildPdf([{ paras: [], image: true }, { paras: [] }]));
    expect(pdf.pages[0]!.hasImages).toBe(true);
    expect(pdf.pages[1]!.hasImages).toBe(false);
  });

  it('does not consume the caller buffer, so it can be reused', async () => {
    const bytes = await buildPdf([{ paras: [{ text: 'Reusable bytes for velocity.' }] }]);
    await extractPdf(bytes);
    const again = await extractPdf(bytes);
    expect(again.pages[0]!.text).toContain('Reusable');
  });

  it('throws IngestError for bytes that are not a PDF', async () => {
    await expect(extractPdf(new Uint8Array([1, 2, 3, 4]))).rejects.toBeInstanceOf(IngestError);
  });
});

describe('itemsToLines', () => {
  const item = (str: string, x: number, y: number, size = 11) => ({
    str,
    x,
    y,
    width: str.length * 5,
    size,
    hasEOL: false,
  });

  it('merges items on the same baseline in x order', () => {
    const lines = itemsToLines([item('world', 120, 700), item('hello', 72, 700)]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe('hello world');
  });

  it('separates lines and sorts them top to bottom', () => {
    const lines = itemsToLines([item('low', 72, 400), item('high', 72, 700)]);
    expect(lines.map((l) => l.text)).toEqual(['high', 'low']);
  });

  it('ignores empty strings', () => {
    expect(itemsToLines([item('', 72, 700)])).toEqual([]);
  });
});
