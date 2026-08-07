import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { config } from './config.js';
import type { RenderJob, RenderSettings, Resolution } from './types.js';

const dimensions: Record<Resolution, [number, number]> = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  square: [1080, 1080],
  portrait: [1080, 1920],
};

export const buildVideoFilter = (settings: RenderSettings) => {
  const [width, height] = dimensions[settings.resolution];
  const frames = Math.ceil(settings.duration * settings.fps);
  const base = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${settings.background}`;

  if (settings.motion === 'still') return `${base},format=yuv420p`;

  const zoom = settings.motion === 'zoom-out'
    ? `1.12-on/${Math.max(frames - 1, 1)}*0.12`
    : `1+on/${Math.max(frames - 1, 1)}*0.12`;
  const x = settings.motion === 'pan-left' ? `(iw-iw/zoom)*(1-on/${frames})` : settings.motion === 'pan-right' ? `(iw-iw/zoom)*on/${frames}` : 'iw/2-(iw/zoom/2)';
  const y = 'ih/2-(ih/zoom/2)';

  return `${base},zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${width}x${height}:fps=${settings.fps},format=yuv420p`;
};

export const buildFfmpegArgs = (job: RenderJob) => {
  const args = [
    '-hide_banner', '-y', '-loop', '1', '-i', job.inputPath,
    '-vf', buildVideoFilter(job.settings),
    '-t', String(job.settings.duration), '-r', String(job.settings.fps),
    '-progress', 'pipe:1', '-nostats',
  ];

  if (job.settings.format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart');
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
