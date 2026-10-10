/** Hard ceilings. A request may ask for less, never more. */
export const MAX_TIMEOUT_MS = 10_000;
export const MAX_OUTPUT_BYTES = 10 * 1024;
export const MAX_CODE_BYTES = 100 * 1024;

/** Grace period for a killed process to close its pipes before we give up waiting. */
export const KILL_GRACE_MS = 1_000;

export function clampLimit(requested: number | undefined, max: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0) return max;
  return Math.min(Math.floor(requested), max);
}
