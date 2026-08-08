import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { config } from './config.js';
import type { EffectSegment, RenderJob, RenderSettings, Resolution } from './types.js';

const dimensions: Record<Resolution, [number, number]> = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  square: [1080, 1080],
  portrait: [1080, 1920],
};

const qualityProfiles = {
  draft: { mp4Crf: '28', preset: 'veryfast', webmCrf: '38', cpuUsed: '6' },
  balanced: { mp4Crf: '22', preset: 'medium', webmCrf: '30', cpuUsed: '4' },
  high: { mp4Crf: '18', preset: 'slow', webmCrf: '22', cpuUsed: '2' },
} as const;

interface MotionState {
  zoom: number;
  x: number;
  y: number;
}

const focusPosition = (focus: EffectSegment['focus']) => ({
  x: focus === 'left' ? 0 : focus === 'right' ? 1 : 0.5,
  y: focus === 'top' ? 0 : focus === 'bottom' ? 1 : 0.5,
});

const initialMotionState = (effect: EffectSegment): MotionState => {
  const focus = focusPosition(effect.focus);
  return {
    zoom: effect.motion === 'zoom-out' || effect.motion.startsWith('pan-') ? 1.08 : 1,
    x: effect.motion === 'pan-left' ? 1 : effect.motion === 'pan-right' ? 0 : focus.x,
    y: focus.y,
  };
};

const targetMotionState = (effect: EffectSegment, current: MotionState): MotionState => {
  const focus = focusPosition(effect.focus);
  return {
    zoom: effect.motion === 'zoom-in' || effect.motion.startsWith('pan-') ? 1.08 : effect.motion === 'zoom-out' ? 1 : current.zoom,
    x: effect.motion === 'pan-left' ? 0 : effect.motion === 'pan-right' ? 1 : focus.x,
    y: focus.y,
  };
};

const numberExpression = (value: number) => Number(value.toFixed(5)).toString();

export const buildVideoFilter = (settings: RenderSettings) => {
  const [width, height] = dimensions[settings.resolution];
  const frames = Math.ceil(settings.duration * settings.fps);
  const effects = settings.effects?.length ? settings.effects : [{
    motion: settings.motion,
    focus: settings.focus ?? 'center',
    effectStart: settings.effectStart,
    effectEnd: settings.effectEnd,
  }];
  const workingScale = effects.every((effect) => effect.motion === 'still') ? 1 : 2;
  const canvasWidth = width * workingScale;
  const canvasHeight = height * workingScale;
  const focus = effects[0]?.focus ?? settings.focus ?? 'center';
  const horizontalCrop = focus === 'left' ? '0' : focus === 'right' ? 'iw-ow' : '(iw-ow)/2';
  const verticalCrop = focus === 'top' ? '0' : focus === 'bottom' ? 'ih-oh' : '(ih-oh)/2';
  const horizontalPad = focus === 'left' ? '0' : focus === 'right' ? 'ow-iw' : '(ow-iw)/2';
  const verticalPad = focus === 'top' ? '0' : focus === 'bottom' ? 'oh-ih' : '(oh-ih)/2';
  const base = settings.fit === 'cover'
    ? `scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=increase,crop=${canvasWidth}:${canvasHeight}:${horizontalCrop}:${verticalCrop}`
    : `scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=decrease,pad=${canvasWidth}:${canvasHeight}:${horizontalPad}:${verticalPad}:${settings.background}`;
  const fadeDuration = Math.min(0.5, settings.duration / 4);
  const fades = settings.fade
    ? `,fade=t=in:st=0:d=${fadeDuration},fade=t=out:st=${Math.max(0, settings.duration - fadeDuration)}:d=${fadeDuration}`
    : '';

  if (effects.every((effect) => effect.motion === 'still')) return `${base}${fades},format=yuv420p`;

  let state = initialMotionState(effects[0]!);
  const transitions = effects.map((effect) => {
    const from = state;
    const to = targetMotionState(effect, from);
    state = to;
    const start = Math.round(effect.effectStart * settings.fps);
    const duration = Math.max(1, Math.round((effect.effectEnd - effect.effectStart) * settings.fps));
    const linear = `clip((on-${start})/${duration},0,1)`;
    const progress = `(${linear})*(${linear})*(3-2*(${linear}))`;
    return { start, end: start + duration, from, to, progress };
  });

  const propertyExpression = (property: keyof MotionState) => {
    let expression = numberExpression(transitions.at(-1)!.to[property]);
    for (let index = transitions.length - 1; index >= 0; index -= 1) {
      const transition = transitions[index]!;
      const from = numberExpression(transition.from[property]);
      const delta = numberExpression(transition.to[property] - transition.from[property]);
      const during = delta === '0' ? from : `${from}+(${delta})*(${transition.progress})`;
      expression = `if(lt(on,${transition.start}),${from},if(lte(on,${transition.end}),${during},${expression}))`;
    }
    return expression;
  };

  const zoom = propertyExpression('zoom');
  const xFactor = propertyExpression('x');
  const yFactor = propertyExpression('y');
  const x = `(iw-iw/zoom)*(${xFactor})`;
  const y = `(ih-ih/zoom)*(${yFactor})`;

  return `${base},zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${width}x${height}:fps=${settings.fps}${fades},format=yuv420p`;
};

export const buildFfmpegArgs = (job: RenderJob) => {
  const quality = qualityProfiles[job.settings.quality];
  const args = [
    '-hide_banner', '-y', '-loop', '1', '-i', job.inputPath,
    '-vf', buildVideoFilter(job.settings),
    '-t', String(job.settings.duration), '-r', String(job.settings.fps),
    '-g', String(job.settings.fps),
    '-progress', 'pipe:1', '-nostats',
  ];

  if (job.settings.format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', quality.webmCrf, '-b:v', '0', '-cpu-used', quality.cpuUsed);
  } else {
    args.push('-c:v', 'libx264', '-preset', quality.preset, '-crf', quality.mp4Crf, '-keyint_min', String(job.settings.fps), '-sc_threshold', '0', '-movflags', '+faststart');
  }

  args.push(job.outputPath);
  return args;
};

export interface RenderHandle {
  process: ChildProcessWithoutNullStreams;
  completion: Promise<void>;
}

export const renderImage = (job: RenderJob, onProgress: (progress: number) => void): RenderHandle => {
  const child = spawn(config.ffmpegPath, buildFfmpegArgs(job), { windowsHide: true });
  let stderr = '';
  let stdoutBuffer = '';

  child.stderr.on('data', (chunk: Buffer) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-4000);
  });

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key === 'out_time_ms' && value) {
        const elapsedSeconds = Number(value) / 1_000_000;
        onProgress(Math.min(99, Math.max(1, Math.round((elapsedSeconds / job.settings.duration) * 100))));
      }
    }
  });

  const completion = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code ?? 'unknown'}`));
    });
  });

  return { process: child, completion };
};
