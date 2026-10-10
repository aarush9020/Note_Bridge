import { PDFDocument, StandardFonts } from 'pdf-lib';
import { MockEmbeddingProvider, MockProvider } from '@gyan/core';
import { openDb } from '../src/db';
import { DocumentRepository } from '../src/db/repositories/documents';
import { IngestStore } from '../src/db/repositories/ingest-store';
import { JobRepository } from '../src/db/repositories/jobs';
import { JobRunner, ProgressBus, type IngestDeps } from '../src/jobs';

const sentence = (tag: string, i: number) =>
  `The object ${tag}${i} moves with constant velocity along the axis in time.`;

/** A small real PDF: 2 chapters, an exercise with and one without a solution, footers 5-6. */
export async function samplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages: Array<{ lines: Array<[string, number]>; footer: string }> = [
    {
      lines: [
        ['1 Kinematics', 20],
        ['1.1 Velocity', 15],
        [Array.from({ length: 6 }, (_, i) => sentence('v', i)).join(' '), 11],
        ['Exercise 1.1 A cart moves at 4 m/s for 3 s. Find the displacement.', 11],
      ],
      footer: '5',
    },
    {
      lines: [
        ['2 Newton Laws', 20],
        ['2.1 Second law', 15],
        [Array.from({ length: 6 }, (_, i) => sentence('f', i)).join(' '), 11],
        ['Exercise 2.1 A 2 kg mass accelerates at 3 m/s2. Find the net force.', 11],
        ['Solution to Exercise 2.1: F = m a = 6 N.', 11],
      ],
      footer: '6',
    },
  ];
  for (const spec of pages) {
    const page = doc.addPage([612, 792]);
    let y = 740;
    for (const [text, size] of spec.lines) {
      const words = text.split(' ');
      let row = '';
      const rows: string[] = [];
      for (const w of words) {
        const next = row ? `${row} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) > 468 && row) {
          rows.push(row);
          row = w;
        } else row = next;
      }
      rows.push(row);
      rows.forEach((r, i) => {
        y -= size * 1.4;
        if (i === 0) y -= size * 0.9;
        page.drawText(r, { x: 72, y, size, font });
      });
    }
    page.drawText(spec.footer, { x: 300, y: 30, size: 9, font });
  }
  return doc.save();
}

export interface Harness {
  db: ReturnType<typeof openDb>;
  deps: IngestDeps;
  bus: ProgressBus;
  jobs: JobRepository;
  llm: MockProvider;
  embedCalls: () => number;
}

/** In-memory database plus real repositories and a runner. Counts embedding calls. */
export function harness(overrides: Partial<IngestDeps> = {}): Harness {
  const db = openDb(':memory:');
  const documents = new DocumentRepository(db);
  documents.ensureCourse('course1', 'Physics 101');
  const jobs = new JobRepository(db);
  const bus = new ProgressBus();
  const base = new MockEmbeddingProvider(32);
  let calls = 0;
  const embeddings = {
    id: base.id,
    dimensions: base.dimensions,
    embed: (t: string[]) => {
      calls++;
      return base.embed(t);
    },
  };
  const llm = new MockProvider();
  const deps: IngestDeps = {
    documents,
    store: new IngestStore(db),
    runner: new JobRunner(jobs, bus),
    llm,
    embeddings,
    ...overrides,
  };
  return { db, deps, bus, jobs, llm, embedCalls: () => calls };
}
