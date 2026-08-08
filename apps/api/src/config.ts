import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(moduleDir, '../../..');
loadEnv({ path: path.join(projectRoot, '.env'), quiet: true });

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: numberFromEnv(process.env.PORT, 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
  storageDir: path.resolve(projectRoot, process.env.STORAGE_DIR ?? './storage'),
  maxFileSizeBytes: numberFromEnv(process.env.MAX_FILE_SIZE_MB, 25) * 1024 * 1024,
  maxBatchSize: numberFromEnv(process.env.MAX_BATCH_SIZE, 50),
  queueConcurrency: numberFromEnv(process.env.QUEUE_CONCURRENCY, 1),
  jobTtlMs: numberFromEnv(process.env.JOB_TTL_HOURS, 24) * 60 * 60 * 1000,
};

export const storagePaths = {
  uploads: path.join(config.storageDir, 'uploads'),
  outputs: path.join(config.storageDir, 'outputs'),
  archives: path.join(config.storageDir, 'archives'),
  state: path.join(config.storageDir, 'state'),
};
