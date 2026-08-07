import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { storagePaths } from './config.js';
import type { Batch, JobStatus, RenderJob } from './types.js';

const terminalStatuses: JobStatus[] = ['completed', 'failed', 'cancelled'];

export class BatchStore {
  private readonly batches = new Map<string, Batch>();
  private persistTimer?: NodeJS.Timeout;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly statePath = path.join(storagePaths.state, 'batches.json')) {}

  async initialize() {
    try {
      const stored = JSON.parse(await readFile(this.statePath, 'utf8')) as Batch[];
      for (const batch of stored) this.batches.set(batch.id, batch);
    } catch (error) {
      const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
      if (!missing) console.error('Could not restore batch history:', error);
    }

    const recoverable: Array<{ batchId: string; jobs: RenderJob[] }> = [];
    for (const batch of this.batches.values()) {
      batch.settings.fit ??= 'contain';
      batch.settings.quality ??= 'balanced';
      batch.settings.fade ??= true;
      const jobs: RenderJob[] = [];
      for (const job of batch.jobs) {
        job.settings.fit ??= batch.settings.fit;
        job.settings.quality ??= batch.settings.quality;
        job.settings.fade ??= batch.settings.fade;
        job.attempts ??= job.startedAt ? 1 : 0;
        if (job.status === 'completed') {
          const outputExists = await access(job.outputPath).then(() => true).catch(() => false);
          if (!outputExists) Object.assign(job, { status: 'failed', progress: 0, error: 'The rendered file is missing. Retry this batch.' });
        } else if (job.status === 'queued' || job.status === 'processing') {
          const inputExists = await access(job.inputPath).then(() => true).catch(() => false);
          if (inputExists) {
            Object.assign(job, { status: 'queued', progress: 0, error: undefined, startedAt: undefined, completedAt: undefined });
            jobs.push(job);
          } else {
            Object.assign(job, { status: 'failed', progress: 0, error: 'The source image is no longer available.' });
          }
        }
      }
      this.recalculate(batch);
      if (jobs.length) recoverable.push({ batchId: batch.id, jobs });
    }
    await this.flush();
    return recoverable;
  }

  create(batch: Batch) {
    this.batches.set(batch.id, batch);
    this.schedulePersist();
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
    this.schedulePersist();
  }

  prepareRetry(batchId: string, jobIds?: string[]) {
    const batch = this.batches.get(batchId);
    if (!batch) return [];
    const selected = new Set(jobIds);
    const jobs = batch.jobs.filter((job) => (
      terminalStatuses.includes(job.status) && job.status !== 'completed' && (!jobIds || selected.has(job.id))
    ));
    for (const job of jobs) Object.assign(job, { status: 'queued', progress: 0, error: undefined, startedAt: undefined, completedAt: undefined });
    if (jobs.length) {
      batch.status = 'queued';
      batch.completedAt = undefined;
      this.recalculate(batch);
      this.schedulePersist();
    }
    return jobs;
  }

  cancel(batchId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return false;
    for (const job of batch.jobs) {
      if (job.status === 'queued' || job.status === 'processing') job.status = 'cancelled';
    }
    this.recalculate(batch);
    this.schedulePersist();
    return true;
  }

  delete(id: string) {
    const deleted = this.batches.delete(id);
    if (deleted) this.schedulePersist();
    return deleted;
  }

  async flush() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = undefined;
    const snapshot = JSON.stringify(this.list(), null, 2);
    this.writeChain = this.writeChain.then(async () => {
      const temporaryStatePath = `${this.statePath}.tmp`;
      await writeFile(temporaryStatePath, snapshot, 'utf8');
      await rename(temporaryStatePath, this.statePath);
    });
    await this.writeChain;
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.flush().catch((error) => console.error('Could not save batch history:', error)), 250);
    this.persistTimer.unref();
  }

  private recalculate(batch: Batch) {
    batch.progress = Math.round(batch.jobs.reduce((sum, job) => sum + job.progress, 0) / batch.jobs.length);
    if (batch.jobs.every((job) => job.status === 'completed')) {
      batch.status = 'completed';
      batch.progress = 100;
      batch.completedAt ??= new Date().toISOString();
    } else if (batch.jobs.every((job) => terminalStatuses.includes(job.status))) {
      batch.status = batch.jobs.some((job) => job.status === 'failed') ? 'failed' : 'cancelled';
      batch.completedAt ??= new Date().toISOString();
    } else if (batch.jobs.some((job) => job.status === 'processing')) {
      batch.status = 'processing';
      batch.completedAt = undefined;
    } else {
      batch.status = 'queued';
      batch.completedAt = undefined;
    }
  }
}

export const batchStore = new BatchStore();
