import { parsePrintedNumber } from './offsets';
import type { PageText } from './types';

/** Fraction of the page height, at the top and at the bottom, that counts as header/footer. */
const BAND = 0.1;

function inBand(page: PageText, y: number): boolean {
  return y > page.height * (1 - BAND) || y < page.height * BAND;
}

function normalize(text: string): string {
  // Digits vary page to page ("Chapter 2 | 13"), so ignore them when finding repeats.
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

/**
 * Remove running headers/footers and printed page numbers so they never end up inside chunk text
 * (which must stay verbatim for quote checking). Only lines in the top/bottom band are touched:
 *  - lines that are just a page number, and
 *  - lines that repeat (ignoring digits) on at least half of the pages, when there are 3+ pages.
 * Page offsets must be fitted BEFORE calling this, because it removes the numbers.
 */
export function stripPageFurniture(pages: PageText[]): PageText[] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const l of page.lines) {
      if (!inBand(page, l.y)) continue;
      const key = normalize(l.text);
      if (key && !seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const repeatMin = Math.max(3, Math.ceil(pages.length / 2));

  return pages.map((page) => {
    const lines = page.lines.filter((l) => {
      if (!inBand(page, l.y)) return true;
      if (
        parsePrintedNumber(l.text) !== null &&
        /^(?:page\s+)?[-–—\s]*\d+[-–—\s]*$/i.test(l.text.trim())
      )
        return false;
      return (counts.get(normalize(l.text)) ?? 0) < repeatMin;
    });
    if (lines.length === page.lines.length) return page;
    return { ...page, lines, text: lines.map((l) => l.text).join('\n') };
  });
}
