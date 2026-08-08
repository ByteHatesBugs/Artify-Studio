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
  focus: 'center',
  format: 'mp4',
  fit: 'contain',
  quality: 'balanced',
  fade: true,
  background: '#09090b',
  audioVolume: 0.8,
  effects: [{ motion: 'zoom-in', focus: 'center', effectStart: 1, effectEnd: 4 }],
};

describe('media command construction', () => {
  it('creates a padded 1080p zoom filter', () => {
    const filter = buildVideoFilter(settings);
    expect(filter).toContain('scale=2152:1210');
    expect(filter).toContain('zoompan');
    expect(filter).toContain('clip((on-30)/90,0,1)');
    expect(filter).toContain('3-2*');
    expect(filter).toContain('fps=30');
    expect(filter).toContain('fade=t=in');
  });

  it('holds motion outside the selected effect window', () => {
    const filter = buildVideoFilter({ ...settings, fps: 24, effectStart: 1.5, effectEnd: 3.5, motion: 'pan-right', effects: [{ motion: 'pan-right', focus: 'center', effectStart: 1.5, effectEnd: 3.5 }] });
    expect(filter).toContain('clip((on-36)/48,0,1)');
    expect(filter).toContain("x='(iw-iw/zoom)*(if(lt(on,36)");
    expect(filter).toContain("z='if(lt(on,36),1.08");
  });

  it('passes file paths as separate process arguments', () => {
    const job = { inputPath: 'input image.jpg', outputPath: 'output video.mp4', settings } as RenderJob;
    const args = buildFfmpegArgs(job);
    expect(args).toContain('input image.jpg');
    expect(args.at(-1)).toBe('output video.mp4');
    expect(args).toContain('libx264');
    expect(args).toContain('22');
    expect(args.slice(args.indexOf('-g'), args.indexOf('-g') + 2)).toEqual(['-g', '30']);
    expect(args).toContain('+faststart');
    expect(args).toContain('-an');
  });

  it('loops and mixes an uploaded soundtrack into the final video', () => {
    const job = { inputPath: 'input.jpg', audioPath: 'music.mp3', outputPath: 'output.mp4', settings: { ...settings, audioVolume: 0.65 } } as RenderJob;
    const args = buildFfmpegArgs(job);
    expect(args.slice(args.indexOf('-stream_loop'), args.indexOf('-stream_loop') + 4)).toEqual(['-stream_loop', '-1', '-i', 'music.mp3']);
    expect(args).toContain('volume=0.65');
    expect(args).toContain('aac');
    expect(args).toContain('-shortest');
  });

  it('supports edge-to-edge framing without transitions', () => {
    const filter = buildVideoFilter({ ...settings, fit: 'cover', fade: false, motion: 'still', effects: [{ motion: 'still', focus: 'center', effectStart: 0, effectEnd: 5 }] });
    expect(filter).toContain('force_original_aspect_ratio=increase');
    expect(filter).toContain('crop=1920:1080:(iw-ow)/2:(ih-oh)/2');
    expect(filter).not.toContain('fade=');
  });

  it('anchors zoom motion at the selected focal placement', () => {
    const filter = buildVideoFilter({ ...settings, focus: 'bottom', effects: [{ motion: 'zoom-in', focus: 'bottom', effectStart: 1, effectEnd: 4 }] });
    expect(filter).toContain("y='(ih-ih/zoom)*(if(lt(on,30),1");
  });

  it('builds continuous expressions for multiple ordered effects', () => {
    const filter = buildVideoFilter({
      ...settings,
      effects: [
        { motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 2 },
        { motion: 'pan-right', focus: 'center', effectStart: 2, effectEnd: 5 },
      ],
    });
    expect(filter).toContain('clip((on-0)/60,0,1)');
    expect(filter).toContain('clip((on-60)/90,0,1)');
    expect(filter).toContain('if(lt(on,60)');
  });
});
