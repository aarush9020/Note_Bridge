import { describe, expect, it } from 'vitest';
import { diffLines, normalizeOutput, outputsMatch } from '../src';

describe('compare helpers', () => {
  it('normalizes line endings and trailing whitespace', () => {
    expect(normalizeOutput('42  \r\n')).toBe('42');
    expect(normalizeOutput('a \nb\t\r\nc\n\n')).toBe('a\nb\nc');
  });

  it('matches equal text and near-equal single numbers', () => {
    expect(outputsMatch('42', '42\n')).toBe(true);
    expect(outputsMatch('0.3', '0.30000000000000004')).toBe(true);
    expect(outputsMatch('1e3', '1000')).toBe(true);
  });

  it('does not match different numbers or text', () => {
    expect(outputsMatch('42', '41')).toBe(false);
    expect(outputsMatch('42', '42.5')).toBe(false);
    expect(outputsMatch('hello', 'world')).toBe(false);
    expect(outputsMatch('42', '')).toBe(false);
  });

  it('builds a line diff with removed and added lines', () => {
    expect(diffLines('a\nb\nc', 'a\nX\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'X' },
      { kind: 'same', text: 'c' },
    ]);
    expect(diffLines('42', '41')).toEqual([
      { kind: 'removed', text: '42' },
      { kind: 'added', text: '41' },
    ]);
  });
});
