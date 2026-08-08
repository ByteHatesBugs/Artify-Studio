import type { Batch } from './types.js';

export const presentBatch = (batch: Batch) => ({
  ...batch,
  jobs: batch.jobs.map(({ inputPath: _inputPath, audioPath: _audioPath, audioName: _audioName, outputPath: _outputPath, supersededOutputPath: _supersededOutputPath, supersededOutputName: _supersededOutputName, ...job }) => job),
});
