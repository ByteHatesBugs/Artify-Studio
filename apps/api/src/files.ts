import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { storagePaths } from './config.js';
import type { Batch } from './types.js';

export const ensureStorage = async () => {
  await Promise.all(Object.values(storagePaths).map((directory) => mkdir(directory, { recursive: true })));
};

export const safeStem = (filename: string) => {
  const extension = path.extname(filename);
  const stem = path.basename(filename, extension)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return stem || 'image';
};

export const createBatchArchive = async (batch: Batch) => {
  const archivePath = path.join(storagePaths.archives, `${batch.id}.zip`);
  try {
    await stat(archivePath);
    return archivePath;
  } catch {
    // Build the archive once and reuse it for future downloads.
  }

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.once('close', resolve);
    output.once('error', reject);
    archive.once('error', reject);
    archive.pipe(output);
    for (const job of batch.jobs.filter((candidate) => candidate.status === 'completed')) {
      archive.file(job.outputPath, { name: job.outputName });
    }
    void archive.finalize();
  });

  return archivePath;
};

export const removeBatchArchive = (batchId: string) => (
  rm(path.join(storagePaths.archives, `${batchId}.zip`), { force: true })
);

export const removeBatchFiles = async (batch: Batch) => {
  const paths = new Set([
    ...batch.jobs.flatMap((job) => [job.inputPath, job.outputPath, job.audioPath, job.supersededOutputPath].filter((filePath): filePath is string => Boolean(filePath))),
    path.join(storagePaths.archives, `${batch.id}.zip`),
  ]);
  await Promise.all([...paths].map((filePath) => rm(filePath, { force: true }).catch(() => undefined)));
};
