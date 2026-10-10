import { readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SandboxError, buildSandboxEnv, findPython, isAllowedInterpreter } from '../src/sandbox';
import { runLocal } from '../src/sandbox/local';

const pyIt = it.skipIf(findPython() === null);

// Private temp root, so checking "nothing was created" cannot race with other test files.
let root = '';
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gyan-sandbox-test-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('sandbox: environment stripping', () => {
  const KEYS = ['GYAN_TEST_SECRET', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const k of KEYS) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('does not pass secrets from the server environment', async () => {
    process.env.GYAN_TEST_SECRET = 'top-secret-value';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-should-not-leak';
    process.env.OPENAI_API_KEY = 'sk-openai-should-not-leak';

    const r = await runLocal({
      interpreter: 'node',
      code: 'console.log(JSON.stringify(process.env))',
    });
    expect(r.ok).toBe(true);
    expect(r.stdout).not.toContain('top-secret-value');
    expect(r.stdout).not.toContain('should-not-leak');
    const names = Object.keys(JSON.parse(r.stdout) as Record<string, string>).map((n) =>
      n.toUpperCase(),
    );
    expect(names).not.toContain('GYAN_TEST_SECRET');
    expect(names).not.toContain('ANTHROPIC_API_KEY');
    expect(names).not.toContain('OPENAI_API_KEY');
    // Only a handful of variables survive, nothing like the full parent environment.
    expect(names.length).toBeLessThan(20);
  });

  pyIt('hides secrets from python as well', async () => {
    process.env.GYAN_TEST_SECRET = 'top-secret-value';
    const r = await runLocal({
      interpreter: 'python3',
      code: 'import os\nprint("GYAN_TEST_SECRET" in os.environ)',
    });
    expect(r.stdout.trim()).toBe('False');
  });

  it('buildSandboxEnv keeps only the allowlist (posix)', () => {
    const env = buildSandboxEnv(
      { PATH: '/bin', HOME: '/home/me', AWS_SECRET: 'x', ANTHROPIC_API_KEY: 'k' },
      'linux',
    );
    expect(env.PATH).toBe('/bin');
    expect(env.HOME).toBeUndefined();
    expect(env.AWS_SECRET).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('buildSandboxEnv keeps the Windows variables interpreters need, case-insensitively', () => {
    const env = buildSandboxEnv(
      { Path: 'C:\\Windows', SystemRoot: 'C:\\Windows', OPENAI_API_KEY: 'k' },
      'win32',
    );
    expect(env.Path).toBe('C:\\Windows');
    expect(env.SystemRoot).toBe('C:\\Windows');
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('buildSandboxEnv lets overrides replace an inherited value', () => {
    const env = buildSandboxEnv({ PATH: '/bin' }, 'linux', { PATH: '/override' });
    expect(env.PATH).toBe('/override');
  });
});

describe('sandbox: disallowed interpreters', () => {
  const bad = [
    'bash',
    'sh',
    'powershell',
    'pwsh',
    'cmd',
    'cmd.exe',
    'ruby',
    'perl',
    'node.exe',
    'python',
    'Node',
    '../node',
    'C:\\Windows\\System32\\cmd.exe',
    '/bin/sh',
    'node; rm -rf /',
    '',
  ];

  it.each(bad)('rejects %j before spawning anything', async (interpreter) => {
    await expect(runLocal({ interpreter, code: 'echo hi' }, root)).rejects.toMatchObject({
      name: 'SandboxError',
      code: 'disallowed_interpreter',
    });
    // Rejected up front: not even a temp directory was created.
    expect(readdirSync(root)).toEqual([]);
  });

  it('rejects non-string interpreters', async () => {
    await expect(
      runLocal({ interpreter: 42 as unknown as string, code: '1' }),
    ).rejects.toBeInstanceOf(SandboxError);
    await expect(
      runLocal({ interpreter: undefined as unknown as string, code: '1' }),
    ).rejects.toBeInstanceOf(SandboxError);
  });

  it('rejects non-string code and oversized code', async () => {
    await expect(
      runLocal({ interpreter: 'node', code: 5 as unknown as string }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(
      runLocal({ interpreter: 'node', code: 'a'.repeat(200 * 1024) }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('accepts exactly python3 and node', () => {
    expect(isAllowedInterpreter('python3')).toBe(true);
    expect(isAllowedInterpreter('node')).toBe(true);
    expect(isAllowedInterpreter('python')).toBe(false);
  });
});
