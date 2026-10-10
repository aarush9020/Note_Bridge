import { EXERCISE_START } from './patterns';
import type { OutlineItem, PageText, SectionDraft } from './types';

/** A heading found in document order, before parents and page ranges are computed. */
export type Draft = Omit<SectionDraft, 'index' | 'parentIndex' | 'pageEnd'>;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function median(xs: number[]): number {
  if (xs.length === 0) return 10;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 10;
}

export function structureFromOutline(outline: OutlineItem[], pages: PageText[]): Draft[] {
  const drafts: Draft[] = [];
  let lastPage = 1;
  const walk = (items: OutlineItem[], depth: number) => {
    for (const it of items) {
      if (it.title) {
        const page = it.page ?? lastPage;
        lastPage = Math.max(lastPage, page);
        const pg = pages.find((p) => p.page === lastPage);
        const target = norm(it.title);
        const line = pg ? pg.lines.findIndex((l) => norm(l.text) === target) : -1;
        drafts.push({
          title: it.title,
          level: depth,
          pageStart: lastPage,
          anchor: { page: lastPage, line },
          source: 'outline',
        });
      }
      walk(it.children, depth + 1);
    }
  };
  walk(outline, 1);
  return drafts;
}

const NUMBERED = /^(\d+(?:\.\d+){0,3})\.?\s+([A-Z][^.!?]{1,80})$/;
const CHAPTER = /^(?:chapter|unit|part)\s+\d+\b.*$/i;

export function structureFromHeadings(pages: PageText[]): Draft[] {
  const body = median(pages.flatMap((p) => p.lines.map((l) => l.size)));
  const drafts: Draft[] = [];
  for (const page of pages) {
    page.lines.forEach((line, idx) => {
      const t = line.text;
      if (t.length > 90 || EXERCISE_START.test(t)) return;
      // Skip running headers/footers: top and bottom 6% of the page.
      if (line.y > page.height * 0.94 || line.y < page.height * 0.06) return;

      const numbered = t.match(NUMBERED);
      let level: number | null = null;
      if (numbered?.[1]) {
        const parts = numbered[1].split('.').length;
        // "1 Kinematics" needs a bigger font to count; "2.3 Newton's Laws" is distinctive enough.
        if (parts > 1 || line.size >= body * 1.1) level = parts;
      } else if (CHAPTER.test(t)) {
        level = 1;
      } else if (line.size >= body * 1.4 && !/[.!?,;:]$/.test(t) && t.split(' ').length <= 12) {
        level = 1;
      }
      if (level === null) return;
      drafts.push({
        title: t,
        level,
        pageStart: page.page,
        anchor: { page: page.page, line: idx },
        source: 'heuristic',
      });
    });
  }
  return drafts;
}

/** Slides: every non-empty page is a unit, titled by its largest line. */
export function structureFromSlides(pages: PageText[]): Draft[] {
  const drafts: Draft[] = [];
  for (const page of pages) {
    if (page.lines.length === 0) continue;
    let titleIdx = 0;
    page.lines.forEach((l, i) => {
      if (l.size > (page.lines[titleIdx]?.size ?? 0) + 0.5) titleIdx = i;
    });
    drafts.push({
      title: page.lines[titleIdx]?.text ?? `Slide ${page.page}`,
      level: 1,
      pageStart: page.page,
      anchor: { page: page.page, line: titleIdx },
      source: 'slides',
    });
  }
  return drafts;
}
