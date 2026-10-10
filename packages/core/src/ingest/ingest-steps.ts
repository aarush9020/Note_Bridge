import type { EmbeddingProvider, LLMProvider } from '../providers/llm';
import type { SourceRole } from '../types';
import { assessTranscription, pageFromText, sniffImageType, transcribeImage } from './handwriting';
import { extractPdf } from './pdf';
import type { OutlineItem, PageQuality, PageText, ProgressFn } from './types';

export interface IngestInput {
  documentId: string;
  role: SourceRole;
  title: string;
  bytes: Uint8Array;
  llm: LLMProvider;
  embeddings: EmbeddingProvider;
  onProgress?: ProgressFn;
  /**
   * Optional: render a PDF page to a PNG so the vision fallback can read it. Without it,
   * pages that need vision are skipped with a warning (rendering needs a canvas library).
   */
  renderPage?: (page: number) => Promise<Uint8Array>;
}

/** Progress never goes backwards, whatever order stages report in. */
export function monotonic(onProgress?: ProgressFn): ProgressFn {
  let last = 0;
  return (p) => {
    last = Math.max(last, p.progress);
    onProgress?.({ ...p, progress: last });
  };
}

export interface LoadedPages {
  pages: PageText[];
  pageCount: number;
  outline: OutlineItem[];
}

export async function loadPages(
  input: IngestInput,
  warnings: string[],
  report: ProgressFn,
): Promise<LoadedPages> {
  if (sniffImageType(input.bytes)) {
    report({ stage: 'transcribe', progress: 0.1, message: 'Reading image' });
    const t = await transcribeImage(input.llm, input.bytes);
    if (t.lowConfidence) {
      warnings.push('Handwriting transcription has low confidence; review the text.');
    }
    return { pages: [pageFromText(1, t.text)], pageCount: 1, outline: [] };
  }
  report({ stage: 'extract', progress: 0.05, message: 'Extracting text' });
  const pdf = await extractPdf(input.bytes);
  return { pages: pdf.pages, pageCount: pdf.pageCount, outline: pdf.outline };
}

/** Replace pages that need vision with transcribed text when a renderer is available. */
export async function applyVision(
  input: IngestInput,
  pages: PageText[],
  quality: PageQuality[],
  warnings: string[],
): Promise<void> {
  for (const q of quality) {
    if (q.verdict !== 'vision') continue;
    const idx = pages.findIndex((p) => p.page === q.page);
    if (!input.renderPage || !input.llm.vision || idx < 0) {
      warnings.push(
        `Page ${q.page} needs vision (${q.reasons.join('; ')}) but no page renderer is available; skipped.`,
      );
      q.verdict = 'reject';
      continue;
    }
    const png = await input.renderPage(q.page);
    const t = await transcribeImage(input.llm, png);
    const replaced = pageFromText(q.page, t.text);
    pages[idx] = replaced;
    const re = assessTranscription(replaced);
    q.score = re.score;
    q.verdict = re.verdict === 'ok' ? 'ok' : 'reject';
    if (t.lowConfidence) warnings.push(`Page ${q.page}: vision transcription has low confidence.`);
  }
}

export async function summarize(
  llm: LLMProvider,
  title: string,
  text: string,
): Promise<string | null> {
  if (!text.trim()) return null;
  const res = await llm.complete({
    messages: [
      {
        role: 'system',
        content: 'Summarize this course section in one or two plain sentences. No preamble.',
      },
      { role: 'user', content: `Section: ${title}\n\n${text.slice(0, 3000)}` },
    ],
    maxTokens: 120,
    temperature: 0,
  });
  return res.text.trim() || null;
}
