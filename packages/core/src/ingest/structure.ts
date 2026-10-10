import type { SourceRole } from '../types';
import {
  structureFromHeadings,
  structureFromOutline,
  structureFromSlides,
  type Draft,
} from './structure-detect';
import type { HeadingSource, OutlineItem, PageText, SectionDraft } from './types';

/** Turn drafts (in document order) into final sections with parents and page ranges. */
export function finalizeSections(drafts: Draft[], lastPage: number): SectionDraft[] {
  const out: SectionDraft[] = [];
  const stack: SectionDraft[] = [];
  drafts.forEach((d, index) => {
    while (stack.length && (stack[stack.length - 1]?.level ?? 0) >= d.level) stack.pop();
    const parent = stack[stack.length - 1];
    const s: SectionDraft = {
      ...d,
      index,
      parentIndex: parent ? parent.index : null,
      pageEnd: lastPage,
    };
    out.push(s);
    stack.push(s);
  });
  for (const s of out) {
    const next = out.find((o) => o.index > s.index && o.level <= s.level);
    if (next) {
      const endsBefore = next.anchor.line <= 0 ? next.anchor.page - 1 : next.anchor.page;
      s.pageEnd = Math.max(s.pageStart, endsBefore);
    }
  }
  return out;
}

/** Content before the first heading would be lost, so give it its own section. */
function withLeadSection(drafts: Draft[], pages: PageText[], title: string): Draft[] {
  const first = drafts[0];
  const firstPage = pages.find((p) => p.lines.length > 0);
  if (!firstPage) return drafts;
  const hasLeadContent =
    !first ||
    first.anchor.page > firstPage.page ||
    (first.anchor.page === firstPage.page && first.anchor.line > 0);
  if (!hasLeadContent) return drafts;
  return [
    {
      title,
      level: 1,
      pageStart: firstPage.page,
      anchor: { page: firstPage.page, line: -1 },
      source: 'single',
    },
    ...drafts,
  ];
}

export interface StructureResult {
  sections: SectionDraft[];
  source: HeadingSource;
}

export function buildStructure(args: {
  pages: PageText[];
  outline: OutlineItem[];
  role: SourceRole;
  docTitle: string;
}): StructureResult {
  const { pages, outline, role, docTitle } = args;
  const firstPage = pages[0]?.page ?? 1;
  const lastPage = pages[pages.length - 1]?.page ?? 1;

  let drafts: Draft[] = [];
  let source: HeadingSource = 'single';

  if (role === 'slides') {
    drafts = structureFromSlides(pages);
    source = 'slides';
  } else {
    const fromOutline = structureFromOutline(outline, pages);
    if (fromOutline.length > 0) {
      drafts = fromOutline;
      source = 'outline';
    } else {
      const fromHeadings = structureFromHeadings(pages);
      if (fromHeadings.length > 0) {
        drafts = fromHeadings;
        source = 'heuristic';
      }
    }
  }

  if (drafts.length === 0) {
    drafts = [
      {
        title: docTitle,
        level: 1,
        pageStart: firstPage,
        anchor: { page: firstPage, line: -1 },
        source: 'single',
      },
    ];
    source = 'single';
  } else if (role !== 'slides') {
    drafts = withLeadSection(drafts, pages, docTitle);
  }
  return { sections: finalizeSections(drafts, lastPage), source };
}
