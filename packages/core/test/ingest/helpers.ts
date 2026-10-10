import { PDFDocument, StandardFonts } from 'pdf-lib';
import { buildStructure, chunkDocument, type PageText } from '../../src';

/** A valid 1x1 PNG. Used as an "image" in test PDFs and for the vision mock. */
export const TINY_PNG = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);

export interface Para {
  text: string;
  size?: number;
  /** Leave a paragraph gap before this paragraph (default true, except the first on a page). */
  gap?: boolean;
}

export interface PageSpec {
  paras: Para[];
  /** Printed page number text drawn at the bottom of the page. */
  footer?: string;
  /** Draw the tiny test image on the page. */
  image?: boolean;
}

/** Deterministic prose: `n` distinct sentences built from common physics words. */
export function prose(n: number, tag = ''): string {
  return Array.from(
    { length: n },
    (_, i) => `The object ${tag}${i} moves with constant velocity along the axis in time.`,
  ).join(' ');
}

/** Build a real PDF with pdf-lib (no binary fixtures are committed). */
export async function buildPdf(pages: PageSpec[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const png = pages.some((p) => p.image) ? await doc.embedPng(TINY_PNG) : null;

  for (const spec of pages) {
    const page = doc.addPage([612, 792]);
    let y = 740;
    let first = true;
    for (const para of spec.paras) {
      const size = para.size ?? 11;
      const words = para.text.split(/\s+/);
      let line = '';
      const rows: string[] = [];
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) > 468 && line) {
          rows.push(line);
          line = w;
        } else {
          line = next;
        }
      }
      if (line) rows.push(line);
      rows.forEach((row, i) => {
        y -= size * 1.4;
        if (i === 0 && !first && para.gap !== false) y -= size * 0.9;
        page.drawText(row, { x: 72, y, size, font });
      });
      first = false;
    }
    if (png && spec.image) page.drawImage(png, { x: 72, y: 300, width: 100, height: 100 });
    if (spec.footer) page.drawText(spec.footer, { x: 300, y: 30, size: 9, font });
  }
  return doc.save();
}

export interface LineSpec {
  text: string;
  size?: number;
  gap?: boolean;
}

/** Structure + chunk a set of pages with the default (book) settings. */
export function run(pages: PageText[], docTitle = 'Physics', documentId = 'doc1') {
  const { sections } = buildStructure({ pages, outline: [], role: 'book', docTitle });
  return { sections, chunks: chunkDocument({ documentId, docTitle, pages, sections }) };
}

/** One long section: prose, a definition, prose, an example, prose. */
export const longSection = () => [
  makePage(1, [
    { text: '1 Kinematics', size: 20 },
    prose(30, 'a'),
    { text: 'Definition. Velocity is the rate of change of position with time.', gap: true },
    prose(20, 'b'),
    {
      text: 'Example 1. A cart moves with constant velocity along the axis for a time.',
      gap: true,
    },
    prose(20, 'c'),
  ]),
];

/** Build a PageText directly (no PDF), for fast unit tests of structure and chunking. */
export function makePage(page: number, lines: Array<string | LineSpec>): PageText {
  let y = 700;
  const out: PageText['lines'] = [];
  lines.forEach((l, i) => {
    const spec = typeof l === 'string' ? { text: l } : l;
    y -= 16;
    out.push({
      text: spec.text,
      x: 72,
      y,
      size: spec.size ?? 11,
      gapBefore: i > 0 && spec.gap !== false,
    });
  });
  return {
    page,
    width: 612,
    height: 792,
    lines: out,
    text: out.map((l) => l.text).join('\n'),
    hasImages: false,
  };
}
