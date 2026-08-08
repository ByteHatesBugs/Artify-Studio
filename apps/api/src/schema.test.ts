import { describe, expect, it } from 'vitest';
import { createBatchSchema } from './schema.js';

const validSettings = {
  name: 'Timed batch',
  duration: '5',
  effectStart: '1.2',
  effectEnd: '4.4',
  fps: '30',
  resolution: '1080p',
  motion: 'zoom-in',
  focus: 'center',
  format: 'mp4',
  fit: 'cover',
  quality: 'balanced',
  fade: 'true',
  background: '#09090b',
};

describe('render settings validation', () => {
  it('accepts precise effect timing from multipart form values', () => {
    const parsed = createBatchSchema.parse(validSettings);
    expect(parsed.effectStart).toBe(1.2);
    expect(parsed.effectEnd).toBe(4.4);
  });

  it('defaults older requests to an effect that spans their full duration', () => {
    const { effectStart: _start, effectEnd: _end, ...legacySettings } = validSettings;
    const parsed = createBatchSchema.parse({ ...legacySettings, duration: '3' });
    expect(parsed.effectStart).toBe(0);
    expect(parsed.effectEnd).toBe(3);
  });

  it('rejects effect windows outside the video duration', () => {
    const parsed = createBatchSchema.safeParse({ ...validSettings, effectStart: '4', effectEnd: '6' });
    expect(parsed.success).toBe(false);
  });

  it('rejects an effect that ends before it starts', () => {
    const parsed = createBatchSchema.safeParse({ ...validSettings, effectStart: '3', effectEnd: '2' });
    expect(parsed.success).toBe(false);
  });

  it('accepts per-image motion, focus, and timing overrides', () => {
    const parsed = createBatchSchema.parse({
      ...validSettings,
      jobOverrides: JSON.stringify([{ motion: 'pan-left', focus: 'top', effectStart: 0.5, effectEnd: 2.5 }]),
    });
    expect(parsed.jobOverrides[0]).toEqual({ motion: 'pan-left', focus: 'top', effectStart: 0.5, effectEnd: 2.5 });
  });

  it('accepts multiple ordered effects for one video', () => {
    const parsed = createBatchSchema.parse({
      ...validSettings,
      effects: JSON.stringify([
        { motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 2 },
        { motion: 'pan-left', focus: 'top', effectStart: 2, effectEnd: 5 },
      ]),
    });
    expect(parsed.effects).toHaveLength(2);
    expect(parsed.effects[1]?.motion).toBe('pan-left');
    expect(parsed.effects[0]?.strength).toBe(50);
    expect(parsed.effects[0]?.easing).toBe('cinematic');
    expect(parsed.effects[0]?.speed).toBe(1);
  });

  it('validates independent effect strength', () => {
    const strong = createBatchSchema.safeParse({ ...validSettings, effects: JSON.stringify([{ motion: 'zoom-in', focus: 'center', strength: 85, effectStart: 0, effectEnd: 5 }]) });
    const excessive = createBatchSchema.safeParse({ ...validSettings, effects: JSON.stringify([{ motion: 'zoom-in', focus: 'center', strength: 101, effectStart: 0, effectEnd: 5 }]) });
    expect(strong.success && strong.data.effects[0]?.strength).toBe(85);
    expect(excessive.success).toBe(false);
  });

  it('validates independent effect speed', () => {
    const fast = createBatchSchema.safeParse({ ...validSettings, effects: JSON.stringify([{ motion: 'zoom-in', focus: 'center', speed: 2.5, effectStart: 0, effectEnd: 5 }]) });
    const excessive = createBatchSchema.safeParse({ ...validSettings, effects: JSON.stringify([{ motion: 'zoom-in', focus: 'center', speed: 3.25, effectStart: 0, effectEnd: 5 }]) });
    expect(fast.success && fast.data.effects[0]?.speed).toBe(2.5);
    expect(excessive.success).toBe(false);
  });

  it('validates professional per-effect motion curves', () => {
    const eased = createBatchSchema.safeParse({ ...validSettings, effects: JSON.stringify([{ motion: 'zoom-in', focus: 'center', easing: 'ease-out', effectStart: 0, effectEnd: 5 }]) });
    const invalid = createBatchSchema.safeParse({ ...validSettings, effects: JSON.stringify([{ motion: 'zoom-in', focus: 'center', easing: 'elastic', effectStart: 0, effectEnd: 5 }]) });
    expect(eased.success && eased.data.effects[0]?.easing).toBe('ease-out');
    expect(invalid.success).toBe(false);
  });

  it('accepts vertical and diagonal motion effects', () => {
    for (const motion of ['pan-up', 'pan-down', 'drift-up-left', 'drift-up-right', 'drift-down-left', 'drift-down-right']) {
      const parsed = createBatchSchema.safeParse({ ...validSettings, motion, effects: JSON.stringify([{ motion, focus: 'center', effectStart: 0, effectEnd: 5 }]) });
      expect(parsed.success).toBe(true);
    }
  });

  it('accepts overlapping effect segments in stack-priority order', () => {
    const parsed = createBatchSchema.parse({
      ...validSettings,
      effects: JSON.stringify([
        { motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 3 },
        { motion: 'pan-left', focus: 'top', effectStart: 2, effectEnd: 5 },
      ]),
    });
    expect(parsed.effects).toHaveLength(2);
    expect(parsed.effects[0]?.effectEnd).toBe(3);
    expect(parsed.effects[1]?.effectStart).toBe(2);
  });

  it('accepts videos up to one minute and rejects longer durations', () => {
    const minute = createBatchSchema.safeParse({
      ...validSettings,
      duration: '60',
      effectEnd: '60',
      effects: JSON.stringify([{ motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 60 }]),
    });
    const tooLong = createBatchSchema.safeParse({ ...validSettings, duration: '61', effectEnd: '61' });
    expect(minute.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });

  it('accepts standard social and high-resolution canvases', () => {
    for (const resolution of ['480p', '1440p', '4k', 'square-720', 'portrait-720', 'feed-portrait']) {
      expect(createBatchSchema.safeParse({ ...validSettings, resolution }).success).toBe(true);
    }
  });
});
