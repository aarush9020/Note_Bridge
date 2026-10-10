import { createHash } from 'node:crypto';
import type { EmbeddingProvider, LLMProvider, LLMRequest, LLMResponse, VisionRequest } from './llm';

export function hashPrompt(req: LLMRequest): string {
  const h = createHash('sha256');
  for (const m of req.messages) h.update(`${m.role}\u0000${m.content}\u0001`);
  h.update(req.json ? 'json' : 'text');
  return h.digest('hex');
}

function approxTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

/**
 * Deterministic provider: the same prompt always yields the same output, keyed by a hash of the
 * prompt. Tests may register fixed answers with `when()`.
 */
export class MockProvider implements LLMProvider {
  readonly id = 'mock';
  private readonly fixed = new Map<string, string>();

  /** Register a fixed response for an exact request. */
  when(req: LLMRequest, text: string): this {
    this.fixed.set(hashPrompt(req), text);
    return this;
  }

  private readonly fixedVision = new Map<string, string>();

  /** Register a fixed vision transcript for an image (matched by content hash). */
  whenImage(image: Uint8Array, text: string): this {
    this.fixedVision.set(createHash('sha256').update(image).digest('hex'), text);
    return this;
  }

  async vision(req: VisionRequest): Promise<LLMResponse> {
    const key = createHash('sha256').update(req.image).digest('hex');
    const text = this.fixedVision.get(key) ?? `[mock-vision:${key.slice(0, 12)}]`;
    return {
      text,
      usage: { inputTokens: approxTokens(req.prompt) + 85, outputTokens: approxTokens(text) },
    };
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const key = hashPrompt(req);
    const input = req.messages.map((m) => m.content).join('\n');
    let text = this.fixed.get(key);
    if (text === undefined) {
      text = req.json
        ? JSON.stringify({ mock: true, id: key.slice(0, 12) })
        : `[mock:${key.slice(0, 12)}]`;
    }
    return { text, usage: { inputTokens: approxTokens(input), outputTokens: approxTokens(text) } };
  }
}

const WORD = /[a-z0-9]+/g;

/**
 * Deterministic hashed bag-of-words embeddings. Texts that share words get higher cosine
 * similarity, which is enough for tests and demo mode. Downloads nothing.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'mock-embeddings';
  readonly dimensions: number;

  constructor(dimensions = 256) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    for (const word of text.toLowerCase().match(WORD) ?? []) {
      const digest = createHash('md5').update(word).digest();
      const idx = digest.readUInt32LE(0) % this.dimensions;
      vec[idx] = (vec[idx] ?? 0) + 1;
    }
    return vec;
  }
}
