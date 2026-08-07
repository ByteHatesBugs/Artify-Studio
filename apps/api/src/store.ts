import type { Batch, JobStatus, RenderJob } from './types.js';

class BatchStore {
  private readonly batches = new Map<string, Batch>();

  create(batch: Batch) {
    this.batches.set(batch.id, batch);
    return batch;
  }

  get(id: string) {
    return this.batches.get(id);
  }

  list() {
    return [...this.batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateJob(batchId: string, jobId: string, patch: Partial<RenderJob>) {
    const batch = this.batches.get(batchId);
    const job = batch?.jobs.find((candidate) => candidate.id === jobId);
    if (!batch || !job) return;

    Object.assign(job, patch);
    this.recalculate(batch);
  }

  cancel(batchId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return false;
    for (const job of batch.jobs) {
      if (job.status === 'queued' || job.status === 'processing') job.status = 'cancelled';
    }
    this.recalculate(batch);
    return true;
  }

  delete(id: string) {
    return this.batches.delete(id);
  }

  private recalculate(batch: Batch) {
    const terminal: JobStatus[] = ['completed', 'failed', 'cancelled'];
    batch.progress = Math.round(batch.jobs.reduce((sum, job) => sum + job.progress, 0) / batch.jobs.length);

    if (batch.jobs.every((job) => job.status === 'completed')) {
      batch.status = 'completed';
      batch.progress = 100;
      batch.completedAt = new Date().toISOString();
    } else if (batch.jobs.every((job) => terminal.includes(job.status))) {
      batch.status = batch.jobs.some((job) => job.status === 'failed') ? 'failed' : 'cancelled';
      batch.completedAt = new Date().toISOString();
    } else if (batch.jobs.some((job) => job.status === 'processing')) {
      batch.status = 'processing';
    }
  }
}

export const batchStore = new BatchStore();
