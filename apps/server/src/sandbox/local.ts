import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSandboxEnv } from './env';
import { execLimited } from './exec';
import { resolveInterpreter, validateRequest } from './interpreters';
import { MAX_OUTPUT_BYTES, MAX_TIMEOUT_MS, clampLimit } from './limits';
import type { SandboxRequest, SandboxResult } from './types';

/**
 * Local mode: a subprocess in a throwaway temp directory with a stripped environment.
 * This does NOT isolate the network or the filesystem. It is the fallback when Docker is absent.
 */
export async function runLocal(
  req: SandboxRequest,
  /** Parent for the throwaway directory. Defaults to the OS temp dir; tests pass their own. */
  tmpRoot: string = tmpdir(),
): Promise<SandboxResult> {
  const interpreter = validateRequest(req);
  const resolved = resolveInterpreter(interpreter);
  const timeoutMs = clampLimit(req.timeoutMs, MAX_TIMEOUT_MS);
  const maxOutputBytes = clampLimit(req.maxOutputBytes, MAX_OUTPUT_BYTES);

  const dir = await mkdtemp(join(tmpRoot, SANDBOX_DIR_PREFIX));
  try {
    const file = join(dir, resolved.fileName);
    await writeFile(file, req.code, 'utf8');

    const result = await execLimited({
      command: resolved.command,
      args: [...resolved.args, file],
      cwd: dir,
      // HOME / TEMP point at the throwaway directory so scratch files land there.
      env: buildSandboxEnv(process.env, process.platform, {
        HOME: dir,
        TMPDIR: dir,
        ...(process.platform === 'win32' ? { TEMP: dir, TMP: dir, USERPROFILE: dir } : {}),
      }),
      timeoutMs,
      maxOutputBytes,
    });

    return {
      ...result,
      ok: result.exitCode === 0 && !result.timedOut && !result.truncated,
      mode: 'local',
    };
  } finally {
    // After a tree kill, Windows can hold the directory briefly; retry rather than leak it.
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  }
}

/** Exposed for tests that need to know where code runs. */
export const SANDBOX_DIR_PREFIX = 'gyan-sandbox-';
