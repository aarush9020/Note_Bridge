import { describe, expect, it } from 'vitest';
import type { JobProgress } from '@gyan/core';
import { startIngest } from '../src/jobs';
import { harness, samplePdf } from './ingest-helpers';

const request = async () => ({
  courseId: 'course1',
  role: 'book' as const,
  title: 'Physics',
  bytes: await samplePdf(),
});

function record(h: ReturnType<typeof harness>, jobId: string): JobProgress[] {
  const events: JobProgress[] = [];
  h.bus.subscribe(jobId, (p) => events.push(p));
  return events;
}

describe('startIngest', () => {
  it('runs a job queued -> running -> done and stores the document', async () => {
    const h = harness();
    const { jobId, documentId, cached } = startIngest(h.deps, await request());
    const events = record(h, jobId);
    expect(cached).toBe(false);
    await h.deps.runner.idle();

    const statuses = events.map((e) => e.status);
    expect(statuses[0]).toBe('queued');
    expect(statuses).toContain('running');
    expect(statuses[statuses.length - 1]).toBe('done');
    const progress = events.map((e) => e.progress);
    for (let i = 1; i < progress.length; i++)
      expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);

    expect(h.jobs.get(jobId)).toMatchObject({
      status: 'done',
      progress: 1,
      documentId,
      error: null,
    });
    expect(h.deps.documents.get(documentId)).not.toBeNull();
    expect(h.deps.store.chunks(documentId).length).toBeGreaterThan(0);
    expect(h.deps.store.exercises(documentId)).toHaveLength(2);
  });

  it('lets a late subscriber see the final state', async () => {
    const h = harness();
    const { jobId } = startIngest(h.deps, await request());
    await h.deps.runner.idle();
    const events = record(h, jobId);
    expect(events).toHaveLength(1);
    expect(events[0]!.status).toBe('done');
  });

  it('skips all work when the same file is ingested again (cache hit)', async () => {
    const h = harness();
    const req = await request();
    const first = startIngest(h.deps, req);
    await h.deps.runner.idle();
    const callsAfterFirst = h.embedCalls();
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = startIngest(h.deps, { ...req, bytes: new Uint8Array(req.bytes) });
    await h.deps.runner.idle();

    expect(second.cached).toBe(true);
    expect(second.documentId).toBe(first.documentId);
    expect(second.jobId).not.toBe(first.jobId);
    expect(h.embedCalls()).toBe(callsAfterFirst);
    expect(h.jobs.get(second.jobId)).toMatchObject({ status: 'done', message: 'Done' });
    const docs = h.deps.documents.listByCourse('course1');
    expect(docs).toHaveLength(1);
  });

  it('ingests the same file into a different course as a separate document', async () => {
    const h = harness();
    h.deps.documents.ensureCourse('course2', 'Chem');
    const req = await request();
    const a = startIngest(h.deps, req);
    const b = startIngest(h.deps, { ...req, courseId: 'course2' });
    await h.deps.runner.idle();
    expect(b.cached).toBe(false);
    expect(b.documentId).not.toBe(a.documentId);
  });

  it('ends as failed with a readable message, and leaves no stuck document', async () => {
    const h = harness();
    const { jobId, documentId } = startIngest(h.deps, {
      courseId: 'course1',
      role: 'book',
      title: 'Broken',
      bytes: new Uint8Array([1, 2, 3, 4, 5]),
    });
    const events = record(h, jobId);
    await h.deps.runner.idle();

    const last = events[events.length - 1]!;
    expect(last.status).toBe('failed');
    expect(last.message).toMatch(/Could not open PDF/);
    expect(h.jobs.get(jobId)).toMatchObject({ status: 'failed' });
    expect(h.jobs.get(jobId)!.error).toMatch(/Could not open PDF/);
    // The pending row is removed, so the same file can be retried later.
    expect(h.deps.documents.get(documentId)).toBeNull();
  });

  it('lets a failed upload be retried with a fixed file', async () => {
    const h = harness();
    const bad = startIngest(h.deps, {
      courseId: 'course1',
      role: 'book',
      title: 'X',
      bytes: new Uint8Array([9, 9, 9]),
    });
    await h.deps.runner.idle();
    expect(h.jobs.get(bad.jobId)!.status).toBe('failed');
    const good = startIngest(h.deps, await request());
    await h.deps.runner.idle();
    expect(h.jobs.get(good.jobId)!.status).toBe('done');
  });

  it('runs jobs one at a time, in the order they were started', async () => {
    const h = harness();
    const order: string[] = [];
    h.bus.subscribe('x', () => undefined);
    const a = h.deps.runner.start('ingest', null, async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push('a');
    });
    const b = h.deps.runner.start('ingest', null, async () => {
      order.push('b');
    });
    await h.deps.runner.idle();
    expect(order).toEqual(['a', 'b']);
    expect(h.jobs.get(a)!.status).toBe('done');
    expect(h.jobs.get(b)!.status).toBe('done');
  });

  it('marks jobs left running by a crash as failed on startup', () => {
    const h = harness();
    h.jobs.create('stuck1', 'ingest', null);
    h.jobs.update('stuck1', { status: 'running' });
    h.jobs.create('fine1', 'ingest', null);
    h.jobs.update('fine1', { status: 'done' });
    expect(h.jobs.failInterrupted()).toBe(1);
    expect(h.jobs.get('stuck1')).toMatchObject({
      status: 'failed',
      error: 'Interrupted by server restart',
    });
    expect(h.jobs.get('fine1')!.status).toBe('done');
  });
});
