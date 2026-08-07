import type { Batch, RenderSettings } from './types';

const readJson = async <T>(response: Response): Promise<T> => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error ?? 'The request could not be completed.');
  return payload as T;
};

export const createBatch = async (files: File[], settings: RenderSettings) => {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  Object.entries(settings).forEach(([key, value]) => form.append(key, String(value)));
  const response = await fetch('/api/batches', { method: 'POST', body: form });
  return readJson<{ batch: Batch }>(response);
};

export const listBatches = async () => {
  const response = await fetch('/api/batches');
  return readJson<{ batches: Batch[] }>(response);
};

export const getBatch = async (id: string) => {
  const response = await fetch(`/api/batches/${id}`);
  return readJson<{ batch: Batch }>(response);
};

export const cancelBatch = async (id: string) => {
  const response = await fetch(`/api/batches/${id}/cancel`, { method: 'POST' });
  return readJson<{ batch: Batch }>(response);
};

export const deleteBatch = async (id: string) => {
  const response = await fetch(`/api/batches/${id}`, { method: 'DELETE' });
  if (!response.ok) await readJson(response);
};

export const batchDownloadUrl = (id: string) => `/api/batches/${id}/download`;
export const jobDownloadUrl = (batchId: string, jobId: string) => `/api/batches/${batchId}/jobs/${jobId}/download`;
