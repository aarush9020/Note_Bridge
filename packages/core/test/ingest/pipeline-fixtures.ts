import { MockEmbeddingProvider, MockProvider, type IngestInput } from '../../src';
import { buildPdf, prose } from './helpers';

export const embeddings = new MockEmbeddingProvider(64);

/** A 3-page "book": two chapters, a definition, two exercises (one with a solution), footers 12-14. */
export async function bookBytes(): Promise<Uint8Array> {
  const body = (tag: string) => prose(12, tag);
  return buildPdf([
    {
      paras: [
        { text: '1 Kinematics', size: 20 },
        { text: '1.1 Velocity', size: 15 },
        { text: body('v') },
        { text: 'Definition. Velocity is the rate of change of position with time.' },
        { text: 'Exercise 1.1 A cart moves at 4 m/s for 3 s. Find the displacement.' },
      ],
      footer: '12',
    },
    {
      paras: [
        { text: '1.2 Acceleration', size: 15 },
        { text: body('a') },
        { text: 'Exercise 1.2 A ball falls for 2 s. Find its final speed.' },
        { text: 'Solution to Exercise 1.2: v = g t = 19.6 m/s.' },
      ],
      footer: '13',
    },
    {
      paras: [
        { text: '2 Newton Laws', size: 20 },
        { text: '2.1 Second law', size: 15 },
        { text: body('f') },
      ],
      footer: '14',
    },
  ]);
}

export function ingestInput(bytes: Uint8Array, extra: Partial<IngestInput> = {}): IngestInput {
  return {
    documentId: 'doc1',
    role: 'book',
    title: 'Physics',
    bytes,
    llm: new MockProvider(),
    embeddings,
    ...extra,
  };
}
