import type { JobKind, JobProgress, JobStatus } from '@gyan/core';
import type { Db } from '../index';

interface JobRow {
  id: string;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  message: string;
  document_id: string | null;
  error: string | null;
}

export interface JobRecord extends JobProgress {
  documentId: string | null;
  error: string | null;
}

function toRecord(r: JobRow): JobRecord {
  return {
    jobId: r.id,
    kind: r.kind,
    status: r.status,
    progress: r.progress,
    message: r.message,
    documentId: r.document_id,
    error: r.error,
  };
}

export class JobRepository {
  constructor(private readonly db: Db) {}

  create(id: string, kind: JobKind, documentId: string | null): void {
    this.db
      .prepare('INSERT INTO jobs (id, kind, document_id) VALUES (?, ?, ?)')
      .run(id, kind, documentId);
  }

  update(
    id: string,
    patch: { status?: JobStatus; progress?: number; message?: string; error?: string | null },
  ): void {
    this.db
      .prepare(
        `UPDATE jobs SET status = COALESCE(?, status), progress = COALESCE(?, progress),
           message = COALESCE(?, message), error = COALESCE(?, error), updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        patch.status ?? null,
        patch.progress ?? null,
        patch.message ?? null,
        patch.error ?? null,
        id,
      );
  }

  get(id: string): JobRecord | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
    return row ? toRecord(row) : null;
  }

  /** A job left 'queued'/'running' by a crash can never finish; mark it failed on startup. */
  failInterrupted(): number {
    return this.db
      .prepare(
        `UPDATE jobs SET status = 'failed', error = 'Interrupted by server restart',
           updated_at = datetime('now') WHERE status IN ('queued', 'running')`,
      )
      .run().changes;
  }
}
