import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { IngestError, type Line, type OutlineItem, type PageText } from './types';

const require = createRequire(import.meta.url);

function fontDataPath(): string {
  const pkg = require.resolve('pdfjs-dist/package.json');
  return join(dirname(pkg), 'standard_fonts') + '/';
}

interface RawItem {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
  hasEOL: boolean;
}

export interface PdfContent {
  pageCount: number;
  pages: PageText[];
  outline: OutlineItem[];
}

const IMAGE_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
]);

/** Group positioned text items into visual lines. Exported for unit testing. */
export function itemsToLines(items: RawItem[]): Line[] {
  const sorted = items.filter((i) => i.str.length > 0).sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: RawItem[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    const rowY = row?.[0]?.y;
    if (row && rowY !== undefined && Math.abs(rowY - item.y) <= Math.max(2, item.size * 0.4)) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }

  const lines: Line[] = [];
  let prevY: number | null = null;
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let text = '';
    let endX = 0;
    for (const it of row) {
      if (text && it.x - endX > it.size * 0.15 && !text.endsWith(' ') && !it.str.startsWith(' ')) {
        text += ' ';
      }
      text += it.str;
      endX = it.x + it.width;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const first = row[0]!;
    const size = Math.max(...row.map((r) => r.size));
    // Measured against the size of the line after the gap, so a gap below a big heading counts.
    const gapBefore = prevY !== null && prevY - first.y > size * 1.6;
    lines.push({ text, x: first.x, y: first.y, size, gapBefore });
    prevY = first.y;
  }
  return lines;
}

type PdfDoc = Awaited<ReturnType<typeof getDocument>['promise']>;

async function resolveDestPage(doc: PdfDoc, dest: unknown): Promise<number | null> {
  try {
    const resolved = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(resolved) || resolved.length === 0) return null;
    const ref = resolved[0] as unknown;
    if (typeof ref === 'number') return ref + 1;
    return (await doc.getPageIndex(ref as Parameters<PdfDoc['getPageIndex']>[0])) + 1;
  } catch {
    return null;
  }
}

async function readOutline(doc: PdfDoc): Promise<OutlineItem[]> {
  const raw = await doc.getOutline();
  if (!raw) return [];
  const walk = async (nodes: typeof raw): Promise<OutlineItem[]> => {
    const out: OutlineItem[] = [];
    for (const n of nodes) {
      out.push({
        title: String(n.title ?? '').trim(),
        page: await resolveDestPage(doc, n.dest),
        children: await walk(n.items ?? []),
      });
    }
    return out;
  };
  return walk(raw);
}

/** Extract text per page, plus the PDF outline when one exists. */
export async function extractPdf(data: Uint8Array): Promise<PdfContent> {
  let doc: PdfDoc;
  const task = getDocument({
    // pdfjs transfers the buffer to its worker, so hand it a copy.
    data: new Uint8Array(data),
    standardFontDataUrl: fontDataPath(),
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    doc = await task.promise;
  } catch (err) {
    await task.destroy().catch(() => undefined);
    throw new IngestError(
      `Could not open PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const pages: PageText[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: RawItem[] = [];
      for (const it of content.items) {
        if (!('str' in it)) continue;
        const t = it.transform as number[];
        items.push({
          str: it.str,
          x: t[4] ?? 0,
          y: t[5] ?? 0,
          width: it.width,
          size: Math.hypot(t[0] ?? 0, t[1] ?? 0) || it.height || 10,
          hasEOL: it.hasEOL,
        });
      }
      const ops = await page.getOperatorList();
      const hasImages = ops.fnArray.some((fn) => IMAGE_OPS.has(fn));
      const lines = itemsToLines(items);
      pages.push({
        page: p,
        width: viewport.width,
        height: viewport.height,
        lines,
        text: lines.map((l) => l.text).join('\n'),
        hasImages,
      });
      page.cleanup();
    }
    return { pageCount: doc.numPages, pages, outline: await readOutline(doc) };
  } finally {
    await task.destroy();
  }
}
