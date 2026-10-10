/**
 * Cheap, deterministic token estimate (no tokenizer download). Counts word-ish runs and
 * punctuation/symbol characters, then applies the usual ~1.3 tokens-per-word correction.
 */
export function countTokens(text: string): number {
  const words = text.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
  const symbols = text.match(/[^\s\p{L}\p{N}_]/gu)?.length ?? 0;
  return Math.ceil(words * 1.3 + symbols * 0.5);
}
