import { describe, expect, it } from 'vitest';
import { formatDuration, toBadgeModel } from '../src/lib/verify';
import type { VerifyResult } from '../src/lib/verifyTypes';

const ran = { language: 'node', code: 'console.log(41)', durationMs: 42, mode: 'local' } as const;

describe('toBadgeModel', () => {
  it('shows "Verified by running code" for a verified result', () => {
    const result: VerifyResult = {
      status: 'verified',
      claim: 'c',
      expected: '42',
      actual: '42',
      ran,
    };
    const m = toBadgeModel(result);
    expect(m.tone).toBe('verified');
    expect(m.label).toBe('Verified by running code');
    expect(m.detail).toBe('Ran node in 42 ms');
    expect(m.diff).toEqual([]);
    expect(m.code).toBe('console.log(41)');
    expect(m.isolated).toBe(false);
  });

  it('shows the mismatch diff with -/+ markers', () => {
    const result: VerifyResult = {
      status: 'mismatch',
      claim: 'c',
      expected: '42',
      actual: '41',
      diff: [
        { kind: 'removed', text: '42' },
        { kind: 'added', text: '41' },
        { kind: 'same', text: 'ok' },
      ],
      ran,
    };
    const m = toBadgeModel(result);
    expect(m.tone).toBe('mismatch');
    expect(m.label).toBe('Does not match when run');
    expect(m.detail).toBe('Expected 42, the code printed 41');
    expect(m.diff).toEqual([
      { kind: 'removed', marker: '-', text: '42' },
      { kind: 'added', marker: '+', text: '41' },
      { kind: 'same', marker: ' ', text: 'ok' },
    ]);
    expect(m.expected).toBe('42');
    expect(m.actual).toBe('41');
  });

  it('marks Docker runs as isolated', () => {
    const m = toBadgeModel({
      status: 'verified',
      claim: 'c',
      expected: '1',
      actual: '1',
      ran: { ...ran, mode: 'docker' },
    });
    expect(m.isolated).toBe(true);
  });

  it('shows a neutral "Could not verify" state for errors, with a plain-language reason', () => {
    const m = toBadgeModel({
      status: 'error',
      claim: 'c',
      reason: 'timeout',
      message: 'raw message',
    });
    expect(m.tone).toBe('error');
    expect(m.label).toBe('Could not verify');
    expect(m.detail).toBe('The script ran too long and was stopped.');
    expect(m.diff).toEqual([]);
    expect(m.code).toBeUndefined();
  });

  it('never claims verification for an error or a mismatch', () => {
    const error = toBadgeModel({ status: 'error', claim: 'c', reason: 'no_script', message: 'm' });
    const mismatch = toBadgeModel({
      status: 'mismatch',
      claim: 'c',
      expected: '1',
      actual: '2',
      diff: [],
      ran,
    });
    expect(error.label).not.toMatch(/verified/i);
    expect(mismatch.label).not.toMatch(/^verified/i);
  });
});

describe('formatDuration', () => {
  it('formats milliseconds and seconds', () => {
    expect(formatDuration(42)).toBe('42 ms');
    expect(formatDuration(1500)).toBe('1.5 s');
    expect(formatDuration(-1)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});
