export type MotionEffect =
  | 'still' | 'zoom-in' | 'zoom-out'
  | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down'
  | 'drift-up-left' | 'drift-up-right' | 'drift-down-left' | 'drift-down-right';
export type Resolution = '480p' | '720p' | '1080p' | '1440p' | '4k' | 'square-720' | 'square' | 'portrait-720' | 'portrait' | 'feed-portrait';
export type OutputFormat = 'mp4' | 'webm';
export type FitMode = 'contain' | 'cover';
export type QualityProfile = 'draft' | 'balanced' | 'high';
export type EffectFocus = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type EffectEasing = 'cinematic' | 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface EffectSegment {
  motion: MotionEffect;
  focus: EffectFocus;
  strength: number;
  easing?: EffectEasing;
  effectStart: number;
  effectEnd: number;
}

export interface RenderSettings {
  name: string;
  duration: number;
  effectStart: number;
  effectEnd: number;
  fps: number;
  resolution: Resolution;
  motion: MotionEffect;
  focus: EffectFocus;
  format: OutputFormat;
  fit: FitMode;
  quality: QualityProfile;
  fade: boolean;
  background: string;
  audioVolume: number;
  audioSourceStart: number;
  audioVideoStart: number;
  effects: EffectSegment[];
}

export interface ImageEffectOverride {
  effects: EffectSegment[];
}

export interface RenderJob {
  id: string;
  originalName: string;
  audioName?: string;
  outputName: string;
  status: JobStatus;
  progress: number;
  attempts: number;
  settings: Omit<RenderSettings, 'name'>;
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
  effectOverride?: ImageEffectOverride;
}

export interface SelectedAudio {
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
