import { spawn } from 'node:child_process';
import { KILL_GRACE_MS } from './limits';
import { killTree } from './kill';
import { SandboxError } from './types';

export interface ExecOptions {
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  timeoutMs: number;
  /** Cap on stdout + stderr combined, in bytes. */
  maxOutputBytes: number;
  /** Extra cleanup when we kill the process (for example `docker kill`). */
  onKill?: () => void;
}

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}

/**
 * Spawn a process with a hard timeout and a hard output cap. `shell` is never used, so the
 * arguments are never interpreted by a shell. On timeout or when the cap is hit the whole process
 * tree is killed.
 */
export function execLimited(opts: ExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let total = 0;
    let timedOut = false;
    let truncated = false;
    let settled = false;
    let exitCode: number | null = null;
    let graceTimer: NodeJS.Timeout | undefined;

    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      shell: false,
      windowsHide: true,
      // Own process group on POSIX so the whole group can be signalled.
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);
      resolve({
        exitCode,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        timedOut,
        truncated,
        durationMs: Date.now() - started,
      });
    };

    const kill = () => {
      killTree(child);
      try {
        opts.onKill?.();
      } catch {
        // best effort
      }
      // If a grandchild keeps the pipes open, do not hang forever waiting for "close".
      graceTimer ??= setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
        finish();
      }, KILL_GRACE_MS);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, opts.timeoutMs);

    const collect = (sink: Buffer[]) => (chunk: Buffer) => {
      if (truncated) return;
      const room = opts.maxOutputBytes - total;
      if (chunk.length > room) {
        if (room > 0) sink.push(chunk.subarray(0, room));
        total = opts.maxOutputBytes;
        truncated = true;
        kill();
        return;
      }
      sink.push(chunk);
      total += chunk.length;
    };

    child.stdout?.on('data', collect(out));
    child.stderr?.on('data', collect(err));

    child.on('error', (e: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);
      reject(
        new SandboxError(
          e.code === 'ENOENT' ? 'interpreter_not_found' : 'spawn_failed',
          `Could not start "${opts.command}": ${e.message}`,
        ),
      );
    });

    child.on('close', (code) => {
      exitCode = code;
      finish();
    });
  });
}
