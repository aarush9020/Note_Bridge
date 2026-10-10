import { describe, expect, it } from 'vitest';
import { fitPageOffset, pageFromText, printedNumber } from '../../src';
import { prose } from './helpers';

const withFooter = (pdfPage: number, footer: string) =>
  pageFromText(pdfPage, `${prose(2)}\n${footer}`);

describe('printedNumber', () => {
  it.each([
    ['12', 12],
    ['Page 12', 12],
    ['- 12 -', 12],
    ['12 | Chapter 2', 12],
    ['Chapter 2 | 12', 12],
  ])('reads "%s" as %i', (footer, expected) => {
    expect(printedNumber(withFooter(1, footer))).toBe(expected);
  });

  it('ignores roman-numeral front matter', () => {
    expect(printedNumber(withFooter(1, 'iv'))).toBeNull();
  });

  it('returns null when the page has no number', () => {
    expect(printedNumber(pageFromText(1, prose(2)))).toBeNull();
    expect(printedNumber(pageFromText(1, ''))).toBeNull();
  });
});

describe('fitPageOffset', () => {
  it('fits a negative offset (printed 12-14 on pdf pages 15-17)', () => {
    const pages = [15, 16, 17].map((p) => withFooter(p, String(p - 3)));
    const r = fitPageOffset(pages);
    expect(r.offset).toBe(-3);
    expect(r.votes).toBe(3);
    expect(r.confidence).toBeGreaterThan(0.4);
  });

  it('fits a positive offset when printed numbering starts after the cover', () => {
    const pages = [1, 2, 3, 4, 5, 6].map((p) => withFooter(p, String(p + 2)));
    expect(fitPageOffset(pages).offset).toBe(2);
  });

  it('outvotes a single noisy page', () => {
    const pages = [1, 2, 3, 4, 5].map((p) => withFooter(p, String(p + 4)));
    pages.push(withFooter(6, '99'));
    const r = fitPageOffset(pages);
    expect(r.offset).toBe(4);
    expect(r.samples).toBe(6);
  });

  it('returns offset 0 with zero confidence when no page has a number', () => {
    const r = fitPageOffset([pageFromText(1, prose(2)), pageFromText(2, prose(2))]);
    expect(r).toMatchObject({ offset: 0, confidence: 0, samples: 0 });
  });

  it('returns offset 0 when roman numerals are the only numbering', () => {
    const pages = ['i', 'ii', 'iii', 'iv'].map((r, i) => withFooter(i + 1, r));
    expect(fitPageOffset(pages).offset).toBe(0);
  });

  it('does not trust too few votes', () => {
    const pages = [1, 2].map((p) => withFooter(p, String(p + 7)));
    const r = fitPageOffset(pages);
    expect(r.offset).toBe(0);
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('does not trust numbers that disagree with each other', () => {
    const pages = [
      withFooter(1, '5'),
      withFooter(2, '9'),
      withFooter(3, '20'),
      withFooter(4, '31'),
    ];
    expect(fitPageOffset(pages).offset).toBe(0);
  });
});
