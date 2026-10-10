import type { ChunkKind } from '../types';
import { DEFINITION_START, EXAMPLE_START, EXERCISE_START, SOLUTION_START } from './patterns';
import { countTokens } from './tokens';
import type { PageText, SectionDraft } from './types';

export interface BodyLine {
  text: string;
  page: number;
  gapBefore: boolean;
}

export interface Block {
  kind: ChunkKind;
  /** Definitions, examples, exercises and solutions are kept whole. */
  special: boolean;
  lines: BodyLine[];
}

export interface Atom {
  text: string;
  page: number;
  block: number;
}

function classify(text: string): { kind: ChunkKind; special: boolean } | null {
  if (EXERCISE_START.test(text)) return { kind: 'exercise', special: true };
  if (/^solution\b/i.test(text) && SOLUTION_START.test(text))
    return { kind: 'text', special: true };
  if (DEFINITION_START.test(text)) return { kind: 'definition', special: true };
  if (EXAMPLE_START.test(text)) return { kind: 'example', special: true };
  return null;
}

/** Assign every body line to the section it belongs to; heading lines are dropped. */
export function collectBodies(
  pages: PageText[],
  sections: SectionDraft[],
  skipPages?: Set<number>,
): Map<number, BodyLine[]> {
  const bodies = new Map<number, BodyLine[]>();
  let cur = -1;
  let k = 0;
  for (const page of pages) {
    if (skipPages?.has(page.page)) continue;
    page.lines.forEach((line, idx) => {
      let isHeading = false;
      while (k < sections.length) {
        const a = sections[k]!.anchor;
        if (a.page < page.page || (a.page === page.page && a.line <= idx)) {
          cur = k;
          if (a.page === page.page && a.line === idx) isHeading = true;
          k++;
        } else break;
      }
      if (isHeading || cur < 0) return;
      const arr = bodies.get(cur) ?? [];
      arr.push({ text: line.text, page: page.page, gapBefore: line.gapBefore });
      bodies.set(cur, arr);
    });
  }
  return bodies;
}

export function toBlocks(lines: BodyLine[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of lines) {
    const kw = classify(line.text);
    if (kw) {
      current = { kind: kw.kind, special: kw.special, lines: [line] };
      blocks.push(current);
    } else if (!current || line.gapBefore) {
      current = { kind: 'text', special: false, lines: [line] };
      blocks.push(current);
    } else {
      current.lines.push(line);
    }
  }
  return blocks;
}

function splitLongWords(text: string, limit: number): string[] {
  const parts: string[] = [];
  let buf: string[] = [];
  for (const w of text.split(/\s+/)) {
    buf.push(w);
    if (countTokens(buf.join(' ')) > limit && buf.length > 1) {
      buf.pop();
      parts.push(buf.join(' '));
      buf = [w];
    }
  }
  if (buf.length) parts.push(buf.join(' '));
  return parts;
}

const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9(])/g;

/** Split text into sentences, keeping each sentence's start offset in the original string. */
function sentencesWithOffsets(text: string): Array<{ text: string; start: number }> {
  const out: Array<{ text: string; start: number }> = [];
  let start = 0;
  for (const m of text.matchAll(SENTENCE_BREAK)) {
    const end = m.index ?? 0;
    if (end > start) out.push({ text: text.slice(start, end), start });
    start = end + m[0].length;
  }
  if (start < text.length) out.push({ text: text.slice(start), start });
  return out;
}

/**
 * Break blocks into sentence-sized pieces so chunks can be packed up to the token limit.
 * Each piece carries the page its first character is on, even when a paragraph runs across a page
 * break, so a chunk's page (and therefore its citation) is accurate.
 */
export function toAtoms(blocks: Block[], blockOffset: number, maxTokens: number): Atom[] {
  const atoms: Atom[] = [];
  blocks.forEach((b, bi) => {
    // Page boundaries as character offsets into the block's joined text.
    const starts: Array<{ at: number; page: number }> = [];
    let text = '';
    for (const line of b.lines) {
      starts.push({ at: text.length, page: line.page });
      text += (text ? ' ' : '') + line.text;
      // The separator space belongs to the previous line, so shift the next start past it.
    }
    const pageAt = (offset: number): number => {
      let page = b.lines[0]?.page ?? 1;
      for (const s of starts) {
        if (s.at + (s.at > 0 ? 1 : 0) <= offset) page = s.page;
        else break;
      }
      return page;
    };
    for (const s of sentencesWithOffsets(text)) {
      const page = pageAt(s.start);
      const pieces =
        countTokens(s.text) > maxTokens / 2
          ? splitLongWords(s.text, Math.floor(maxTokens / 2))
          : [s.text];
      for (const p of pieces) atoms.push({ text: p, page, block: blockOffset + bi });
    }
  });
  return atoms;
}

export function joinAtoms(atoms: Atom[]): string {
  let out = '';
  atoms.forEach((a, i) => {
    if (i === 0) out = a.text;
    else out += (atoms[i - 1]!.block === a.block ? ' ' : '\n\n') + a.text;
  });
  return out;
}
