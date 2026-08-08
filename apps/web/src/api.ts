import type { Batch, HealthStatus, RenderSettings, SelectedImage } from './types';

const readJson = async <T>(response: Response): Promise<T> => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error ?? 'The request could not be completed.');
  return payload as T;
};

export const createBatch = async (images: SelectedImage[], settings: RenderSettings) => {
  const form = new FormData();
  images.forEach((image) => form.append('images', image.file));
  Object.entries(settings).forEach(([key, value]) => form.append(key, key === 'effects' ? JSON.stringify(value) : String(value)));
  form.append('jobOverrides', JSON.stringify(images.map((image) => image.effectOverride ?? {})));
  const response = await fetch('/api/batches', { method: 'POST', body: form });
  return readJson<{ batch: Batch }>(response);
};

export const listBatches = async () => {
  const response = await fetch('/api/batches');
  return readJson<{ batches: Batch[] }>(response);
};

export const getHealth = async () => {
  const response = await fetch('/api/health');
  return readJson<HealthStatus>(response);
};

export const getBatch = async (id: string) => {
  const response = await fetch(`/api/batches/${id}`);
  return readJson<{ batch: Batch }>(response);
};

export const cancelBatch = async (id: string) => {
  const response = await fetch(`/api/batches/${id}/cancel`, { method: 'POST' });
  return readJson<{ batch: Batch }>(response);
};

export const retryBatch = async (id: string) => {
  const response = await fetch(`/api/batches/${id}/retry`, { method: 'POST' });
  return readJson<{ batch: Batch; retried: number }>(response);
};

export const renameRenderedJob = async (batchId: string, jobId: string, outputName: string) => {
  const response = await fetch(`/api/batches/${batchId}/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputName }),
  });
  return readJson<{ batch: Batch }>(response);
};

export const rerenderJob = async (batchId: string, jobId: string, outputName: string, settings: Batch['jobs'][number]['settings']) => {
  const response = await fetch(`/api/batches/${batchId}/jobs/${jobId}/rerender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputName, settings }),
  });
  return readJson<{ batch: Batch }>(response);
};

export const deleteBatch = async (id: string) => {
  const response = await fetch(`/api/batches/${id}`, { method: 'DELETE' });
  if (!response.ok) await readJson(response);
};

export const batchDownloadUrl = (id: string) => `/api/batches/${id}/download`;
export const jobDownloadUrl = (batchId: string, jobId: string) => `/api/batches/${batchId}/jobs/${jobId}/download`;
export const jobPreviewUrl = (batchId: string, jobId: string) => `/api/batches/${batchId}/jobs/${jobId}/preview`;
