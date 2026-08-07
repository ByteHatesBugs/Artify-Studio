import { unlink } from 'node:fs/promises';
import { config } from './config.js';
import { renderImage } from './media.js';
import { batchStore } from './store.js';
import type { RenderJob } from './types.js';

interface QueueItem {
  batchId: string;
  job: RenderJob;
}

class RenderQueue {
  private readonly waiting: QueueItem[] = [];
  private readonly running = new Map<string, ReturnType<typeof renderImage>['process']>();

  enqueue(batchId: string, jobs: RenderJob[]) {
    this.waiting.push(...jobs.map((job) => ({ batchId, job })));
    this.drain();
  }

  cancelBatch(batchId: string) {
    batchStore.cancel(batchId);
    for (const [key, process] of this.running) {
      if (key.startsWith(`${batchId}:`)) process.kill('SIGTERM');
    }
  }

  private drain() {
    while (this.running.size < config.queueConcurrency && this.waiting.length > 0) {
      const item = this.waiting.shift();
      if (!item || item.job.status === 'cancelled') continue;
      void this.process(item);
    }
  }

  private async process({ batchId, job }: QueueItem) {
    const key = `${batchId}:${job.id}`;
    batchStore.updateJob(batchId, job.id, { status: 'processing', progress: 1, startedAt: new Date().toISOString() });
    const handle = renderImage(job, (progress) => batchStore.updateJob(batchId, job.id, { progress }));
    this.running.set(key, handle.process);

    try {
      await handle.completion;
      batchStore.updateJob(batchId, job.id, { status: 'completed', progress: 100, completedAt: new Date().toISOString() });
    } catch (error) {
      const latest = batchStore.get(batchId)?.jobs.find((candidate) => candidate.id === job.id);
      const cancelled = latest?.status === 'cancelled';
      batchStore.updateJob(batchId, job.id, {
        status: cancelled ? 'cancelled' : 'failed',
        progress: cancelled ? latest.progress : 0,
        error: cancelled ? undefined : error instanceof Error ? error.message : 'Render failed',
        completedAt: new Date().toISOString(),
      });
      await unlink(job.outputPath).catch(() => undefined);
    } finally {
      this.running.delete(key);
      await unlink(job.inputPath).catch(() => undefined);
      this.drain();
    }
  }
}

export const renderQueue = new RenderQueue();
