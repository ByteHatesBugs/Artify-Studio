import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Batch, RenderJob } from './types.js';

const { renderImage, verifyRender, batchStore } = vi.hoisted(() => ({
  renderImage: vi.fn(),
  verifyRender: vi.fn(),
  batchStore: { updateJob: vi.fn(), get: vi.fn(), cancel: vi.fn() },
}));

vi.mock('./media.js', () => ({ renderImage, verifyRender }));
vi.mock('./store.js', () => ({ batchStore }));

const { RenderQueue } = await import('./queue.js');

const settings: RenderJob['settings'] = {
  duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '720p', motion: 'zoom-in', focus: 'center',
  format: 'mp4', fit: 'cover', quality: 'balanced', fade: true, background: '#09090b',
  effects: [{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }],
};

describe('RenderQueue edited-output safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyRender.mockResolvedValue(undefined);
  });

  it('rejects a completed encode that does not meet the requested video requirements', async () => {
    const job: RenderJob = {
      id: 'job-2', originalName: 'source.jpg', inputPath: 'source.jpg', outputPath: 'bad-output.mp4', outputName: 'bad-output.mp4',
      status: 'queued', progress: 0, attempts: 0, settings, createdAt: new Date().toISOString(),
    };
    const batch = { id: 'batch-2', jobs: [job] } as Batch;
    batchStore.get.mockReturnValue(batch);
    batchStore.updateJob.mockImplementation((_batchId: string, _jobId: string, patch: Partial<RenderJob>) => Object.assign(job, patch));
    renderImage.mockReturnValue({ process: { kill: vi.fn() }, completion: Promise.resolve() });
    verifyRender.mockRejectedValue(new Error('Rendered video did not meet its requirements: wrong canvas.'));

    const queue = new RenderQueue();
    queue.enqueue(batch.id, [job]);

    await vi.waitFor(() => expect(job.status).toBe('failed'));
    expect(job.error).toContain('wrong canvas');
    queue.stop();
  });

  it('restores the previous completed render when an edited render fails', async () => {
    const job: RenderJob = {
      id: 'job-1', originalName: 'source.jpg', inputPath: 'source.jpg', outputPath: 'new-output.mp4', outputName: 'new-name.mp4',
      supersededOutputPath: 'working-output.mp4', supersededOutputName: 'working-name.mp4', status: 'queued', progress: 0, attempts: 1,
      settings, createdAt: new Date().toISOString(),
    };
    const batch = { id: 'batch-1', jobs: [job] } as Batch;
    batchStore.get.mockReturnValue(batch);
    batchStore.updateJob.mockImplementation((_batchId: string, _jobId: string, patch: Partial<RenderJob>) => Object.assign(job, patch));
    renderImage.mockReturnValue({ process: { kill: vi.fn() }, completion: Promise.reject(new Error('encoder failed')) });

    const queue = new RenderQueue();
    queue.enqueue(batch.id, [job]);

    await vi.waitFor(() => expect(job.status).toBe('completed'));
    expect(job.outputPath).toBe('working-output.mp4');
    expect(job.outputName).toBe('working-name.mp4');
    expect(job.error).toContain('previous render was kept');
    expect(job.supersededOutputPath).toBeUndefined();
    queue.stop();
  });
});
