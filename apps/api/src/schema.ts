import { z } from 'zod';
import { FIT_MODES, MOTION_EFFECTS, OUTPUT_FORMATS, QUALITY_PROFILES, RESOLUTIONS } from './types.js';

const hexColor = /^#[0-9a-fA-F]{6}$/;

export const renderSettingsSchema = z.object({
  duration: z.coerce.number().min(1).max(30).default(5),
  fps: z.coerce.number().int().min(24).max(60).default(30),
  resolution: z.enum(RESOLUTIONS).default('1080p'),
  motion: z.enum(MOTION_EFFECTS).default('zoom-in'),
  format: z.enum(OUTPUT_FORMATS).default('mp4'),
  fit: z.enum(FIT_MODES).default('contain'),
  quality: z.enum(QUALITY_PROFILES).default('balanced'),
  fade: z.preprocess((value) => value === true || value === 'true', z.boolean()).default(true),
  background: z.string().regex(hexColor).default('#09090b'),
});

export const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(80).default('Untitled batch'),
  ...renderSettingsSchema.shape,
});
