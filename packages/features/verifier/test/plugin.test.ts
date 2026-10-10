import { describe, expect, it, vi } from 'vitest';
import { parseConfig, type PluginContext } from '@gyan/core';
import { createVerifierPlugin, type SandboxRun } from '../src';

const printing =
  (stdout: string): SandboxRun =>
  async () => ({
    ok: true,
    exitCode: 0,
    stdout,
    stderr: '',
    timedOut: false,
    truncated: false,
    durationMs: 5,
    mode: 'local',
  });
const ctx = (): PluginContext =>
  ({ config: parseConfig({}), log: vi.fn() }) as unknown as PluginContext;
const body = { claim: 'sum of the integers 1 to 100', expected: '5050' };

describe('verifier plugin', () => {
  it('exposes POST /verify and uses the injected sandbox', async () => {
    const plugin = createVerifierPlugin({ run: printing('5050\n') });
    const routes = await plugin.register(ctx());
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual(['POST /verify']);
    const res = (await routes[0]!.handler({ params: {}, query: {}, body })) as { status: string };
    expect(res.status).toBe('verified');
  });

  it('rejects a malformed body', async () => {
    const [route] = await createVerifierPlugin({ run: printing('1') }).register(ctx());
    const res = (await route!.handler({ params: {}, query: {}, body: { claim: 1 } })) as {
      error: { code: string };
    };
    expect(res.error.code).toBe('invalid_request');
  });

  it('reports the sandbox as unavailable until one is attached', async () => {
    const plugin = createVerifierPlugin();
    const [route] = await plugin.register(ctx());
    expect(await route!.handler({ params: {}, query: {}, body })).toMatchObject({
      status: 'error',
      reason: 'sandbox_unavailable',
    });
    plugin.attachSandbox(printing('5050'));
    expect(await route!.handler({ params: {}, query: {}, body })).toMatchObject({
      status: 'verified',
    });
  });
});
