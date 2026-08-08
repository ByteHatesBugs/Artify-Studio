import { createApp } from './app.js';
import { startCleanupScheduler } from './cleanup.js';
import { config } from './config.js';
import { mediaEngine } from './engine.js';
import { ensureStorage } from './files.js';
import { renderQueue } from './queue.js';
import { batchStore } from './store.js';

await ensureStorage();
const recovered = await batchStore.initialize();
const engine = await mediaEngine.check();
if (engine.ready) {
  for (const item of recovered) renderQueue.enqueue(item.batchId, item.jobs);
} else {
  console.error(`FFmpeg is unavailable: ${engine.error}`);
}
startCleanupScheduler();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`RenderFlow API listening on http://localhost:${config.port}`);
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing HTTP server.`);
  server.close();
  renderQueue.stop();
  await batchStore.flush().catch((error) => console.error('Final state save failed:', error));
  process.exit(0);
};

const forceExit = (signal: string) => {
  void shutdown(signal);
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => forceExit('SIGINT'));
process.on('SIGTERM', () => forceExit('SIGTERM'));
