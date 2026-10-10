import { describe, expect, it } from 'vitest';
import { buildStructure, chunkDocument } from '../../src';
import { longSection, makePage, prose, run } from './helpers';

describe('chunkDocument structure and determinism', () => {
  it('never leaks the context header into display text', () => {
    const { chunks } = run(longSection());
    for (const c of chunks) {
      expect(c.contextHeader).toBe('Physics > 1 Kinematics');
      expect(c.text).not.toContain('Physics >');
      expect(c.text).not.toContain('1 Kinematics');
    }
  });

  it('links parent, prev and next consistently', () => {
    const { chunks } = run(longSection());
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]!.prevId).toBeNull();
    expect(chunks[chunks.length - 1]!.nextId).toBeNull();
    chunks.forEach((c, i) => {
      if (i > 0) expect(c.prevId).toBe(chunks[i - 1]!.id);
      if (i < chunks.length - 1) expect(c.nextId).toBe(chunks[i + 1]!.id);
    });
    expect(chunks[0]!.parentId).toBeNull();
    for (const c of chunks.slice(1)) expect(c.parentId).toBe(chunks[0]!.id);
  });

  it('never crosses a section boundary', () => {
    // Several body lines so the median font size is the body size, as in a real page.
    const body = (tag: string) => [prose(4, tag), prose(4, tag), prose(4, tag), prose(4, tag)];
    const pages = [
      makePage(1, [
        { text: '1 Kinematics', size: 20 },
        ...body('k'),
        { text: '2 Dynamics', size: 20 },
        ...body('d'),
      ]),
    ];
    const { chunks, sections } = run(pages);
    expect(sections).toHaveLength(2);
    for (const c of chunks) {
      expect(c.text.includes('object k') && c.text.includes('object d')).toBe(false);
    }
    expect(new Set(chunks.map((c) => c.sectionIndex)).size).toBe(2);
  });

  it('gives identical ids and text for the same input and new ids for another document', () => {
    const a = run(longSection());
    const b = run(longSection());
    expect(b.chunks.map((c) => c.id)).toEqual(a.chunks.map((c) => c.id));
    expect(b.chunks.map((c) => c.text)).toEqual(a.chunks.map((c) => c.text));
    expect(run(longSection(), 'Physics', 'doc2').chunks[0]!.id).not.toBe(a.chunks[0]!.id);
  });

  it('records the page and the quality score of each chunk', () => {
    const pages = [
      makePage(1, [{ text: '1 Intro', size: 20 }, prose(3)]),
      makePage(2, [prose(25, 'p')]),
    ];
    const { sections } = buildStructure({ pages, outline: [], role: 'book', docTitle: 'B' });
    const chunks = chunkDocument({
      documentId: 'd',
      docTitle: 'B',
      pages,
      sections,
      qualityByPage: new Map([
        [1, 0.9],
        [2, 0.4],
      ]),
    });
    expect(chunks[0]!.page).toBe(1);
    expect(chunks[0]!.quality).toBe(0.9);
    expect(chunks[chunks.length - 1]!.quality).toBe(0.4);
  });

  it('attributes each chunk to the page its text starts on, even when a paragraph spans pages', () => {
    const pages = [
      makePage(1, [{ text: '1 Intro', size: 20 }, prose(3, 'one')]),
      makePage(2, [prose(25, 'two')]),
    ];
    const { chunks } = run(pages);
    expect(chunks.length).toBeGreaterThan(1);
    const last = chunks[chunks.length - 1]!;
    expect(last.page).toBe(2);
    expect(last.text).toContain('object two');
    expect(last.text).not.toContain('object one');
    expect(chunks[0]!.page).toBe(1);
  });

  it('leaves out skipped pages', () => {
    const pages = [
      makePage(1, [{ text: '1 Intro', size: 20 }, prose(2, 'keep')]),
      makePage(2, [prose(2, 'drop')]),
    ];
    const { sections } = buildStructure({ pages, outline: [], role: 'book', docTitle: 'B' });
    const chunks = chunkDocument({
      documentId: 'd',
      docTitle: 'B',
      pages,
      sections,
      skipPages: new Set([2]),
    });
    expect(chunks.map((c) => c.text).join(' ')).not.toContain('drop');
  });
});
