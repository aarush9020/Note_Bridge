import type { Script, ScriptWriter, VerifyRequest } from './types';

export type CannedScript = Script | string;

/**
 * Stand-in for the real agent's script-writing step. It returns scripts that were written ahead
 * of time, keyed by claim, and fails loudly for a claim it has no script for (it never guesses).
 * A bare string is treated as a Python script.
 */
export class MockScriptWriter implements ScriptWriter {
  private readonly scripts: Map<string, Script>;
  /** Every claim asked of this writer, in order. Handy in tests. */
  readonly requests: VerifyRequest[] = [];

  constructor(scripts: Record<string, CannedScript> = {}) {
    this.scripts = new Map(
      Object.entries(scripts).map(([claim, s]) => [
        claim,
        typeof s === 'string' ? { language: 'python3' as const, code: s } : s,
      ]),
    );
  }

  async write(req: VerifyRequest): Promise<Script> {
    this.requests.push(req);
    const script = this.scripts.get(req.claim);
    if (!script) {
      throw new Error(
        `MockScriptWriter has no canned script for claim: ${JSON.stringify(req.claim)}`,
      );
    }
    return script;
  }
}

/** Demo scripts for the mock provider, so `LLM_PROVIDER=mock` has something to run. */
export const DEMO_SCRIPTS: Record<string, Script> = {
  'sum of the integers 1 to 100': {
    language: 'node',
    code: 'let s = 0; for (let i = 1; i <= 100; i++) s += i; console.log(s);',
  },
  'kinetic energy of a 2 kg mass moving at 3 m/s in joules': {
    language: 'python3',
    code: 'print(0.5 * 2 * 3 ** 2)',
  },
};
