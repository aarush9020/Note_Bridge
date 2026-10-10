/**
 * Verifier types. The result shape is proposed in docs/CONTRACT_REQUESTS.md; the web app keeps a
 * mirror in apps/web/src/lib/types.ts until it lands in the shared contract.
 */

export type VerifyLanguage = 'python3' | 'node';

export interface VerifyRequest {
  /** What is being checked, in plain language (for example "the sum of 1..100"). */
  claim: string;
  /** The answer the claim says the code should print. */
  expected: string;
  /** Preferred language for the script; the script writer may ignore it. */
  language?: VerifyLanguage;
}

export interface Script {
  language: VerifyLanguage;
  code: string;
}

/** Writes a script that prints the answer for a claim. The real agent will implement this. */
export interface ScriptWriter {
  write(req: VerifyRequest): Promise<Script>;
}

/**
 * Structural copy of the server sandbox runner. Declared here (not imported) so a feature package
 * never depends on the app; the server injects the real sandbox.
 */
export interface SandboxRunRequest {
  interpreter: string;
  code: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface SandboxRunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
  mode: 'docker' | 'local';
}

export type SandboxRun = (req: SandboxRunRequest) => Promise<SandboxRunResult>;

export interface DiffLine {
  /** removed = only in the expected answer, added = only in what the code printed. */
  kind: 'same' | 'removed' | 'added';
  text: string;
}

export interface Executed {
  language: VerifyLanguage;
  code: string;
  durationMs: number;
  mode: 'docker' | 'local';
}

export type VerifyErrorReason =
  | 'invalid_request'
  | 'no_script'
  | 'sandbox_unavailable'
  | 'sandbox_error'
  | 'timeout'
  | 'output_limit'
  | 'script_failed';

export interface VerifiedResult {
  status: 'verified';
  claim: string;
  expected: string;
  actual: string;
  ran: Executed;
}

export interface MismatchResult {
  status: 'mismatch';
  claim: string;
  expected: string;
  actual: string;
  diff: DiffLine[];
  ran: Executed;
}

export interface VerifyErrorResult {
  status: 'error';
  claim: string;
  reason: VerifyErrorReason;
  message: string;
  stderr?: string;
}

export type VerifyResult = VerifiedResult | MismatchResult | VerifyErrorResult;
