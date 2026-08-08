import express from 'express';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Batch, RenderJob } from './types.js';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), updateJob: vi.fn(), list: vi.fn(() => []),
  enqueue: vi.fn(), removeBatchArchive: vi.fn(async () => undefined),
}));

vi.mock('./config.js', () => ({
  config: { maxFileSizeBytes: 25 * 1024 * 1024, maxBatchSize: 50 },
  storagePaths: { uploads: '.', outputs: '.', archives: '.', state: '.' },
}));
vi.mock('./engine.js', () => ({ mediaEngine: { get: () => ({ ready: true }) } }));
vi.mock('./store.js', () => ({ batchStore: { get: mocks.get, updateJob: mocks.updateJob, list: mocks.list } }));
vi.mock('./queue.js', () => ({ renderQueue: { enqueue: mocks.enqueue } }));
vi.mock('./files.js', () => ({
  safeStem: (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-'),
  removeBatchArchive: mocks.removeBatchArchive,
  createBatchArchive: vi.fn(), removeBatchFiles: vi.fn(),
}));

const { apiRouter } = await import('./routes.js');

const settings: RenderJob['settings'] = {
  duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '720p', motion: 'zoom-in', focus: 'center',
  format: 'mp4', fit: 'cover', quality: 'balanced', fade: true, background: '#09090b', audioVolume: 0.8,
  effects: [{ motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 5 }],
};

describe('completed render editing routes', () => {
  let job: RenderJob;
  let batch: Batch;
  const app = express().use(express.json()).use('/api', apiRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    job = {
      id: 'job-1', originalName: 'source.jpg', inputPath: fileURLToPath(import.meta.url), outputPath: 'working.mp4', outputName: 'working.mp4',
      status: 'completed', progress: 100, attempts: 1, settings, createdAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    };
    batch = { id: 'batch-1', name: 'Batch', status: 'completed', progress: 100, jobs: [job], settings, createdAt: new Date().toISOString() };
    mocks.get.mockReturnValue(batch);
    mocks.updateJob.mockImplementation((_batchId: string, _jobId: string, patch: Partial<RenderJob>) => Object.assign(job, patch));
  });

  it('renames a completed video without rendering it again', async () => {
    const response = await request(app).patch('/api/batches/batch-1/jobs/job-1').send({ outputName: 'launch final' });
    expect(response.status).toBe(200);
    expect(job.outputName).toBe('launch-final.mp4');
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('queues a safe replacement while retaining the previous output', async () => {
    const updatedSettings = { ...settings, fit: 'contain' as const, duration: 60, effectEnd: 60, effects: [{ ...settings.effects[0]!, effectEnd: 60 }] };
    const response = await request(app).post('/api/batches/batch-1/jobs/job-1/rerender').send({ outputName: 'launch updated', settings: updatedSettings });
    expect(response.status).toBe(202);
    expect(job.status).toBe('queued');
    expect(job.supersededOutputPath).toBe('working.mp4');
    expect(job.outputName).toBe('launch-updated.mp4');
    expect(job.settings.fit).toBe('cover');
    expect(mocks.enqueue).toHaveBeenCalledWith('batch-1', [job]);
  });
});
