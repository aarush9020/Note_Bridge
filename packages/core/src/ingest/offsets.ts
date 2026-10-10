import type { PageText } from './types';

export interface OffsetResult {
  /** printed page number = pdf page + offset. */
  offset: number;
  /** 0..1. Low confidence means the offset was not trusted and 0 is returned. */
  confidence: number;
  /** How many pages voted for the winning offset. */
  votes: number;
  samples: number;
}

const ROMAN = /^[ivxlcdm]+$/i;

/** Printed page number carried by one line of text ("12", "Page 12", "12 | Chapter 2"), if any. */
export function parsePrintedNumber(text: string): number | null {
  const t = text.trim();
  // "12", "Page 12", "12 | Chapter 2", "Chapter 2 | 12", "- 12 -"
  const m =
    t.match(/^(?:page\s+)?[-–—\s]*(\d{1,4})[-–—\s]*$/i) ??
    t.match(/^(\d{1,4})\s*[|·•]\s*\S.*$/) ??
    t.match(/^.*\S\s*[|·•]\s*(\d{1,4})$/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 2000 ? n : null;
}

/** Read a printed page number from the first or last lines of a page, if there is one. */
export function printedNumber(page: PageText): number | null {
  const lines = page.lines;
  if (lines.length === 0) return null;
  const candidates = [lines[lines.length - 1], lines[lines.length - 2], lines[0], lines[1]];
  for (const line of candidates) {
    if (!line) continue;
    // Front matter numbering is not part of the arabic sequence.
    if (ROMAN.test(line.text.trim())) return null;
    const n = parsePrintedNumber(line.text);
    if (n !== null) return n;
  }
  return null;
}

/**
 * Fit the PDF-page -> printed-page offset by voting: each page with a readable printed number
 * votes for (printed - pdfPage). The most common offset wins; if too few pages agree we trust
 * nothing and return offset 0 with low confidence.
 */
export function fitPageOffset(pages: PageText[], minVotes = 3, minShare = 0.6): OffsetResult {
  const votes = new Map<number, number>();
  let samples = 0;
  for (const p of pages) {
    const n = printedNumber(p);
    if (n === null) continue;
    samples++;
    const off = n - p.page;
    votes.set(off, (votes.get(off) ?? 0) + 1);
  }
  if (samples === 0) return { offset: 0, confidence: 0, votes: 0, samples: 0 };

  let best = 0;
  let bestVotes = 0;
  for (const [off, v] of votes) {
    if (v > bestVotes || (v === bestVotes && Math.abs(off) < Math.abs(best))) {
      best = off;
      bestVotes = v;
    }
  }
  const share = bestVotes / samples;
  const confidence = Math.min(1, share * Math.min(1, bestVotes / (minVotes * 2)));
  if (bestVotes < minVotes || share < minShare) {
    return { offset: 0, confidence, votes: bestVotes, samples };
  }
  return { offset: best, confidence, votes: bestVotes, samples };
}
