/**
 * Web-side mirror of the verifier result (packages/features/verifier/src/types.ts).
 * Proposed for the shared contract in docs/CONTRACT_REQUESTS.md; remove this file and import from
 * `@gyan/core` once it lands there. Kept separate from lib/types.ts so this change does not depend
 * on the Phase 1b screens branch.
 */

export interface VerifyDiffLine {
  /** removed = only in the expected answer, added = only in what the code printed. */
  kind: 'same' | 'removed' | 'added';
  text: string;
}

export interface VerifyRan {
  language: 'python3' | 'node';
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
  ran: VerifyRan;
}

export interface MismatchResult {
  status: 'mismatch';
  claim: string;
  expected: string;
  actual: string;
  diff: VerifyDiffLine[];
  ran: VerifyRan;
}

export interface VerifyErrorResult {
  status: 'error';
  claim: string;
  reason: VerifyErrorReason;
  message: string;
  stderr?: string;
}

export type VerifyResult = VerifiedResult | MismatchResult | VerifyErrorResult;
