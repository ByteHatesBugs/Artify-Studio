export const MOTION_EFFECTS = ['still', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'] as const;
export const RESOLUTIONS = ['720p', '1080p', 'square', 'portrait'] as const;
export const OUTPUT_FORMATS = ['mp4', 'webm'] as const;

export type MotionEffect = (typeof MOTION_EFFECTS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface RenderSettings {
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
  inputPath: string;
  outputPath: string;
  outputName: string;
  status: JobStatus;
  progress: number;
  settings: RenderSettings;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Batch {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  jobs: RenderJob[];
  settings: RenderSettings;
  createdAt: string;
  completedAt?: string;
}
