export type MotionEffect = 'still' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
export type Resolution = '720p' | '1080p' | 'square' | 'portrait';
export type OutputFormat = 'mp4' | 'webm';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface RenderSettings {
  name: string;
  duration: number;
  fps: number;
  resolution: Resolution;
  motion: MotionEffect;
  format: OutputFormat;
  background: string;
}

export interface RenderJob {
  id: string;
  originalName: string;
  outputName: string;
  status: JobStatus;
  progress: number;
  attempts: number;
  error?: string;
}

export interface Batch {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  jobs: RenderJob[];
  settings: Omit<RenderSettings, 'name'>;
  createdAt: string;
  completedAt?: string;
}

export interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  engine: {
    ready: boolean;
    version?: string;
    error?: string;
    checkedAt: string;
  };
  timestamp: string;
}
