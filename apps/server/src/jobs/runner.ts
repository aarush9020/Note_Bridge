import { randomUUID } from 'node:crypto';
import type { JobKind, JobProgress } from '@gyan/core';
import type { JobRepository } from '../db/repositories/jobs';
import type { ProgressBus } from './progress';

export type JobFn = (report: (progress: number, message: string) => void) => Promise<void>;

/**
 * Runs jobs in-process, one at a time per runner (ingestion is CPU/model heavy, and SQLite has a
 * single writer). State is written to the jobs table and published on the progress bus. A thrown
 * error becomes status 'failed' with a message, never an unhandled rejection.
 */
export class JobRunner {
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly jobs: JobRepository,
    private readonly bus: ProgressBus,
  ) {}

  /** Create the job and queue `fn`. Returns the job id right away. */
  start(kind: JobKind, documentId: string | null, fn: JobFn): string {
    const jobId = `job_${randomUUID()}`;
    this.jobs.create(jobId, kind, documentId);
    this.emit(jobId, kind, 'queued', 0, 'Queued');
    this.chain = this.chain.then(() => this.run(jobId, kind, fn));
    return jobId;
  }

  /** Resolves when every job started so far has finished (used by tests and shutdown). */
  idle(): Promise<void> {
    return this.chain;
  }

  private emit(
    jobId: string,
    kind: JobKind,
    status: JobProgress['status'],
    progress: number,
    message: string,
  ): void {
    this.bus.publish({ jobId, kind, status, progress, message });
  }

  private async run(jobId: string, kind: JobKind, fn: JobFn): Promise<void> {
    let last = 0;
    this.jobs.update(jobId, { status: 'running', progress: 0, message: 'Starting' });
    this.emit(jobId, kind, 'running', 0, 'Starting');
    try {
      await fn((progress, message) => {
        last = Math.max(last, Math.min(1, progress));
        this.jobs.update(jobId, { progress: last, message });
        this.emit(jobId, kind, 'running', last, message);
      });
      this.jobs.update(jobId, { status: 'done', progress: 1, message: 'Done' });
      this.emit(jobId, kind, 'done', 1, 'Done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.jobs.update(jobId, { status: 'failed', message, error: message });
      this.emit(jobId, kind, 'failed', last, message);
    }
  }
}
