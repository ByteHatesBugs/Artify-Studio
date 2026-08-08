import { unlink } from 'node:fs/promises';
import { config } from './config.js';
import { renderImage } from './media.js';
import { batchStore } from './store.js';
import type { RenderJob } from './types.js';

interface QueueItem {
  batchId: string;
  job: RenderJob;
}

export class RenderQueue {
  private readonly waiting: QueueItem[] = [];
  private readonly running = new Map<string, ReturnType<typeof renderImage>['process']>();
  private stopping = false;

  enqueue(batchId: string, jobs: RenderJob[]) {
    const unscheduled = jobs.filter((job) => {
      const key = `${batchId}:${job.id}`;
      return !this.running.has(key) && !this.waiting.some((item) => `${item.batchId}:${item.job.id}` === key);
    });
    this.waiting.push(...unscheduled.map((job) => ({ batchId, job })));
    this.drain();
  }

  cancelBatch(batchId: string) {
    batchStore.cancel(batchId);
    for (const [key, process] of this.running) {
      if (key.startsWith(`${batchId}:`)) process.kill('SIGTERM');
    }
  }

  stop() {
    this.stopping = true;
    this.waiting.length = 0;
    for (const process of this.running.values()) process.kill('SIGTERM');
  }

  private drain() {
    if (this.stopping) return;
    while (this.running.size < config.queueConcurrency && this.waiting.length > 0) {
      const item = this.waiting.shift();
      if (!item || item.job.status === 'cancelled') continue;
      void this.process(item);
    }
  }

  private async process({ batchId, job }: QueueItem) {
    const key = `${batchId}:${job.id}`;
    batchStore.updateJob(batchId, job.id, {
      status: 'processing',
      progress: 1,
      attempts: job.attempts + 1,
      error: undefined,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
    });
    const handle = renderImage(job, (progress) => batchStore.updateJob(batchId, job.id, { progress }));
    this.running.set(key, handle.process);

    try {
      await handle.completion;
      if (job.supersededOutputPath) await unlink(job.supersededOutputPath).catch(() => undefined);
      batchStore.updateJob(batchId, job.id, { status: 'completed', progress: 100, completedAt: new Date().toISOString(), supersededOutputPath: undefined, supersededOutputName: undefined });
    } catch (error) {
      if (this.stopping) return;
      const latest = batchStore.get(batchId)?.jobs.find((candidate) => candidate.id === job.id);
      const cancelled = latest?.status === 'cancelled';
      await unlink(job.outputPath).catch(() => undefined);
      if (job.supersededOutputPath) {
        batchStore.updateJob(batchId, job.id, {
          outputPath: job.supersededOutputPath,
          outputName: job.supersededOutputName ?? job.outputName,
          supersededOutputPath: undefined,
          supersededOutputName: undefined,
          status: 'completed',
          progress: 100,
          error: cancelled ? 'Update cancelled; the previous render was kept.' : `Update failed; the previous render was kept. ${error instanceof Error ? error.message : 'Render failed'}`,
          completedAt: new Date().toISOString(),
        });
      } else {
        batchStore.updateJob(batchId, job.id, {
          status: cancelled ? 'cancelled' : 'failed',
          progress: cancelled ? latest.progress : 0,
          error: cancelled ? undefined : error instanceof Error ? error.message : 'Render failed',
          completedAt: new Date().toISOString(),
        });
      }
    } finally {
      this.running.delete(key);
      this.drain();
    }
  }
}

export const renderQueue = new RenderQueue();
