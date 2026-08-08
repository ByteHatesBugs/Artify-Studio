import { randomUUID } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config, storagePaths } from './config.js';
import { mediaEngine } from './engine.js';
import { createBatchArchive, removeBatchArchive, removeBatchFiles, safeStem } from './files.js';
import { renderQueue } from './queue.js';
import { presentBatch } from './presenter.js';
import { createBatchSchema, renameRenderSchema, rerenderJobSchema } from './schema.js';
import { batchStore } from './store.js';
import type { Batch, RenderJob } from './types.js';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const audioMimeTypes = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/ogg']);
const upload = multer({
  storage: multer.diskStorage({
    destination: storagePaths.uploads,
    filename: (_request, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxFileSizeBytes, files: config.maxBatchSize + 1 },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname === 'images' && imageMimeTypes.has(file.mimetype)) callback(null, true);
    else if (file.fieldname === 'audio' && audioMimeTypes.has(file.mimetype)) callback(null, true);
    else callback(Object.assign(new Error('Use JPG, PNG, or WebP images and MP3, WAV, M4A, AAC, or OGG audio.'), { status: 400 }));
  },
});

export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  const engine = mediaEngine.get();
  response.json({ status: engine.ready ? 'ok' : 'degraded', service: 'renderflow-api', engine, timestamp: new Date().toISOString() });
});

apiRouter.get('/batches', (_request, response) => {
  response.json({ batches: batchStore.list().map(presentBatch) });
});

apiRouter.get('/batches/:batchId', (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  if (!batch) return response.status(404).json({ error: 'Batch not found.' });
  return response.json({ batch: presentBatch(batch) });
});

apiRouter.post('/batches', upload.fields([{ name: 'images', maxCount: config.maxBatchSize }, { name: 'audio', maxCount: 1 }]), (request, response, next) => {
  const uploaded = request.files as Record<string, Express.Multer.File[]> | undefined;
  const files = uploaded?.images;
  const audioFile = uploaded?.audio?.[0];
  const allFiles = [...(files ?? []), ...(audioFile ? [audioFile] : [])];
  const parsed = createBatchSchema.safeParse(request.body);

  if (!parsed.success || !files?.length) {
    void Promise.all(allFiles.map((file) => rm(file.path, { force: true })));
    return response.status(400).json({
      error: !files?.length ? 'Select at least one image.' : 'Some render settings are invalid.',
      details: parsed.success ? undefined : parsed.error.flatten(),
    });
  }

  if (!mediaEngine.get().ready) {
    void Promise.all(allFiles.map((file) => rm(file.path, { force: true })));
    return response.status(503).json({ error: 'FFmpeg is unavailable. Check the server configuration and try again.' });
  }

  try {
    const batchId = randomUUID();
    const createdAt = new Date().toISOString();
    const { name, jobOverrides, ...parsedSettings } = parsed.data;
    const settings = { ...parsedSettings, fit: 'cover' as const };
    const usedNames = new Map<string, number>();
    const jobs: RenderJob[] = files.map((file, index) => {
      const stem = safeStem(file.originalname);
      const sequence = (usedNames.get(stem) ?? 0) + 1;
      usedNames.set(stem, sequence);
      const uniqueStem = sequence === 1 ? stem : `${stem}-${sequence}`;
      const id = randomUUID();
      const override = jobOverrides[index] ?? {};
      const hasLegacyOverride = override.motion || override.focus || override.effectStart !== undefined || override.effectEnd !== undefined;
      const effects = override.effects ?? (hasLegacyOverride ? [{
        motion: override.motion ?? settings.motion,
        focus: override.focus ?? settings.focus,
        effectStart: override.effectStart ?? settings.effectStart,
        effectEnd: override.effectEnd ?? settings.effectEnd,
      }] : settings.effects);
      const primaryEffect = effects[0]!;
      const jobSettings = {
        ...settings,
        ...override,
        effects,
        motion: primaryEffect.motion,
        focus: primaryEffect.focus,
        effectStart: primaryEffect.effectStart,
        effectEnd: primaryEffect.effectEnd,
      };
      const outputName = `${uniqueStem}.${jobSettings.format}`;
      return {
        id,
        originalName: file.originalname,
        inputPath: file.path,
        audioPath: audioFile?.path,
        audioName: audioFile?.originalname,
        outputPath: path.join(storagePaths.outputs, `${id}.${jobSettings.format}`),
        outputName,
        status: 'queued',
        progress: 0,
        attempts: 0,
        settings: jobSettings,
        createdAt,
      };
    });

    const batch: Batch = {
      id: batchId,
      name,
      status: 'queued',
      progress: 0,
      jobs,
      settings,
      createdAt,
    };
    batchStore.create(batch);
    renderQueue.enqueue(batchId, jobs);
    return response.status(202).json({ batch: presentBatch(batch) });
  } catch (error) {
    void Promise.all(allFiles.map((file) => rm(file.path, { force: true })));
    return next(error);
  }
});

apiRouter.post('/batches/:batchId/cancel', (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  if (!batch) return response.status(404).json({ error: 'Batch not found.' });
  renderQueue.cancelBatch(batch.id);
  return response.json({ batch: presentBatch(batchStore.get(batch.id)!) });
});

