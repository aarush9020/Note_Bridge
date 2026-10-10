/**
 * View-model for the "Verified by running code" badge. Pure, so it is unit-tested without React.
 * `VerifyResult` (./verifyTypes) mirrors packages/features/verifier/src/types.ts (proposed in
 * docs/CONTRACT_REQUESTS.md); keep the two in step until it lands in the shared contract.
 */
import type { VerifyResult } from './verifyTypes';

export type BadgeTone = 'verified' | 'mismatch' | 'error';

export interface BadgeDiffLine {
  kind: 'same' | 'removed' | 'added';
  /** "-", "+" or " " prefix for display and for screen readers. */
  marker: '-' | '+' | ' ';
  text: string;
}

export interface BadgeModel {
  tone: BadgeTone;
  label: string;
  /** Short second line: how it was checked, or why it could not be. */
  detail: string;
  /** Only present for a mismatch. */
  diff: BadgeDiffLine[];
  expected?: string;
  actual?: string;
  /** Script that was run, for the "show code" disclosure. */
  code?: string;
  /** True when the code ran with network isolation (Docker). */
  isolated?: boolean;
}

const ERROR_TEXT: Record<string, string> = {
  invalid_request: 'The claim could not be checked because the request was incomplete.',
  no_script: 'No script could be written for this claim.',
  sandbox_unavailable: 'The code sandbox is not available.',
  sandbox_error: 'The sandbox failed to run the script.',
  timeout: 'The script ran too long and was stopped.',
  output_limit: 'The script printed too much output.',
  script_failed: 'The script crashed before it printed an answer.',
};

const MARKERS = { same: ' ', removed: '-', added: '+' } as const;

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function toBadgeModel(result: VerifyResult): BadgeModel {
  if (result.status === 'verified') {
    return {
      tone: 'verified',
      label: 'Verified by running code',
      detail: `Ran ${result.ran.language} in ${formatDuration(result.ran.durationMs)}`,
      diff: [],
      expected: result.expected,
      actual: result.actual,
      code: result.ran.code,
      isolated: result.ran.mode === 'docker',
    };
  }
  if (result.status === 'mismatch') {
    return {
      tone: 'mismatch',
      label: 'Does not match when run',
      detail: `Expected ${result.expected}, the code printed ${result.actual}`,
      diff: result.diff.map((d) => ({ kind: d.kind, marker: MARKERS[d.kind], text: d.text })),
      expected: result.expected,
      actual: result.actual,
      code: result.ran.code,
      isolated: result.ran.mode === 'docker',
    };
  }
  return {
    tone: 'error',
    label: 'Could not verify',
    detail: ERROR_TEXT[result.reason] ?? result.message,
    diff: [],
  };
}
