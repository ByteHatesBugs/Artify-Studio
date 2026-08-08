export const MOTION_EFFECTS = ['still', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'] as const;
export const RESOLUTIONS = ['480p', '720p', '1080p', '1440p', '4k', 'square-720', 'square', 'portrait-720', 'portrait', 'feed-portrait'] as const;
export const OUTPUT_FORMATS = ['mp4', 'webm'] as const;
export const FIT_MODES = ['contain', 'cover'] as const;
export const QUALITY_PROFILES = ['draft', 'balanced', 'high'] as const;
export const EFFECT_FOCUSES = ['center', 'top', 'bottom', 'left', 'right'] as const;

export type MotionEffect = (typeof MOTION_EFFECTS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type FitMode = (typeof FIT_MODES)[number];
export type QualityProfile = (typeof QUALITY_PROFILES)[number];
export type EffectFocus = (typeof EFFECT_FOCUSES)[number];
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface EffectSegment {
  motion: MotionEffect;
  focus: EffectFocus;
  effectStart: number;
  effectEnd: number;
}

export interface RenderSettings {
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
  effects: EffectSegment[];
}

export interface RenderJob {
  id: string;
  originalName: string;
  inputPath: string;
  audioPath?: string;
  audioName?: string;
  outputPath: string;
  supersededOutputPath?: string;
  supersededOutputName?: string;
  outputName: string;
  status: JobStatus;
  progress: number;
  attempts: number;
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
