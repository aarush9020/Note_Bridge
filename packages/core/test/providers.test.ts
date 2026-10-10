import { describe, expect, it } from 'vitest';
import { InMemoryVectorIndex, MockEmbeddingProvider, MockProvider, cosine } from '../src';

describe('MockProvider', () => {
  const req = { messages: [{ role: 'user' as const, content: 'What is velocity?' }] };

  it('is deterministic for the same prompt', async () => {
    const p = new MockProvider();
    const a = await p.complete(req);
    const b = await p.complete(req);
    expect(a.text).toBe(b.text);
    expect(a.usage.inputTokens).toBeGreaterThan(0);
  });

  it('differs for different prompts', async () => {
    const p = new MockProvider();
    const a = await p.complete(req);
    const b = await p.complete({ messages: [{ role: 'user', content: 'What is force?' }] });
    expect(a.text).not.toBe(b.text);
  });

  it('returns parseable JSON when json is requested', async () => {
    const out = await new MockProvider().complete({ ...req, json: true });
    expect(() => JSON.parse(out.text)).not.toThrow();
  });

  it('returns a registered fixed response', async () => {
    const p = new MockProvider().when(req, 'v = dx/dt');
    expect((await p.complete(req)).text).toBe('v = dx/dt');
  });
});

describe('MockEmbeddingProvider + InMemoryVectorIndex', () => {
  it('ranks texts that share words higher', async () => {
    const emb = new MockEmbeddingProvider();
    const [q, near, far] = await emb.embed([
      'acceleration is the rate of change of velocity',
      'velocity changes at the rate of acceleration',
      'the French revolution began in 1789',
    ]);
    expect(cosine(q!, near!)).toBeGreaterThan(cosine(q!, far!));
  });

  it('searches top-k, honours filters and removals', async () => {
    const emb = new MockEmbeddingProvider();
    const index = new InMemoryVectorIndex();
    const texts = ['newton second law force mass', 'kinematics velocity time', 'cooking pasta'];
    const vecs = await emb.embed(texts);
    vecs.forEach((v, i) => index.upsert(`c${i}`, v));
    const [q] = await emb.embed(['force and mass']);

    expect(index.size()).toBe(3);
    expect(index.search(q!, 1)[0]?.id).toBe('c0');
    expect(index.search(q!, 3, new Set(['c1', 'c2']))[0]?.id).toBe('c1');
    index.remove('c0');
    expect(index.search(q!, 3).map((h) => h.id)).not.toContain('c0');
  });

  it('cosine handles zero vectors', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});
