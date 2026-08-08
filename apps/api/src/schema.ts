import { z } from 'zod';
import { EFFECT_FOCUSES, FIT_MODES, MOTION_EFFECTS, OUTPUT_FORMATS, QUALITY_PROFILES, RESOLUTIONS } from './types.js';

const hexColor = /^#[0-9a-fA-F]{6}$/;

const renderSettingsShape = {
  duration: z.coerce.number().min(1).max(30).default(5),
  effectStart: z.coerce.number().min(0).max(30).default(0),
  effectEnd: z.coerce.number().min(0.1).max(30).default(5),
  fps: z.coerce.number().int().min(24).max(60).default(30),
  resolution: z.enum(RESOLUTIONS).default('1080p'),
  motion: z.enum(MOTION_EFFECTS).default('zoom-in'),
  focus: z.enum(EFFECT_FOCUSES).default('center'),
  format: z.enum(OUTPUT_FORMATS).default('mp4'),
  fit: z.enum(FIT_MODES).default('contain'),
  quality: z.enum(QUALITY_PROFILES).default('balanced'),
  fade: z.preprocess((value) => value === true || value === 'true', z.boolean()).default(true),
  background: z.string().regex(hexColor).default('#09090b'),
};

const jobOverrideSchema = z.object({
  motion: z.enum(MOTION_EFFECTS).optional(),
  focus: z.enum(EFFECT_FOCUSES).optional(),
  effectStart: z.coerce.number().min(0).max(30).optional(),
  effectEnd: z.coerce.number().min(0.1).max(30).optional(),
});

const jobOverridesSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value ?? [];
  try { return JSON.parse(value); } catch { return value; }
}, z.array(jobOverrideSchema).max(50).default([]));

const validateEffectTiming = (settings: { duration: number; effectStart: number; effectEnd: number }, context: z.RefinementCtx) => {
  if (settings.effectStart >= settings.effectEnd) {
    context.addIssue({ code: 'custom', path: ['effectEnd'], message: 'Effect end must be after its start.' });
  }
  if (settings.effectEnd > settings.duration) {
    context.addIssue({ code: 'custom', path: ['effectEnd'], message: 'Effect timing must fit inside the video duration.' });
  }
};

const normalizeEffectTiming = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const settings = value as Record<string, unknown>;
  return {
    ...settings,
    effectStart: settings.effectStart ?? 0,
    effectEnd: settings.effectEnd ?? settings.duration ?? 5,
  };
};

export const renderSettingsSchema = z.preprocess(
  normalizeEffectTiming,
  z.object(renderSettingsShape).superRefine(validateEffectTiming),
);

export const createBatchSchema = z.preprocess(
  normalizeEffectTiming,
  z.object({
    name: z.string().trim().min(1).max(80).default('Untitled batch'),
    ...renderSettingsShape,
    jobOverrides: jobOverridesSchema,
  }).superRefine((settings, context) => {
    validateEffectTiming(settings, context);
    settings.jobOverrides.forEach((override, index) => {
      const resolved = { ...settings, ...override };
      if (resolved.effectStart >= resolved.effectEnd) {
        context.addIssue({ code: 'custom', path: ['jobOverrides', index, 'effectEnd'], message: 'Effect end must be after its start.' });
      }
      if (resolved.effectEnd > resolved.duration) {
        context.addIssue({ code: 'custom', path: ['jobOverrides', index, 'effectEnd'], message: 'Effect timing must fit inside the video duration.' });
      }
    });
  }),
);
