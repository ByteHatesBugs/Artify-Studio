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
  audioSourceStart: 0,
  audioVideoStart: 0,
  effects: [{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 1, effectEnd: 4 }],
};

describe('media command construction', () => {
  it('creates a padded 1080p zoom filter', () => {
    const filter = buildVideoFilter(settings);
    expect(filter).toContain('scale=2880:1620');
    expect(filter).toContain('flags=lanczos+accurate_rnd');
    expect(filter).toContain('s=2880x1620');
    expect(filter).toContain('scale=1920:1080:flags=lanczos+accurate_rnd');
    expect(filter).toContain('setsar=1');
    expect(filter).toContain('zoompan');
    expect(filter).toContain('clip((on-30)/90,0,1)');
    expect(filter).toContain('*6-15)+10');
    expect(filter).toContain('fps=30');
    expect(filter).toContain('fade=t=in');
  });

  it('holds motion outside the selected effect window', () => {
    const filter = buildVideoFilter({ ...settings, fps: 24, effectStart: 1.5, effectEnd: 3.5, motion: 'pan-right', effects: [{ motion: 'pan-right', focus: 'center', strength: 50, effectStart: 1.5, effectEnd: 3.5 }] });
    expect(filter).toContain('clip((on-36)/48,0,1)');
    expect(filter).toContain("x='(iw-iw/zoom)*(if(between(on,36,84)");
    expect(filter).toContain("z='if(between(on,36,84),1.06");
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
    const job = { inputPath: 'input.jpg', audioPath: 'music.mp3', outputPath: 'output.mp4', settings: { ...settings, audioVolume: 0.65, audioSourceStart: 12.5, audioVideoStart: 1.25 } } as RenderJob;
    const args = buildFfmpegArgs(job);
    expect(args.slice(args.indexOf('-stream_loop'), args.indexOf('-stream_loop') + 6)).toEqual(['-stream_loop', '-1', '-ss', '12.5', '-i', 'music.mp3']);
    expect(args).toContain('atrim=duration=3.75,asetpts=PTS-STARTPTS,adelay=1250:all=1,volume=0.65');
    expect(args).toContain('aac');
    expect(args).toContain('-shortest');
  });

  it('supports edge-to-edge framing without transitions', () => {
    const filter = buildVideoFilter({ ...settings, fit: 'cover', fade: false, motion: 'still', effects: [{ motion: 'still', focus: 'center', strength: 0, effectStart: 0, effectEnd: 5 }] });
    expect(filter).toContain('force_original_aspect_ratio=increase');
    expect(filter).toContain('crop=1920:1080:(iw-ow)/2:(ih-oh)/2');
    expect(filter).not.toContain('fade=');
  });

  it('anchors zoom motion at the selected focal placement', () => {
    const filter = buildVideoFilter({ ...settings, focus: 'bottom', effects: [{ motion: 'zoom-in', focus: 'bottom', strength: 50, effectStart: 1, effectEnd: 4 }] });
    expect(filter).toContain("y='(ih-ih/zoom)*(if(between(on,30,120),1");
  });

  it('builds smooth expressions for multiple effects', () => {
    const filter = buildVideoFilter({
      ...settings,
      effects: [
        { motion: 'zoom-in', focus: 'center', strength: 35, effectStart: 0, effectEnd: 2 },
        { motion: 'pan-right', focus: 'center', strength: 70, effectStart: 2, effectEnd: 5 },
      ],
    });
    expect(filter).toContain('clip((on-0)/60,0,1)');
    expect(filter).toContain('clip((on-60)/90,0,1)');
    expect(filter).toContain('if(between(on,60,150)');
  });

  it('gives the first listed effect priority during overlaps', () => {
    const filter = buildVideoFilter({
      ...settings,
      effects: [
        { motion: 'zoom-in', focus: 'center', strength: 35, effectStart: 2, effectEnd: 5 },
        { motion: 'pan-right', focus: 'center', strength: 70, effectStart: 0, effectEnd: 4 },
      ],
    });
    const firstPriority = filter.indexOf('if(between(on,60,150)');
    const secondPriority = filter.indexOf('if(between(on,0,120)');
    expect(firstPriority).toBeGreaterThan(-1);
    expect(secondPriority).toBeGreaterThan(firstPriority);
  });

  it('maps effect strength to subtle and strong motion amplitudes', () => {
    const subtle = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, strength: 25 }] });
    const strong = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, strength: 100 }] });
    expect(subtle).toContain('1.03');
    expect(strong).toContain('1.12');
  });

  it('supports smooth vertical and diagonal motion paths', () => {
    const vertical = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, motion: 'pan-up' }] });
    const diagonal = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, motion: 'drift-down-right' }] });
    expect(vertical).toContain("y='(ih-ih/zoom)*(if(between(on,30,120),0.75+");
    expect(diagonal).toContain("x='(iw-iw/zoom)*(if(between(on,30,120),0.25+");
    expect(diagonal).toContain("y='(ih-ih/zoom)*(if(between(on,30,120),0.25+");
  });

  it('builds distinct professional motion curves per effect', () => {
    const linear = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, easing: 'linear' }] });
    const smooth = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, easing: 'ease-in-out' }] });
    const easeOut = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, easing: 'ease-out' }] });
    const cinematic = buildVideoFilter({ ...settings, effects: [{ ...settings.effects[0]!, easing: 'cinematic' }] });
    expect(linear).toContain('+(0.06)*(clip((on-30)/90,0,1))');
    expect(smooth).toContain('3-2*(clip((on-30)/90,0,1))');
    expect(easeOut).toContain('1-(1-(clip((on-30)/90,0,1)))');
    expect(cinematic).toContain('*6-15)+10');
  });
});