apiRouter.post('/batches/:batchId/retry', async (request, response, next) => {
  const batch = batchStore.get(request.params.batchId);
  if (!batch) return response.status(404).json({ error: 'Batch not found.' });
  if (!mediaEngine.get().ready) return response.status(503).json({ error: 'FFmpeg is unavailable.' });
  if (batch.status === 'queued' || batch.status === 'processing') return response.status(409).json({ error: 'Wait for the active render to finish or cancel it first.' });

  try {
    const candidates = batch.jobs.filter((job) => job.status === 'failed' || job.status === 'cancelled');
    const availableIds = (await Promise.all(candidates.map(async (job) => (
      await access(job.inputPath).then(() => job.id).catch(() => undefined)
    )))).filter((id): id is string => Boolean(id));
    if (!availableIds.length) return response.status(409).json({ error: 'No retryable source images are available.' });

    await removeBatchArchive(batch.id);
    const jobs = batchStore.prepareRetry(batch.id, availableIds);
    renderQueue.enqueue(batch.id, jobs);
    return response.status(202).json({ batch: presentBatch(batch), retried: jobs.length });
  } catch (error) {
    return next(error);
  }
});

apiRouter.patch('/batches/:batchId/jobs/:jobId', async (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  const job = batch?.jobs.find((candidate) => candidate.id === request.params.jobId);
  if (!batch || !job) return response.status(404).json({ error: 'Render not found.' });
  const parsed = renameRenderSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid video name.' });
  if (job.status === 'queued' || job.status === 'processing') return response.status(409).json({ error: 'Wait for this render to finish before renaming it.' });

  const outputName = `${safeStem(parsed.data.outputName)}.${job.settings.format}`;
  const duplicate = batch.jobs.some((candidate) => candidate.id !== job.id && candidate.outputName.toLowerCase() === outputName.toLowerCase());
  if (duplicate) return response.status(409).json({ error: 'Another video in this batch already uses that name.' });
  await removeBatchArchive(batch.id);
  batchStore.updateJob(batch.id, job.id, { outputName });
  return response.json({ batch: presentBatch(batchStore.get(batch.id)!) });
});

apiRouter.post('/batches/:batchId/jobs/:jobId/rerender', async (request, response, next) => {
  const batch = batchStore.get(request.params.batchId);
  const job = batch?.jobs.find((candidate) => candidate.id === request.params.jobId);
  if (!batch || !job) return response.status(404).json({ error: 'Render not found.' });
  if (job.status !== 'completed') return response.status(409).json({ error: 'Only completed videos can be edited and rendered again.' });
  if (!mediaEngine.get().ready) return response.status(503).json({ error: 'FFmpeg is unavailable.' });

  const parsed = rerenderJobSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Some updated video settings are invalid.', details: parsed.error.flatten() });
  if (parsed.data.settings.format !== job.settings.format) return response.status(400).json({ error: 'Output format cannot be changed during an edit. Create a new render for another format.' });

  const outputName = `${safeStem(parsed.data.outputName)}.${job.settings.format}`;
  const duplicate = batch.jobs.some((candidate) => candidate.id !== job.id && candidate.outputName.toLowerCase() === outputName.toLowerCase());
  if (duplicate) return response.status(409).json({ error: 'Another video in this batch already uses that name.' });

  try {
    await access(job.inputPath);
    await removeBatchArchive(batch.id);
    const outputPath = path.join(storagePaths.outputs, `${job.id}-${randomUUID()}.${job.settings.format}`);
    batchStore.updateJob(batch.id, job.id, {
      outputName,
      outputPath,
      supersededOutputName: job.outputName,
      supersededOutputPath: job.outputPath,
      settings: { ...parsed.data.settings, fit: 'cover' },
      status: 'queued',
      progress: 0,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });
    const updatedJob = batchStore.get(batch.id)!.jobs.find((candidate) => candidate.id === job.id)!;
    renderQueue.enqueue(batch.id, [updatedJob]);
    return response.status(202).json({ batch: presentBatch(batchStore.get(batch.id)!) });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return response.status(409).json({ error: 'The retained source image is no longer available for editing.' });
    return next(error);
  }
});

apiRouter.get('/batches/:batchId/jobs/:jobId/download', (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  const job = batch?.jobs.find((candidate) => candidate.id === request.params.jobId);
  if (!batch || !job) return response.status(404).json({ error: 'Render not found.' });
  if (job.status !== 'completed') return response.status(409).json({ error: 'Render is not complete.' });
  return response.download(job.outputPath, job.outputName);
});

apiRouter.get('/batches/:batchId/jobs/:jobId/preview', (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  const job = batch?.jobs.find((candidate) => candidate.id === request.params.jobId);
  if (!batch || !job) return response.status(404).json({ error: 'Render not found.' });
  if (job.status !== 'completed') return response.status(409).json({ error: 'Render is not complete.' });
  response.setHeader('Content-Disposition', `inline; filename="${job.outputName}"`);
  response.setHeader('Cache-Control', 'private, max-age=3600');
  return response.sendFile(job.outputPath);
});

apiRouter.get('/batches/:batchId/download', async (request, response, next) => {
  const batch = batchStore.get(request.params.batchId);
  if (!batch) return response.status(404).json({ error: 'Batch not found.' });
  if (batch.status === 'queued' || batch.status === 'processing') return response.status(409).json({ error: 'Wait for the batch to finish before downloading its archive.' });
  if (!batch.jobs.some((job) => job.status === 'completed')) return response.status(409).json({ error: 'No completed renders are available.' });
  try {
    const archivePath = await createBatchArchive(batch);
    return response.download(archivePath, `${safeStem(batch.name)}.zip`);
  } catch (error) {
    return next(error);
  }
});

apiRouter.delete('/batches/:batchId', async (request, response, next) => {
  const batch = batchStore.get(request.params.batchId);
  if (!batch) return response.status(404).json({ error: 'Batch not found.' });
  if (batch.status === 'processing' || batch.status === 'queued') return response.status(409).json({ error: 'Cancel the active batch before deleting it.' });
  try {
    await removeBatchFiles(batch);
    batchStore.delete(batch.id);
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
});
