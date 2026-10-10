/** Interpreters the sandbox will run. Anything else is rejected before a process is spawned. */
export const ALLOWED_INTERPRETERS = ['python3', 'node'] as const;
export type Interpreter = (typeof ALLOWED_INTERPRETERS)[number];

export type SandboxMode = 'docker' | 'local';

export interface SandboxRequest {
  /** Must be one of ALLOWED_INTERPRETERS ("python3" or "node"). */
  interpreter: string;
  code: string;
  /** Can only lower the 10 s ceiling, never raise it. */
  timeoutMs?: number;
  /** Can only lower the 10 KB ceiling, never raise it. */
  maxOutputBytes?: number;
}

export interface SandboxResult {
  /** True only when the process exited 0, did not time out and was not truncated. */
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Output hit the cap; the process was killed and the output is incomplete. */
  truncated: boolean;
  durationMs: number;
  mode: SandboxMode;
}

export type SandboxRunner = (req: SandboxRequest) => Promise<SandboxResult>;

export interface Sandbox {
  run: SandboxRunner;
  /** Resolves which mode is in use (probes Docker once in "auto" mode). */
  mode(): Promise<SandboxMode>;
}

export type SandboxErrorCode =
  | 'invalid_request'
  | 'disallowed_interpreter'
  | 'interpreter_not_found'
  | 'docker_unavailable'
  | 'spawn_failed';

export class SandboxError extends Error {
  readonly code: SandboxErrorCode;

  constructor(code: SandboxErrorCode, message: string) {
    super(message);
    this.name = 'SandboxError';
    this.code = code;
  }
}
