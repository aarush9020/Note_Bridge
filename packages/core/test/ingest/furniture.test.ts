import { describe, expect, it } from 'vitest';
import type { PageText } from '../../src';
import { stripPageFurniture } from '../../src';

/** A page whose lines have explicit y positions (792pt tall). */
function page(n: number, lines: Array<[string, number]>): PageText {
  const ls = lines.map(([text, y]) => ({ text, x: 72, y, size: 11, gapBefore: false }));
  return {
    page: n,
    width: 612,
    height: 792,
    lines: ls,
    text: ls.map((l) => l.text).join('\n'),
    hasImages: false,
  };
}

describe('stripPageFurniture', () => {
  it('removes a bare page number in the footer band but keeps body text', () => {
    const [p] = stripPageFurniture([
      page(1, [
        ['Body text about velocity.', 500],
        ['13', 30],
      ]),
    ]);
    expect(p!.lines.map((l) => l.text)).toEqual(['Body text about velocity.']);
    expect(p!.text).toBe('Body text about velocity.');
  });

  it('keeps a number-only line that is in the middle of the page', () => {
    const [p] = stripPageFurniture([
      page(1, [
        ['Body text.', 600],
        ['42', 400],
      ]),
    ]);
    expect(p!.lines.map((l) => l.text)).toEqual(['Body text.', '42']);
  });

  it('removes running headers that repeat across pages, ignoring the changing number', () => {
    const pages = [1, 2, 3, 4].map((n) =>
      page(n, [
        ['Physics 101 | Chapter 2', 760],
        [`Unique body line ${'abc'.repeat(n)} here.`, 500],
        [`Page ${n}`, 30],
      ]),
    );
    const out = stripPageFurniture(pages);
    for (const p of out) {
      expect(p.lines).toHaveLength(1);
      expect(p.lines[0]!.text).toContain('Unique body line');
    }
  });

  it('does not remove a repeated line outside the header/footer band', () => {
    const pages = [1, 2, 3].map((n) => page(n, [['Repeated body sentence.', 400]]));
    for (const p of stripPageFurniture(pages)) expect(p.lines).toHaveLength(1);
  });

  it('does not treat a header as repeating when there are too few pages', () => {
    const pages = [1, 2].map((n) =>
      page(n, [
        ['Physics 101', 760],
        ['Body.', 500],
      ]),
    );
    for (const p of stripPageFurniture(pages)) expect(p.lines).toHaveLength(2);
  });

  it('returns the same page object when nothing was removed', () => {
    const p = page(1, [['Only body.', 500]]);
    expect(stripPageFurniture([p])[0]).toBe(p);
  });
});
