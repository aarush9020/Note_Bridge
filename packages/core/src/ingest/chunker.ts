import { createHash } from 'node:crypto';
import type { ChunkKind } from '../types';
import { collectBodies, joinAtoms, toAtoms, toBlocks, type Atom, type Block } from './chunk-blocks';
import { contextHeader } from './headers';
import { countTokens } from './tokens';
import type { ChunkDraft, PageText, SectionDraft } from './types';

export interface ChunkOptions {
  minTokens?: number;
  maxTokens?: number;
}

export interface ChunkInput {
  documentId: string;
  docTitle: string;
  pages: PageText[];
  sections: SectionDraft[];
  /** Page quality score 0..1 by page; missing pages default to 1. */
  qualityByPage?: Map<number, number>;
  /** Pages to leave out entirely (rejected as garbled). */
  skipPages?: Set<number>;
}

/**
 * Structure-aware chunking: 200-400 tokens by default, never crossing a section boundary.
 * Definitions, examples, exercises and solutions are emitted whole (marked `oversize` if they
 * exceed the maximum). Ids are deterministic for the same input.
 */
export function chunkDocument(input: ChunkInput, opts: ChunkOptions = {}): ChunkDraft[] {
  const MIN = opts.minTokens ?? 200;
  const MAX = opts.maxTokens ?? 400;
  const bodies = collectBodies(input.pages, input.sections, input.skipPages);
  const out: ChunkDraft[] = [];
  const qualityOf = (page: number) => input.qualityByPage?.get(page) ?? 1;

  for (const section of input.sections) {
    const lines = bodies.get(section.index);
    if (!lines || lines.length === 0) continue;
    const header = contextHeader(input.docTitle, input.sections, section.index);
    const sectionStart = out.length;

    const emit = (
      kind: ChunkKind,
      text: string,
      page: number,
      exception?: ChunkDraft['exception'],
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const digest = createHash('sha1')
        .update(`${input.documentId}|${out.length}|${trimmed}`)
        .digest('hex')
        .slice(0, 16);
      const draft: ChunkDraft = {
        id: `ch_${digest}`,
        sectionIndex: section.index,
        kind,
        text: trimmed,
        contextHeader: header,
        page,
        tokenCount: countTokens(trimmed),
        quality: qualityOf(page),
        parentId: null,
        prevId: null,
        nextId: null,
      };
      if (exception) draft.exception = exception;
      out.push(draft);
    };

    let buffer: Atom[] = [];
    let atomBlockBase = 0;

    const flush = () => {
      if (buffer.length === 0) return;
      const text = joinAtoms(buffer);
      const tokens = countTokens(text);
      const prev = out.length > sectionStart ? out[out.length - 1] : undefined;
      if (
        tokens < MIN &&
        prev &&
        prev.kind === 'text' &&
        prev.exception !== 'oversize' &&
        prev.tokenCount + tokens <= MAX
      ) {
        // Fold a short tail into the previous chunk instead of leaving a tiny one.
        prev.text = `${prev.text}\n\n${text}`;
        prev.tokenCount = countTokens(prev.text);
        if (prev.tokenCount >= MIN) delete prev.exception;
      } else {
        emit('text', text, buffer[0]!.page, tokens < MIN ? 'short' : undefined);
      }
      buffer = [];
    };

    let pending: Block[] = [];
    const drainPending = () => {
      if (pending.length === 0) return;
      const atoms = toAtoms(pending, atomBlockBase, MAX);
      atomBlockBase += pending.length;
      pending = [];
      for (const atom of atoms) {
        const joined = joinAtoms(buffer);
        const withAtom = countTokens(buffer.length ? `${joined} ${atom.text}` : atom.text);
        if (buffer.length && withAtom > MAX) flush();
        buffer.push(atom);
      }
    };

    for (const block of toBlocks(lines)) {
      if (block.special) {
        drainPending();
        flush();
        const text = block.lines.map((l) => l.text).join(' ');
        const tokens = countTokens(text);
        emit(
          block.kind,
          text,
          block.lines[0]!.page,
          tokens > MAX ? 'oversize' : tokens < MIN ? 'short' : undefined,
        );
      } else {
        pending.push(block);
      }
    }
    drainPending();
    flush();
  }

  // Links: parent = the section's first chunk; prev/next follow reading order across the document.
  const leadBySection = new Map<number, string>();
  for (const c of out)
    if (!leadBySection.has(c.sectionIndex)) leadBySection.set(c.sectionIndex, c.id);
  out.forEach((c, i) => {
    const lead = leadBySection.get(c.sectionIndex);
    c.parentId = lead && lead !== c.id ? lead : null;
    c.prevId = out[i - 1]?.id ?? null;
    c.nextId = out[i + 1]?.id ?? null;
  });
  return out;
}
