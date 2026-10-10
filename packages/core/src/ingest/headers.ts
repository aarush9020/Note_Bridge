import type { SectionDraft } from './types';

/** Titles from the root section down to `section`. */
export function sectionPath(sections: SectionDraft[], index: number): string[] {
  const path: string[] = [];
  let cur: SectionDraft | undefined = sections[index];
  const seen = new Set<number>();
  while (cur && !seen.has(cur.index)) {
    seen.add(cur.index);
    path.unshift(cur.title);
    cur = cur.parentIndex === null ? undefined : sections[cur.parentIndex];
  }
  return path;
}

/**
 * Context header, e.g. "Physics Book > 2 Newton's Laws > 2.3 Second law". It is prepended to the
 * text only when computing embeddings. It is never shown to users and never quoted.
 */
export function contextHeader(docTitle: string, sections: SectionDraft[], index: number): string {
  return [docTitle, ...sectionPath(sections, index)].join(' > ');
}
