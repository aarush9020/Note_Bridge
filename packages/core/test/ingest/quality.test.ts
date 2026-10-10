import { describe, expect, it } from 'vitest';
import { assessPage, assessPages, pageFromText } from '../../src';
import { prose } from './helpers';

describe('assessPage', () => {
  it('scores clean prose high and accepts it', () => {
    const q = assessPage(pageFromText(1, prose(6)));
    expect(q.score).toBeGreaterThan(0.7);
    expect(q.verdict).toBe('ok');
    expect(q.scanned).toBe(false);
  });

  it('rejects garbled consonant soup even though word lengths look normal', () => {
    const text = Array.from({ length: 12 }, () => 'xq zvk wlp hjt brq mnz cvx').join('\n');
    const q = assessPage(pageFromText(1, text));
    expect(q.score).toBeLessThan(0.2);
    expect(q.verdict).toBe('reject');
    expect(q.reasons.join(' ')).toMatch(/recognisable words/);
  });

  it('rejects text full of unreadable symbols', () => {
    const text = Array.from(
      { length: 8 },
      () => '\uFFFD\uFFFD\uE001\uFFFD the \uFFFD\uFFFD\uE002\uFFFD',
    ).join('\n');
    const q = assessPage(pageFromText(1, text));
    expect(q.verdict).toBe('reject');
    expect(q.reasons.join(' ')).toMatch(/unreadable symbols/);
  });

  it('sends a page with no text layer but an image to the vision fallback', () => {
    const page = { ...pageFromText(3, ''), hasImages: true };
    const q = assessPage(page);
    expect(q.verdict).toBe('vision');
    expect(q.scanned).toBe(true);
    expect(q.page).toBe(3);
  });

  it('rejects a blank page that has nothing to fall back on', () => {
    const q = assessPage(pageFromText(1, ''));
    expect(q.verdict).toBe('reject');
    expect(q.scanned).toBe(false);
  });

  it('sends garbled text with an image to vision instead of rejecting', () => {
    const text = Array.from({ length: 12 }, () => 'xq zvk wlp hjt brq mnz').join('\n');
    const q = assessPage({ ...pageFromText(1, text), hasImages: true });
    expect(q.verdict).toBe('vision');
  });

  it('detects formula-heavy pages without rejecting them', () => {
    const text = [
      'F = m a',
      'v = v0 + a t',
      'x = x0 + v0 t + 1/2 a t^2',
      'p = m v',
      'W = F d cos(t)',
    ].join('\n');
    const q = assessPage(pageFromText(1, text));
    expect(q.formulaHeavy).toBe(true);
    expect(q.verdict).toBe('ok');
  });

  it('asks vision to double-check a formula-heavy page that has images', () => {
    const text = [
      'F = m a',
      'v = v0 + a t',
      'x = x0 + v0 t + 1/2 a t^2',
      'p = m v',
      'W = F d cos(t)',
    ].join('\n');
    expect(assessPage({ ...pageFromText(1, text), hasImages: true }).verdict).toBe('vision');
  });

  it('respects a custom reject threshold', () => {
    const page = pageFromText(1, prose(6));
    expect(assessPage(page, { rejectBelow: 1.1 }).verdict).toBe('reject');
  });

  it('assessPages keeps page order', () => {
    const out = assessPages([pageFromText(4, prose(3)), pageFromText(5, '')]);
    expect(out.map((q) => q.page)).toEqual([4, 5]);
  });
});
