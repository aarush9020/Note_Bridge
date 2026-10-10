import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDockerCliEnv } from './env';
import { execLimited } from './exec';
import { validateRequest } from './interpreters';
import { MAX_OUTPUT_BYTES, MAX_TIMEOUT_MS, clampLimit } from './limits';
import type { Interpreter, SandboxRequest, SandboxResult } from './types';

const IMAGES: Record<Interpreter, { image: string; command: string; fileName: string }> = {
  python3: { image: 'python:3.12-alpine', command: 'python3', fileName: 'main.py' },
  node: { image: 'node:22-alpine', command: 'node', fileName: 'main.js' },
};

/** True when a Docker daemon answers. Cheap enough to call once at startup. */
export function isDockerAvailable(): boolean {
  try {
    const probe = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
      stdio: 'ignore',
      timeout: 5_000,
      windowsHide: true,
      shell: false,
      env: buildDockerCliEnv(),
    });
    return probe.status === 0;
  } catch {
    return false;
  }
}

export interface DockerArgsInput {
  name: string;
  hostDir: string;
  interpreter: Interpreter;
}

/** Pure so it can be unit-tested without Docker. */
export function buildDockerArgs({ name, hostDir, interpreter }: DockerArgsInput): string[] {
  const spec = IMAGES[interpreter];
  return [
    'run',
    '--rm',
    '--name',
    name,
    '--network',
    'none',
    '--memory',
    '256m',
    '--cpus',
    '1',
    '--pids-limit',
    '64',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,size=16m',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '-v',
    `${hostDir}:/work:ro`,
    '-w',
    '/work',
    spec.image,
    spec.command,
    `/work/${spec.fileName}`,
  ];
}

/**
 * Docker mode: `--network none`, read-only root, no capabilities, no host environment. The Docker
 * CLI gets only the variables it needs to reach the daemon; none of them enter the container.
 */
export async function runDocker(req: SandboxRequest): Promise<SandboxResult> {
  const interpreter = validateRequest(req);
  const timeoutMs = clampLimit(req.timeoutMs, MAX_TIMEOUT_MS);
  const maxOutputBytes = clampLimit(req.maxOutputBytes, MAX_OUTPUT_BYTES);
  const spec = IMAGES[interpreter];

  const dir = await mkdtemp(join(tmpdir(), 'gyan-sandbox-'));
  const name = `gyan-sandbox-${randomBytes(6).toString('hex')}`;
  try {
    await writeFile(join(dir, spec.fileName), req.code, 'utf8');

    const result = await execLimited({
      command: 'docker',
      args: buildDockerArgs({ name, hostDir: dir, interpreter }),
      env: buildDockerCliEnv(),
      timeoutMs,
      maxOutputBytes,
      // Killing the docker CLI does not stop the container, so stop it explicitly.
      onKill: () => {
        spawnSync('docker', ['kill', name], {
          stdio: 'ignore',
          timeout: 5_000,
          windowsHide: true,
          shell: false,
          env: buildDockerCliEnv(),
        });
      },
    });

    return {
      ...result,
      ok: result.exitCode === 0 && !result.timedOut && !result.truncated,
      mode: 'docker',
    };
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  }
}
