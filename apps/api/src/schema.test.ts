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
});
