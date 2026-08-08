import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config, projectRoot } from './config.js';
import { apiRouter } from './routes.js';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter);

  const webDist = path.join(projectRoot, 'apps/web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/{*path}', (_request, response) => response.sendFile(path.join(webDist, 'index.html')));
  } else {
    app.use((_request, response) => response.status(404).json({ error: 'Route not found.' }));
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `Each image must be smaller than ${Math.round(config.maxFileSizeBytes / 1024 / 1024)} MB.`
        : error.code === 'LIMIT_FILE_COUNT'
          ? `A batch can contain up to ${config.maxBatchSize} images.`
          : error.message;
      response.status(400).json({ error: message });
      return;
    }
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    const candidateStatus = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500;
    const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus < 500 ? candidateStatus : 500;
    if (status === 500) console.error(error);
    response.status(status).json({ error: message });
  };
  app.use(errorHandler);
  return app;
};
