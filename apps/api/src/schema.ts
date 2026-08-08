import { z } from 'zod';
import { EFFECT_FOCUSES, FIT_MODES, MOTION_EFFECTS, OUTPUT_FORMATS, QUALITY_PROFILES, RESOLUTIONS } from './types.js';

const hexColor = /^#[0-9a-fA-F]{6}$/;

const effectSegmentSchema = z.object({
  motion: z.enum(MOTION_EFFECTS),
  focus: z.enum(EFFECT_FOCUSES).default('center'),
  strength: z.coerce.number().min(0).max(100).default(50),
  effectStart: z.coerce.number().min(0).max(60),
  effectEnd: z.coerce.number().min(0.1).max(60),
});

const effectsSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}, z.array(effectSegmentSchema).min(1).max(8));

const renderSettingsShape = {
  duration: z.coerce.number().min(1).max(60).default(5),
  effectStart: z.coerce.number().min(0).max(60).default(0),
  effectEnd: z.coerce.number().min(0.1).max(60).default(5),
  fps: z.coerce.number().int().min(24).max(60).default(30),
  resolution: z.enum(RESOLUTIONS).default('1080p'),
  motion: z.enum(MOTION_EFFECTS).default('zoom-in'),
  focus: z.enum(EFFECT_FOCUSES).default('center'),
  format: z.enum(OUTPUT_FORMATS).default('mp4'),
  fit: z.enum(FIT_MODES).default('cover'),
  quality: z.enum(QUALITY_PROFILES).default('balanced'),
  fade: z.preprocess((value) => value === true || value === 'true', z.boolean()).default(true),
  background: z.string().regex(hexColor).default('#09090b'),
  audioVolume: z.coerce.number().min(0).max(1).default(0.8),
  effects: effectsSchema,
};

const jobOverrideSchema = z.object({
  motion: z.enum(MOTION_EFFECTS).optional(),
  focus: z.enum(EFFECT_FOCUSES).optional(),
  strength: z.coerce.number().min(0).max(100).optional(),
  effectStart: z.coerce.number().min(0).max(60).optional(),
  effectEnd: z.coerce.number().min(0.1).max(60).optional(),
  effects: effectsSchema.optional(),
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

const validateEffects = (
  effects: Array<{ effectStart: number; effectEnd: number }>,
  duration: number,
  context: z.RefinementCtx,
  path: Array<string | number> = ['effects'],
) => {
  effects.forEach((effect, index) => {
    if (effect.effectStart >= effect.effectEnd) {
      context.addIssue({ code: 'custom', path: [...path, index, 'effectEnd'], message: 'Effect end must be after its start.' });
    }
    if (effect.effectEnd > duration) {
      context.addIssue({ code: 'custom', path: [...path, index, 'effectEnd'], message: 'Effect timing must fit inside the video duration.' });
    }
    if (index > 0 && effect.effectStart < effects[index - 1]!.effectEnd) {
      context.addIssue({ code: 'custom', path: [...path, index, 'effectStart'], message: 'Effects must be ordered and cannot overlap.' });
    }
  });
};

const normalizeEffectTiming = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const settings = value as Record<string, unknown>;
  let effects = settings.effects;
  if (typeof effects === 'string') {
    try { effects = JSON.parse(effects); } catch { /* Let Zod report the malformed value. */ }
  }
  if (!Array.isArray(effects) || effects.length === 0) {
    effects = [{
      motion: settings.motion ?? 'zoom-in',
      focus: settings.focus ?? 'center',
      strength: 50,
      effectStart: settings.effectStart ?? 0,
      effectEnd: settings.effectEnd ?? settings.duration ?? 5,
    }];
  }
  const effectList = effects as unknown[];
  const primary = effectList[0] && typeof effectList[0] === 'object' ? effectList[0] as Record<string, unknown> : {};
  return {
    ...settings,
    motion: primary.motion ?? settings.motion ?? 'zoom-in',
    focus: primary.focus ?? settings.focus ?? 'center',
    effectStart: primary.effectStart ?? settings.effectStart ?? 0,
    effectEnd: primary.effectEnd ?? settings.effectEnd ?? settings.duration ?? 5,
    effects: effectList,
  };
};

export const renderSettingsSchema = z.preprocess(
  normalizeEffectTiming,
  z.object(renderSettingsShape).superRefine((settings, context) => {
    validateEffectTiming(settings, context);
    validateEffects(settings.effects, settings.duration, context);
  }),
);

export const createBatchSchema = z.preprocess(
  normalizeEffectTiming,
  z.object({
    name: z.string().trim().min(1).max(80).default('Untitled batch'),
    ...renderSettingsShape,
    jobOverrides: jobOverridesSchema,
  }).superRefine((settings, context) => {
    validateEffectTiming(settings, context);
    validateEffects(settings.effects, settings.duration, context);
    settings.jobOverrides.forEach((override, index) => {
      const resolved = { ...settings, ...override };
      if (resolved.effectStart >= resolved.effectEnd) {
        context.addIssue({ code: 'custom', path: ['jobOverrides', index, 'effectEnd'], message: 'Effect end must be after its start.' });
      }
      if (resolved.effectEnd > resolved.duration) {
        context.addIssue({ code: 'custom', path: ['jobOverrides', index, 'effectEnd'], message: 'Effect timing must fit inside the video duration.' });
      }
      validateEffects(resolved.effects, resolved.duration, context, ['jobOverrides', index, 'effects']);
    });
  }),
);

export const renameRenderSchema = z.object({
  outputName: z.string().trim().min(1).max(80),
});

export const rerenderJobSchema = z.object({
  outputName: z.string().trim().min(1).max(80),
  settings: renderSettingsSchema,
});
