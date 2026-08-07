import { describe, expect, it } from 'vitest';
import { buildFfmpegArgs, buildVideoFilter } from './media.js';
import type { RenderJob, RenderSettings } from './types.js';

const settings: RenderSettings = {
  duration: 5,
  effectStart: 1,
  effectEnd: 4,
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
    expect(filter).toContain('clip((on-30)/90,0,1)');
    expect(filter).toContain('fps=30');
    expect(filter).toContain('fade=t=in');
  });

  it('holds motion outside the selected effect window', () => {
    const filter = buildVideoFilter({ ...settings, fps: 24, effectStart: 1.5, effectEnd: 3.5, motion: 'pan-right' });
    expect(filter).toContain('clip((on-36)/48,0,1)');
    expect(filter).toContain('(iw-iw/zoom)*clip');
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
