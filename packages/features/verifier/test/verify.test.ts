import { describe, expect, it, vi } from 'vitest';
import { MockScriptWriter, verify, type SandboxRun, type SandboxRunResult } from '../src';

const result = (stdout: string, extra: Partial<SandboxRunResult> = {}): SandboxRunResult => ({
  ok: true,
  exitCode: 0,
  stdout,
  stderr: '',
  timedOut: false,
  truncated: false,
  durationMs: 5,
  mode: 'local',
  ...extra,
});
const printing =
  (stdout: string, extra: Partial<SandboxRunResult> = {}): SandboxRun =>
  async () =>
    result(stdout, extra);
const writer = () =>
  new MockScriptWriter({ c: { language: 'node', code: 'console.log("see stub")' } });

describe('verify (stubbed sandbox, mock script writer)', () => {
  it('returns verified when the printed output matches', async () => {
    const w = writer();
    const r = await verify({ claim: 'c', expected: '7' }, { writer: w, run: printing('7\n') });
    expect(r).toMatchObject({ status: 'verified', actual: '7', expected: '7' });
    expect(w.requests).toHaveLength(1);
    if (r.status === 'verified') expect(r.ran).toMatchObject({ language: 'node', mode: 'local' });
  });

  it('returns a mismatch with expected, actual and a diff', async () => {
    const r = await verify(
      { claim: 'c', expected: '42' },
      { writer: writer(), run: printing('41\n') },
    );
    expect(r.status).toBe('mismatch');
    if (r.status === 'mismatch') {
      expect(r.expected).toBe('42');
      expect(r.actual).toBe('41');
      expect(r.diff).toEqual([
        { kind: 'removed', text: '42' },
        { kind: 'added', text: '41' },
      ]);
      expect(r.ran.code).toContain('see stub');
    }
  });

  it('maps timeouts, truncation and crashes to distinct errors', async () => {
    const w = writer();
    const req = { claim: 'c', expected: '1' };
    const run = (extra: Partial<SandboxRunResult>) => printing('', extra);
    expect(
      await verify(req, { writer: w, run: run({ ok: false, exitCode: null, timedOut: true }) }),
    ).toMatchObject({ status: 'error', reason: 'timeout' });
    expect(
      await verify(req, { writer: w, run: run({ ok: false, exitCode: null, truncated: true }) }),
    ).toMatchObject({ status: 'error', reason: 'output_limit' });
    expect(
      await verify(req, {
        writer: w,
        run: run({ ok: false, exitCode: 1, stderr: 'Traceback boom' }),
      }),
    ).toMatchObject({ status: 'error', reason: 'script_failed', stderr: 'Traceback boom' });
  });

  it('never claims a result when the script crashed, even if it printed the expected text', async () => {
    const r = await verify(
      { claim: 'c', expected: '1' },
      { writer: writer(), run: printing('1', { ok: false, exitCode: 2 }) },
    );
    expect(r.status).toBe('error');
  });

  it('maps a missing interpreter to sandbox_unavailable, other failures to sandbox_error', async () => {
    const missing: SandboxRun = async () => {
      throw Object.assign(new Error('python3 was not found'), { code: 'interpreter_not_found' });
    };
    const other: SandboxRun = async () => {
      throw new Error('disk full');
    };
    const req = { claim: 'c', expected: '1' };
    expect(await verify(req, { writer: writer(), run: missing })).toMatchObject({
      status: 'error',
      reason: 'sandbox_unavailable',
    });
    expect(await verify(req, { writer: writer(), run: other })).toMatchObject({
      status: 'error',
      reason: 'sandbox_error',
    });
  });

  it('returns no_script when the writer has nothing (it never invents a script)', async () => {
    const r = await verify(
      { claim: 'unknown', expected: '1' },
      { writer: new MockScriptWriter(), run: printing('1') },
    );
    expect(r).toMatchObject({ status: 'error', reason: 'no_script' });
  });

  it('rejects an incomplete request without calling the writer or sandbox', async () => {
    const w = new MockScriptWriter();
    const spy = vi.fn(printing('1'));
    expect(await verify({ claim: '', expected: '1' }, { writer: w, run: spy })).toMatchObject({
      reason: 'invalid_request',
    });
    expect(await verify({ claim: 'x', expected: '  ' }, { writer: w, run: spy })).toMatchObject({
      reason: 'invalid_request',
    });
    expect(w.requests).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
