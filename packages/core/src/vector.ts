/** SHARED CONTRACT. Swap implementations (e.g. sqlite-vec) without touching callers. */

export interface VectorHit {
  id: string;
  score: number;
}

export interface VectorIndex {
  upsert(id: string, vector: number[]): void;
  remove(id: string): void;
  /** Top-k by cosine similarity, optionally restricted to a set of ids. */
  search(query: number[], k: number, filterIds?: ReadonlySet<string>): VectorHit[];
  size(): number;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class InMemoryVectorIndex implements VectorIndex {
  private readonly vectors = new Map<string, number[]>();

  upsert(id: string, vector: number[]): void {
    this.vectors.set(id, vector);
  }

  remove(id: string): void {
    this.vectors.delete(id);
  }

  search(query: number[], k: number, filterIds?: ReadonlySet<string>): VectorHit[] {
    const hits: VectorHit[] = [];
    for (const [id, vec] of this.vectors) {
      if (filterIds && !filterIds.has(id)) continue;
      hits.push({ id, score: cosine(query, vec) });
    }
    // Deterministic order: score desc, then id asc.
    hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return hits.slice(0, k);
  }

  size(): number {
    return this.vectors.size;
  }
}
