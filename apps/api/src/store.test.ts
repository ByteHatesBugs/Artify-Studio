import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BatchStore } from './store.js';
import type { Batch } from './types.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const createCancelledBatch = (): Batch => ({
  id: 'batch-1',
  name: 'Persistence test',
  status: 'cancelled',
  progress: 0,
  settings: { duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '720p', motion: 'still', focus: 'center', format: 'mp4', fit: 'contain', quality: 'balanced', fade: true, background: '#09090b', effects: [{ motion: 'still', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }] },
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  jobs: [{
    id: 'job-1',
    originalName: 'source.png',
    inputPath: 'source.png',
    outputPath: 'output.mp4',
    outputName: 'output.mp4',
    status: 'cancelled',
    progress: 0,
    attempts: 1,
    settings: { duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '720p', motion: 'still', focus: 'center', format: 'mp4', fit: 'contain', quality: 'balanced', fade: true, background: '#09090b', effects: [{ motion: 'still', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }] },
    createdAt: new Date().toISOString(),
  }],
});

describe('BatchStore', () => {
  it('persists history and restores it in a new store instance', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'renderflow-store-'));
    temporaryDirectories.push(directory);
    const statePath = path.join(directory, 'batches.json');
    const first = new BatchStore(statePath);
    const legacyBatch = createCancelledBatch();
    Object.assign(legacyBatch.settings, { audioVolume: 0.8, audioSourceStart: 0, audioVideoStart: 0 });
    Object.assign(legacyBatch.jobs[0]!.settings, { audioVolume: 0.8, audioSourceStart: 0, audioVideoStart: 0 });
    delete (legacyBatch.settings.effects[0] as Partial<(typeof legacyBatch.settings.effects)[number]>).strength;
    delete (legacyBatch.jobs[0]!.settings.effects[0] as Partial<(typeof legacyBatch.settings.effects)[number]>).strength;
    delete (legacyBatch.settings.effects[0] as Partial<(typeof legacyBatch.settings.effects)[number]>).easing;
    delete (legacyBatch.jobs[0]!.settings.effects[0] as Partial<(typeof legacyBatch.settings.effects)[number]>).easing;
    first.create(legacyBatch);
    await first.flush();

    const restored = new BatchStore(statePath);
    await restored.initialize();
    expect(restored.get('batch-1')?.name).toBe('Persistence test');
    expect(restored.get('batch-1')?.jobs[0]?.attempts).toBe(1);
    expect(restored.get('batch-1')?.jobs[0]?.settings.effects[0]?.strength).toBe(50);
    expect(restored.get('batch-1')?.jobs[0]?.settings.effects[0]?.easing).toBe('cinematic');
    expect('audioSourceStart' in restored.get('batch-1')!.jobs[0]!.settings).toBe(false);
    expect('audioVideoStart' in restored.get('batch-1')!.jobs[0]!.settings).toBe(false);
  });

  it('prepares cancelled jobs for a clean retry', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'renderflow-store-'));
    temporaryDirectories.push(directory);
    const store = new BatchStore(path.join(directory, 'batches.json'));
    store.create(createCancelledBatch());
    const jobs = store.prepareRetry('batch-1');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe('queued');
    expect(store.get('batch-1')?.status).toBe('queued');
    await store.flush();
  });
});
