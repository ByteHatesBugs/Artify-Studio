import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { config } from './config.js';
import type { RenderJob, RenderSettings, Resolution } from './types.js';

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

export const buildVideoFilter = (settings: RenderSettings) => {
  const [width, height] = dimensions[settings.resolution];
  const frames = Math.ceil(settings.duration * settings.fps);
  const effectStartFrame = Math.round(settings.effectStart * settings.fps);
  const effectFrames = Math.max(1, Math.round((settings.effectEnd - settings.effectStart) * settings.fps));
  const effectProgress = `clip((on-${effectStartFrame})/${effectFrames},0,1)`;
  const base = settings.fit === 'cover'
    ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
    : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${settings.background}`;
  const fadeDuration = Math.min(0.5, settings.duration / 4);
  const fades = settings.fade
    ? `,fade=t=in:st=0:d=${fadeDuration},fade=t=out:st=${Math.max(0, settings.duration - fadeDuration)}:d=${fadeDuration}`
    : '';

  if (settings.motion === 'still') return `${base}${fades},format=yuv420p`;

  const zoom = settings.motion === 'zoom-out'
    ? `1.12-${effectProgress}*0.12`
    : `1+${effectProgress}*0.12`;
  const x = settings.motion === 'pan-left'
    ? `(iw-iw/zoom)*(1-${effectProgress})`
    : settings.motion === 'pan-right'
      ? `(iw-iw/zoom)*${effectProgress}`
      : 'iw/2-(iw/zoom/2)';
  const y = 'ih/2-(ih/zoom/2)';

  return `${base},zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${width}x${height}:fps=${settings.fps}${fades},format=yuv420p`;
};

export const buildFfmpegArgs = (job: RenderJob) => {
  const quality = qualityProfiles[job.settings.quality];
  const args = [
    '-hide_banner', '-y', '-loop', '1', '-i', job.inputPath,
    '-vf', buildVideoFilter(job.settings),
    '-t', String(job.settings.duration), '-r', String(job.settings.fps),
    '-progress', 'pipe:1', '-nostats',
  ];

  if (job.settings.format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', quality.webmCrf, '-b:v', '0', '-cpu-used', quality.cpuUsed);
  } else {
    args.push('-c:v', 'libx264', '-preset', quality.preset, '-crf', quality.mp4Crf, '-movflags', '+faststart');
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
