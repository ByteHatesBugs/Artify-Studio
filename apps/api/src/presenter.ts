import type { Batch } from './types.js';

export const presentBatch = (batch: Batch) => ({
  ...batch,
  jobs: batch.jobs.map(({ inputPath: _inputPath, outputPath: _outputPath, ...job }) => job),
});
