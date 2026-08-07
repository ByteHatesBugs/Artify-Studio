import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config, storagePaths } from './config.js';
import { createBatchArchive, removeBatchFiles, safeStem } from './files.js';
import { renderQueue } from './queue.js';
import { presentBatch } from './presenter.js';
import { createBatchSchema } from './schema.js';
import { batchStore } from './store.js';
import type { Batch, RenderJob } from './types.js';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.diskStorage({
    destination: storagePaths.uploads,
    filename: (_request, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxFileSizeBytes, files: config.maxBatchSize },
  fileFilter: (_request, file, callback) => {
    if (imageMimeTypes.has(file.mimetype)) callback(null, true);
    else callback(new Error('Only JPG, PNG, and WebP images are supported.'));
  },
});

export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'artify-api', timestamp: new Date().toISOString() });
});

apiRouter.get('/batches', (_request, response) => {
  response.json({ batches: batchStore.list().map(presentBatch) });
});

apiRouter.get('/batches/:batchId', (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  if (!batch) return response.status(404).json({ error: 'Batch not found.' });
  return response.json({ batch: presentBatch(batch) });
});

apiRouter.post('/batches', upload.array('images'), (request, response, next) => {
  const files = request.files as Express.Multer.File[] | undefined;
  const parsed = createBatchSchema.safeParse(request.body);

  if (!parsed.success || !files?.length) {
    void Promise.all((files ?? []).map((file) => rm(file.path, { force: true })));
    return response.status(400).json({
      error: !files?.length ? 'Select at least one image.' : 'Some render settings are invalid.',
      details: parsed.success ? undefined : parsed.error.flatten(),
    });
  }

  try {
    const batchId = randomUUID();
    const createdAt = new Date().toISOString();
    const { name, ...settings } = parsed.data;
    const usedNames = new Map<string, number>();
    const jobs: RenderJob[] = files.map((file) => {
      const stem = safeStem(file.originalname);
      const sequence = (usedNames.get(stem) ?? 0) + 1;
      usedNames.set(stem, sequence);
      const uniqueStem = sequence === 1 ? stem : `${stem}-${sequence}`;
      const id = randomUUID();
      const outputName = `${uniqueStem}.${settings.format}`;
      return {
        id,
        originalName: file.originalname,
        inputPath: file.path,
        outputPath: path.join(storagePaths.outputs, `${id}.${settings.format}`),
        outputName,
        status: 'queued',
        progress: 0,
        settings,
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
    return next(error);
  }
});

apiRouter.post('/batches/:batchId/cancel', (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  if (!batch) return response.status(404).json({ error: 'Batch not found.' });
  renderQueue.cancelBatch(batch.id);
  return response.json({ batch: presentBatch(batchStore.get(batch.id)!) });
});

apiRouter.get('/batches/:batchId/jobs/:jobId/download', (request, response) => {
  const batch = batchStore.get(request.params.batchId);
  const job = batch?.jobs.find((candidate) => candidate.id === request.params.jobId);
  if (!batch || !job) return response.status(404).json({ error: 'Render not found.' });
  if (job.status !== 'completed') return response.status(409).json({ error: 'Render is not complete.' });
  return response.download(job.outputPath, job.outputName);
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
