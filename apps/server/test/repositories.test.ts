import { describe, expect, it } from 'vitest';
import { ingestDocument, MockEmbeddingProvider, MockProvider } from '@gyan/core';
import { decodeVector, encodeVector, sectionId } from '../src/db/repositories/ingest-store';
import { harness, samplePdf } from './ingest-helpers';

async function storedDocument() {
  const h = harness();
  const bytes = await samplePdf();
  h.deps.documents.createPending({
    id: 'doc1',
    courseId: 'course1',
    role: 'book',
    title: 'Physics',
    contentHash: 'h1',
  });
  const result = await ingestDocument({
    documentId: 'doc1',
    role: 'book',
    title: 'Physics',
    bytes,
    llm: new MockProvider(),
    embeddings: new MockEmbeddingProvider(32),
  });
  h.deps.store.save('doc1', result);
  return { h, result };
}

describe('IngestStore', () => {
  it('writes and reads back sections, chunks, exercises and embeddings', async () => {
    const { h, result } = await storedDocument();
    const { store, documents } = h.deps;

    const doc = documents.get('doc1')!;
    expect(doc.pageCount).toBe(2);
    expect(doc.pageOffset).toBe(result.pageOffset);

    const sections = store.sections('doc1');
    expect(sections.map((s) => s.title)).toEqual(result.sections.map((s) => s.title));
    expect(sections[1]!.parentId).toBe(sections[0]!.id);
    expect(sections[0]!.id).toBe(sectionId('doc1', 0));

    const chunks = store.chunks('doc1');
    expect(chunks.map((c) => c.id)).toEqual(result.chunks.map((c) => c.id));
    expect(chunks.every((c) => c.sectionId !== null)).toBe(true);
    expect(chunks[0]!.contextHeader).toBe(result.chunks[0]!.contextHeader);
    expect(chunks[0]!.nextId).toBe(chunks[1]?.id ?? null);

    const exercises = store.exercises('doc1');
    expect(exercises.map((e) => [e.label, e.hasSolution])).toEqual([
      ['Exercise 1.1', false],
      ['Exercise 2.1', true],
    ]);
    expect(exercises[1]!.solution).toBe('F = m a = 6 N.');

    const embs = store.embeddings('doc1');
    expect(embs).toHaveLength(chunks.length);
    expect(embs[0]!.vector).toHaveLength(32);
    expect(embs[0]!.vector.map((x) => Math.round(x))).toEqual(
      result.embeddings[0]!.map((x) => Math.round(x)),
    );
  });

  it('stores warnings and per-page quality on the document', async () => {
    const { h, result } = await storedDocument();
    expect(h.deps.documents.warnings('doc1')).toEqual(result.warnings);
    const row = h.db
      .prepare('SELECT page_quality, heading_source FROM documents WHERE id = ?')
      .get('doc1') as {
      page_quality: string;
      heading_source: string;
    };
    expect(JSON.parse(row.page_quality)).toHaveLength(2);
    expect(row.heading_source).toBe('heuristic');
  });

  it('deleting a document cascades to everything under it', async () => {
    const { h } = await storedDocument();
    h.deps.documents.delete('doc1');
    for (const table of ['sections', 'chunks', 'embeddings', 'exercises']) {
      const n = (h.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
      expect(n, table).toBe(0);
    }
  });

  it('save is atomic: a failure part-way leaves nothing behind', async () => {
    const { h, result } = await storedDocument();
    h.deps.documents.delete('doc1');
    h.deps.documents.createPending({
      id: 'doc2',
      courseId: 'course1',
      role: 'book',
      title: 'P',
      contentHash: 'h2',
    });
    // Two chunks with the same id violate the primary key partway through the transaction.
    const broken = { ...result, chunks: [...result.chunks, result.chunks[0]!] };
    expect(() => h.deps.store.save('doc2', broken)).toThrow();
    const sections = (
      h.db.prepare("SELECT COUNT(*) AS n FROM sections WHERE document_id = 'doc2'").get() as {
        n: number;
      }
    ).n;
    expect(sections).toBe(0);
    expect(h.deps.documents.get('doc2')).not.toBeNull();
  });
});

describe('vector encoding', () => {
  it('round-trips floats through the BLOB format', () => {
    const v = [0.5, -1.25, 3, 0];
    expect(decodeVector(encodeVector(v))).toEqual(v);
  });
});

describe('DocumentRepository', () => {
  it('only finds ready documents by content hash, scoped to the course', async () => {
    const h = harness();
    const { documents } = h.deps;
    documents.createPending({
      id: 'd1',
      courseId: 'course1',
      role: 'book',
      title: 'P',
      contentHash: 'abc',
    });
    expect(documents.findByHash('course1', 'abc')).toBeNull(); // still processing
    h.db.prepare("UPDATE documents SET status = 'ready' WHERE id = 'd1'").run();
    expect(documents.findByHash('course1', 'abc')?.id).toBe('d1');
    expect(documents.findByHash('other-course', 'abc')).toBeNull();
    expect(documents.listByCourse('course1').map((d) => d.id)).toEqual(['d1']);
  });
});
