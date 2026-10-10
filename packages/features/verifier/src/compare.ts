import type { DiffLine } from './types';

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const REL_TOLERANCE = 1e-9;

/** Normalise line endings and trailing whitespace so "42\r\n" equals "42". */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim();
}

function asNumber(text: string): number | null {
  if (!NUMBER.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Equal after normalisation. A single number on each side also matches within a tiny relative
 * tolerance, so "0.30000000000000004" matches "0.3" but "41" never matches "42".
 */
export function outputsMatch(expected: string, actual: string): boolean {
  const e = normalizeOutput(expected);
  const a = normalizeOutput(actual);
  if (e === a) return true;
  const en = asNumber(e);
  const an = asNumber(a);
  if (en === null || an === null) return false;
  const scale = Math.max(Math.abs(en), Math.abs(an), 1);
  return Math.abs(en - an) <= REL_TOLERANCE * scale;
}

/** Line diff (longest common subsequence). Expected lines are "removed", printed lines "added". */
export function diffLines(expected: string, actual: string): DiffLine[] {
  const a = normalizeOutput(expected).split('\n');
  const b = normalizeOutput(actual).split('\n');
  const rows = a.length + 1;
  const cols = b.length + 1;
  const lcs: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: 'removed', text: a[i]! });
      i++;
    } else {
      out.push({ kind: 'added', text: b[j]! });
      j++;
    }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++]! });
  while (j < b.length) out.push({ kind: 'added', text: b[j++]! });
  return out;
}
