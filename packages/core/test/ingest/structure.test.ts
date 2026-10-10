import { describe, expect, it } from 'vitest';
import { buildStructure, contextHeader, type OutlineItem } from '../../src';
import { makePage, prose } from './helpers';

const chapterPages = () => [
  makePage(1, [
    { text: '1 Kinematics', size: 20 },
    { text: '1.1 Velocity', size: 15 },
    prose(2),
    { text: '1.2 Acceleration', size: 15 },
    prose(2),
  ]),
  makePage(2, [
    { text: '2 Newton Laws', size: 20 },
    { text: '2.1 Second law', size: 15 },
    prose(2),
  ]),
];

describe('buildStructure (heuristic)', () => {
  it('finds numbered headings, levels and parents', () => {
    const { sections, source } = buildStructure({
      pages: chapterPages(),
      outline: [],
      role: 'book',
      docTitle: 'Physics',
    });
    expect(source).toBe('heuristic');
    expect(sections.map((s) => [s.title, s.level, s.parentIndex])).toEqual([
      ['1 Kinematics', 1, null],
      ['1.1 Velocity', 2, 0],
      ['1.2 Acceleration', 2, 0],
      ['2 Newton Laws', 1, null],
      ['2.1 Second law', 2, 3],
    ]);
  });

  it('computes page ranges that end before the next sibling heading', () => {
    const { sections } = buildStructure({
      pages: chapterPages(),
      outline: [],
      role: 'book',
      docTitle: 'Physics',
    });
    const ch1 = sections[0]!;
    expect(ch1.pageStart).toBe(1);
    expect(ch1.pageEnd).toBe(1);
    expect(sections[3]!.pageStart).toBe(2);
  });

  it('does not treat exercise lines or long sentences as headings', () => {
    const pages = [
      makePage(1, [
        { text: '1 Intro', size: 20 },
        'Exercise 1.1 Find the velocity of the object.',
        'The object moves with constant velocity along the axis in time and then stops.',
      ]),
    ];
    const { sections } = buildStructure({ pages, outline: [], role: 'book', docTitle: 'B' });
    expect(sections.map((s) => s.title)).toEqual(['1 Intro']);
  });

  it('falls back to a single section named after the document when nothing looks like a heading', () => {
    const pages = [makePage(1, [prose(2), prose(2)])];
    const { sections, source } = buildStructure({
      pages,
      outline: [],
      role: 'notes',
      docTitle: 'My Notes',
    });
    expect(source).toBe('single');
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe('My Notes');
  });

  it('adds a lead section for content before the first heading', () => {
    const pages = [makePage(1, [prose(1), { text: '1 Kinematics', size: 20 }, prose(1)])];
    const { sections } = buildStructure({ pages, outline: [], role: 'book', docTitle: 'Physics' });
    expect(sections[0]!.title).toBe('Physics');
    expect(sections[1]!.title).toBe('1 Kinematics');
  });
});

describe('buildStructure (outline)', () => {
  it('prefers the PDF outline and keeps its nesting', () => {
    const outline: OutlineItem[] = [
      {
        title: '1 Kinematics',
        page: 1,
        children: [
          { title: '1.1 Velocity', page: 1, children: [] },
          { title: '1.2 Acceleration', page: 1, children: [] },
        ],
      },
      { title: '2 Newton Laws', page: 2, children: [] },
    ];
    const { sections, source } = buildStructure({
      pages: chapterPages(),
      outline,
      role: 'book',
      docTitle: 'Physics',
    });
    expect(source).toBe('outline');
    expect(sections.map((s) => [s.title, s.level, s.parentIndex])).toEqual([
      ['1 Kinematics', 1, null],
      ['1.1 Velocity', 2, 0],
      ['1.2 Acceleration', 2, 0],
      ['2 Newton Laws', 1, null],
    ]);
  });

  it('uses the last known page when an outline entry has no destination', () => {
    const outline: OutlineItem[] = [
      { title: 'A', page: 2, children: [] },
      { title: 'B', page: null, children: [] },
    ];
    const { sections } = buildStructure({
      pages: chapterPages(),
      outline,
      role: 'book',
      docTitle: 'Physics',
    });
    expect(sections.find((s) => s.title === 'B')!.pageStart).toBe(2);
  });
});

describe('buildStructure (slides)', () => {
  it('makes one section per slide, titled by the largest line', () => {
    const pages = [
      makePage(1, [{ text: 'Velocity', size: 24 }, 'v = dx/dt', 'units: m/s']),
      makePage(2, ['small first line', { text: 'Newton Second Law', size: 24 }, 'F = m a']),
    ];
    const { sections, source } = buildStructure({
      pages,
      outline: [],
      role: 'slides',
      docTitle: 'Lecture 1',
    });
    expect(source).toBe('slides');
    expect(sections.map((s) => s.title)).toEqual(['Velocity', 'Newton Second Law']);
    expect(sections.every((s) => s.parentIndex === null)).toBe(true);
  });
});

describe('contextHeader', () => {
  it('joins document and section path', () => {
    const { sections } = buildStructure({
      pages: chapterPages(),
      outline: [],
      role: 'book',
      docTitle: 'Physics',
    });
    expect(contextHeader('Physics', sections, 4)).toBe('Physics > 2 Newton Laws > 2.1 Second law');
  });
});
