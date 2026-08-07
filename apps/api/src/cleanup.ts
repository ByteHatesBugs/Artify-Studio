import { config } from './config.js';
import { removeBatchFiles } from './files.js';
import { batchStore } from './store.js';

const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);

export const removeExpiredBatches = async () => {
  const cutoff = Date.now() - config.jobTtlMs;
  const expired = batchStore.list().filter((batch) => (
    terminalStatuses.has(batch.status) && new Date(batch.completedAt ?? batch.createdAt).getTime() < cutoff
  ));

  for (const batch of expired) {
    await removeBatchFiles(batch);
    batchStore.delete(batch.id);
  }
};

export const startCleanupScheduler = () => {
  const timer = setInterval(() => {
    void removeExpiredBatches().catch((error) => console.error('Batch cleanup failed:', error));
  }, 15 * 60 * 1000);
  timer.unref();
};
