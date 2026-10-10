import type { JobProgress } from '@gyan/core';

export type ProgressListener = (p: JobProgress) => void;

/**
 * In-memory pub/sub for job progress. The SSE route subscribes; a subscriber that joins late gets
 * the last known state immediately, and a finished job's last event is kept so a slow client
 * still sees "done" or "failed".
 */
export class ProgressBus {
  private readonly listeners = new Map<string, Set<ProgressListener>>();
  private readonly last = new Map<string, JobProgress>();

  publish(p: JobProgress): void {
    this.last.set(p.jobId, p);
    for (const l of this.listeners.get(p.jobId) ?? []) l(p);
  }

  latest(jobId: string): JobProgress | undefined {
    return this.last.get(jobId);
  }

  /** Returns an unsubscribe function. */
  subscribe(jobId: string, listener: ProgressListener): () => void {
    const set = this.listeners.get(jobId) ?? new Set<ProgressListener>();
    set.add(listener);
    this.listeners.set(jobId, set);
    const last = this.last.get(jobId);
    if (last) listener(last);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(jobId);
    };
  }
}
