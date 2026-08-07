import { describe, expect, it } from 'vitest';
import { buildFfmpegArgs, buildVideoFilter } from './media.js';
import type { RenderJob, RenderSettings } from './types.js';

const settings: RenderSettings = {
  duration: 5,
  fps: 30,
  resolution: '1080p',
  motion: 'zoom-in',
  format: 'mp4',
  fit: 'contain',
  quality: 'balanced',
  fade: true,
  background: '#09090b',
};

describe('media command construction', () => {
  it('creates a padded 1080p zoom filter', () => {
    const filter = buildVideoFilter(settings);
    expect(filter).toContain('scale=1920:1080');
    expect(filter).toContain('zoompan');
    expect(filter).toContain('fps=30');
    expect(filter).toContain('fade=t=in');
  });

  it('passes file paths as separate process arguments', () => {
    const job = { inputPath: 'input image.jpg', outputPath: 'output video.mp4', settings } as RenderJob;
    const args = buildFfmpegArgs(job);
    expect(args).toContain('input image.jpg');
    expect(args.at(-1)).toBe('output video.mp4');
    expect(args).toContain('libx264');
    expect(args).toContain('22');
  });

  it('supports edge-to-edge framing without transitions', () => {
    const filter = buildVideoFilter({ ...settings, fit: 'cover', fade: false, motion: 'still' });
    expect(filter).toContain('force_original_aspect_ratio=increase');
    expect(filter).toContain('crop=1920:1080');
    expect(filter).not.toContain('fade=');
  });
});
