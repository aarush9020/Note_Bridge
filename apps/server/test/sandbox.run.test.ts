import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_OUTPUT_BYTES, MAX_TIMEOUT_MS, findPython } from '../src/sandbox';
import { clampLimit } from '../src/sandbox/limits';
import { runLocal } from '../src/sandbox/local';

const pyIt = it.skipIf(findPython() === null);

// A private temp root for this file. Scanning the shared OS temp dir would race with other test
// files that run sandboxes in parallel.
let root = '';
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gyan-sandbox-test-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('limits', () => {
  it('uses the documented ceilings: 10 s and 10 KB', () => {
    expect(MAX_TIMEOUT_MS).toBe(10_000);
    expect(MAX_OUTPUT_BYTES).toBe(10 * 1024);
  });

  it('lets a caller lower a limit but never raise it', () => {
    expect(clampLimit(undefined, 10_000)).toBe(10_000);
    expect(clampLimit(500, 10_000)).toBe(500);
    expect(clampLimit(60_000, 10_000)).toBe(10_000);
    expect(clampLimit(-5, 10_000)).toBe(10_000);
    expect(clampLimit(Number.NaN, 10_000)).toBe(10_000);
  });
});

describe('sandbox: running code locally', () => {
  it('runs node and captures stdout', async () => {
    const r = await runLocal({ interpreter: 'node', code: 'console.log(6 * 7)' });
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('42');
    expect(r.timedOut).toBe(false);
    expect(r.truncated).toBe(false);
    expect(r.mode).toBe('local');
  });

  pyIt('runs python3 and captures stdout', async () => {
    const r = await runLocal({ interpreter: 'python3', code: 'print(6 * 7)' });
    expect(r.ok).toBe(true);
    expect(r.stdout.trim()).toBe('42');
  });

  it('reports a failing script without throwing', async () => {
    const r = await runLocal({ interpreter: 'node', code: 'throw new Error("boom")' });
    expect(r.ok).toBe(false);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('boom');
  });

  it('runs inside a temp directory that is removed afterwards', async () => {
    const r = await runLocal({ interpreter: 'node', code: 'console.log(process.cwd())' }, root);
    const cwd = r.stdout.trim();
    expect(cwd.startsWith(root)).toBe(true);
    expect(cwd).toContain('gyan-sandbox-');
    expect(existsSync(cwd)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });
});

describe('sandbox: timeout', () => {
  it('kills an infinite loop and reports timedOut', async () => {
    const started = Date.now();
    const r = await runLocal({ interpreter: 'node', code: 'while (true) {}', timeoutMs: 400 });
    expect(r.timedOut).toBe(true);
    expect(r.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(8_000);
  });

  it('kills the whole process tree, not just the direct child', async () => {
    // The grandchild writes a marker file after 2.5 s. If the tree kill works, it never does.
    const marker = join(root, 'grandchild-survived.txt');
    const grandchild = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'alive'), 2500)`;
    const code = `
      const { spawn } = require('node:child_process');
      spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' });
      setInterval(() => {}, 1000);
    `;
    const started = Date.now();
    const r = await runLocal({ interpreter: 'node', code, timeoutMs: 500 }, root);
    expect(r.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(8_000);

    await new Promise((resolve) => setTimeout(resolve, 3_500));
    expect(existsSync(marker)).toBe(false);
  });

  pyIt('times out a python busy loop too', async () => {
    const r = await runLocal({
      interpreter: 'python3',
      code: 'while True:\n    pass',
      timeoutMs: 500,
    });
    expect(r.timedOut).toBe(true);
  });

  it('a request for a longer timeout than the ceiling does not break a normal run', async () => {
    const r = await runLocal({ interpreter: 'node', code: '1', timeoutMs: 999_999 });
    expect(r.ok).toBe(true);
  });
});

describe('sandbox: output cap', () => {
  it('stops at 10 KB and flags truncation', async () => {
    const r = await runLocal({
      interpreter: 'node',
      code: 'process.stdout.write("x".repeat(200000))',
    });
    expect(r.truncated).toBe(true);
    expect(r.ok).toBe(false);
    expect(Buffer.byteLength(r.stdout) + Buffer.byteLength(r.stderr)).toBeLessThanOrEqual(
      MAX_OUTPUT_BYTES,
    );
  });

  it('stops a process that prints forever', async () => {
    // A tight print loop (setInterval(..., 0) only ticks every ~15 ms on Windows, which is slow).
    const r = await runLocal({
      interpreter: 'node',
      code: 'const f = () => { process.stdout.write("spam\\n".repeat(100)); setImmediate(f); }; f();',
    });
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.stdout)).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
  });

  it('counts stderr towards the same cap', async () => {
    const r = await runLocal({
      interpreter: 'node',
      code: 'process.stderr.write("e".repeat(50000))',
    });
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.stderr)).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
  });

  it('honours a lower caller-supplied cap', async () => {
    const r = await runLocal({
      interpreter: 'node',
      code: 'process.stdout.write("y".repeat(5000))',
      maxOutputBytes: 100,
    });
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.stdout)).toBeLessThanOrEqual(100);
  });

  it('leaves output under the cap untouched', async () => {
    const r = await runLocal({
      interpreter: 'node',
      code: 'process.stdout.write("z".repeat(1000))',
    });
    expect(r.truncated).toBe(false);
    expect(r.stdout).toHaveLength(1000);
  });
});
