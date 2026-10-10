import { describe, expect, it, vi } from 'vitest';
import { LOCAL_MODE_WARNING, buildDockerArgs, createSandbox } from '../src/sandbox';

const fakeResult = {
  ok: true,
  exitCode: 0,
  stdout: '',
  stderr: '',
  timedOut: false,
  truncated: false,
  durationMs: 1,
};
const asLocal = async () => ({ ...fakeResult, mode: 'local' as const });
const asDocker = async () => ({ ...fakeResult, mode: 'docker' as const });

describe('sandbox: mode selection', () => {
  it('auto: falls back to local with one warning when Docker is missing', async () => {
    const log = vi.fn();
    const runLocalImpl = vi.fn(asLocal);
    const runDockerImpl = vi.fn(asDocker);
    const sandbox = createSandbox({
      mode: 'auto',
      log,
      detectDocker: () => false,
      runLocalImpl,
      runDockerImpl,
    });

    expect(await sandbox.mode()).toBe('local');
    await sandbox.run({ interpreter: 'node', code: '1' });
    await sandbox.run({ interpreter: 'node', code: '2' });

    expect(runLocalImpl).toHaveBeenCalledTimes(2);
    expect(runDockerImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain(LOCAL_MODE_WARNING);
  });

  it('auto: uses Docker when it is available', async () => {
    const log = vi.fn();
    const runLocalImpl = vi.fn(asLocal);
    const runDockerImpl = vi.fn(asDocker);
    const sandbox = createSandbox({
      mode: 'auto',
      log,
      detectDocker: () => true,
      runLocalImpl,
      runDockerImpl,
    });
    expect(await sandbox.mode()).toBe('docker');
    await sandbox.run({ interpreter: 'node', code: '1' });
    expect(runDockerImpl).toHaveBeenCalledTimes(1);
    expect(runLocalImpl).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('docker: fails loudly instead of silently running locally', async () => {
    const runLocalImpl = vi.fn(asLocal);
    const sandbox = createSandbox({ mode: 'docker', detectDocker: () => false, runLocalImpl });
    await expect(sandbox.run({ interpreter: 'node', code: '1' })).rejects.toMatchObject({
      code: 'docker_unavailable',
    });
    expect(runLocalImpl).not.toHaveBeenCalled();
  });

  it('local: never probes Docker and warns', async () => {
    const log = vi.fn();
    const detectDocker = vi.fn(() => true);
    const sandbox = createSandbox({ mode: 'local', log, detectDocker, runLocalImpl: asLocal });
    expect(await sandbox.mode()).toBe('local');
    expect(detectDocker).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('runs real code end-to-end through the factory in local mode', async () => {
    const sandbox = createSandbox({ mode: 'local', log: () => {} });
    const r = await sandbox.run({ interpreter: 'node', code: 'console.log("hi")' });
    expect(r.stdout.trim()).toBe('hi');
    expect(r.mode).toBe('local');
  });

  it('builds docker arguments with --network none and no host environment', () => {
    const args = buildDockerArgs({ name: 'n1', hostDir: '/tmp/x', interpreter: 'python3' });
    expect(args[args.indexOf('--network') + 1]).toBe('none');
    expect(args).toContain('--read-only');
    expect(args).toContain('--rm');
    expect(args).not.toContain('-e');
    expect(args).not.toContain('--env');
    expect(args).toContain('/tmp/x:/work:ro');
    expect(args.slice(-2)).toEqual(['python3', '/work/main.py']);

    const nodeArgs = buildDockerArgs({ name: 'n2', hostDir: '/tmp/y', interpreter: 'node' });
    expect(nodeArgs.slice(-2)).toEqual(['node', '/work/main.js']);
  });
});
