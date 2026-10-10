import type { LLMProvider } from '../providers/llm';
import { assessPage, textMetrics } from './quality';
import { IngestError, type Line, type PageText } from './types';

export interface Transcription {
  text: string;
  /** 0..1 from the same garble metrics used for PDF pages; never taken from the model itself. */
  confidence: number;
  lowConfidence: boolean;
}

const PROMPT =
  'Transcribe this image exactly as written. Keep line breaks. Write formulas in plain text. ' +
  'Mark unreadable words as [?]. Do not add commentary.';

export function sniffImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e)
    return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  return null;
}

/** Turn an image (handwritten notes, scanned page) into text with the provider's vision call. */
export async function transcribeImage(
  llm: LLMProvider,
  image: Uint8Array,
  lowConfidenceBelow = 0.5,
): Promise<Transcription> {
  if (!llm.vision) throw new IngestError(`Provider "${llm.id}" has no vision support`);
  const mimeType = sniffImageType(image);
  if (!mimeType) throw new IngestError('Unsupported image type (expected PNG or JPEG)');
  const res = await llm.vision({ image, mimeType, prompt: PROMPT, maxTokens: 2000 });
  const text = res.text.trim();
  const unknown = (text.match(/\[\?\]/g) ?? []).length;
  const m = textMetrics(text);
  const words = Math.max(1, m.words + unknown);
  const confidence = Math.max(0, Math.min(1, (m.dictRatio / 0.2) * (1 - unknown / words)));
  return { text, confidence, lowConfidence: confidence < lowConfidenceBelow };
}

/** Build a one-page PageText from transcribed text so it flows through the normal pipeline. */
export function pageFromText(page: number, text: string, size = 11): PageText {
  const rows = text.split(/\r?\n/).map((t) => t.trim());
  const lines: Line[] = [];
  let y = 760;
  let gap = false;
  for (const t of rows) {
    if (!t) {
      gap = true;
      continue;
    }
    lines.push({ text: t, x: 72, y, size, gapBefore: gap && lines.length > 0 });
    y -= size * 1.4;
    gap = false;
  }
  return {
    page,
    width: 612,
    height: 792,
    lines,
    text: lines.map((l) => l.text).join('\n'),
    hasImages: false,
  };
}

/** Quality verdict for transcribed text (reuses the page assessor). */
export function assessTranscription(page: PageText) {
  return assessPage(page);
}
