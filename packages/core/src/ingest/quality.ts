import type { PageQuality, PageText } from './types';

/**
 * Small built-in vocabulary of very common English + physics/maths words. It is a coarse signal:
 * clean prose has a high share of these, garbled OCR/encoding output has almost none.
 */
const COMMON = new Set(
  (
    'the of and to in a is that it for as with was on are by this be or from at an which not but ' +
    'have has had they you we can will if all one two more than when what each its their there ' +
    'then so these into such also may any other about between over under per only same both ' +
    'where how why who whose while because since using used use given find show let ' +
    'velocity acceleration speed position displacement distance time force mass energy work power ' +
    'momentum newton law laws motion object objects body bodies net constant average rate change ' +
    'equation formula value values direction magnitude vector scalar unit units second seconds ' +
    'meter meters kilogram graph slope area initial final free fall gravity weight friction ' +
    'definition example exercise solution problem answer chapter section figure table ' +
    'positive negative axis frame reference instantaneous uniform kinematics dynamics'
  ).split(' '),
);

export interface QualityOptions {
  /** Below this a page is rejected as garbled. */
  rejectBelow?: number;
  /** Pages with fewer characters than this and an image are treated as scans. */
  minTextChars?: number;
}

export interface QualityMetrics {
  words: number;
  dictRatio: number;
  oddRatio: number;
  avgWordLen: number;
  mathRatio: number;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function textMetrics(text: string): QualityMetrics {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const nonSpace = text.replace(/\s/g, '');
  const dictHits = words.filter((w) => COMMON.has(w)).length;
  // Odd symbols: replacement chars, private-use, control and other non-text characters.
  const odd =
    nonSpace.match(/[\uFFFD\uE000-\uF8FF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g)?.length ?? 0;
  // Math-ish characters; they are legitimate in formula-heavy pages.
  const math = nonSpace.match(/[=+\-*/^_<>≤≥≈∑∫√π∂∆Δθλμσω±×÷()[\]{}]/g)?.length ?? 0;
  const avgWordLen = words.length ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;
  return {
    words: words.length,
    dictRatio: words.length ? dictHits / words.length : 0,
    oddRatio: nonSpace.length ? odd / nonSpace.length : 0,
    avgWordLen,
    mathRatio: nonSpace.length ? math / nonSpace.length : 0,
  };
}

/**
 * Score one page 0..1 and decide what to do with it:
 *  - ok:     use the extracted text.
 *  - vision: no/garbled text but the page has an image; send it to the vision fallback.
 *  - reject: garbled and nothing to fall back on; exclude it and tell the user.
 */
export function assessPage(page: PageText, opts: QualityOptions = {}): PageQuality {
  const rejectBelow = opts.rejectBelow ?? 0.35;
  const minTextChars = opts.minTextChars ?? 40;
  const reasons: string[] = [];
  const text = page.text;
  const m = textMetrics(text);
  const chars = text.replace(/\s/g, '').length;

  // Scanned page: (almost) no text layer but there is image content.
  if (chars < minTextChars) {
    if (page.hasImages) {
      reasons.push('no text layer, page has images (scanned)');
      return {
        page: page.page,
        score: 0,
        verdict: 'vision',
        reasons,
        formulaHeavy: false,
        scanned: true,
      };
    }
    reasons.push('page is blank or nearly blank');
    return {
      page: page.page,
      score: 0,
      verdict: 'reject',
      reasons,
      formulaHeavy: false,
      scanned: false,
    };
  }

  const formulaHeavy = m.mathRatio > 0.18 && m.words < 40;

  // A formula page is not penalised for lacking dictionary words. The dictionary ratio is a
  // multiplier, so nonsense words with ordinary lengths (e.g. "xq zvk wlp") still score ~0.
  const dictScore = formulaHeavy ? 1 : clamp01(m.dictRatio / 0.2);
  const oddScore = clamp01(1 - m.oddRatio * 20);
  const lenScore =
    m.words === 0 ? (formulaHeavy ? 1 : 0) : m.avgWordLen >= 2 && m.avgWordLen <= 9 ? 1 : 0.3;
  const score = clamp01(dictScore * (0.5 + 0.5 * lenScore) * oddScore);

  if (m.dictRatio < 0.05 && !formulaHeavy) reasons.push('very few recognisable words');
  if (m.oddRatio > 0.02) reasons.push('many unreadable symbols');
  if (m.words > 0 && (m.avgWordLen < 2 || m.avgWordLen > 9)) reasons.push('unusual word length');
  if (formulaHeavy) reasons.push('formula-heavy page');

  let verdict: PageQuality['verdict'] = 'ok';
  if (score < rejectBelow) {
    verdict = page.hasImages ? 'vision' : 'reject';
  } else if (formulaHeavy && page.hasImages) {
    // Text layer exists but formulas are often wrong; let the vision pass double-check.
    verdict = 'vision';
  }
  return { page: page.page, score, verdict, reasons, formulaHeavy, scanned: false };
}

export function assessPages(pages: PageText[], opts?: QualityOptions): PageQuality[] {
  return pages.map((p) => assessPage(p, opts));
}
