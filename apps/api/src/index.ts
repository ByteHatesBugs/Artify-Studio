import { createApp } from './app.js';
import { startCleanupScheduler } from './cleanup.js';
import { config } from './config.js';
import { ensureStorage } from './files.js';

await ensureStorage();
startCleanupScheduler();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Artify API listening on http://localhost:${config.port}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received. Closing HTTP server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
