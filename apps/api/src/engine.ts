import { spawn } from 'node:child_process';
import { config } from './config.js';

export interface EngineStatus {
  ready: boolean;
  version?: string;
  error?: string;
  checkedAt: string;
}

class MediaEngine {
  private status: EngineStatus = { ready: false, error: 'FFmpeg has not been checked yet.', checkedAt: new Date().toISOString() };

  get() {
    return this.status;
  }

  async check() {
    const checkExecutable = (executable: string, label: string) => new Promise<{ version?: string; error?: string }>((resolve) => {
      const process = spawn(executable, ['-version'], { windowsHide: true });
      let output = '';
      let settled = false;
      const finish = (result: { version?: string; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        finish({ error: `${label} did not respond within 5 seconds.` });
      }, 5000);
      process.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      process.once('error', (error) => finish({ error: `${label}: ${error.message}` }));
      process.once('close', (code) => {
        const version = output.split(/\r?\n/)[0]?.replace(/^ffmpeg version\s+/i, '') || undefined;
        finish(code === 0 ? { version } : { error: `${label} exited with code ${code ?? 'unknown'}.` });
      });
    });

    const [ffmpeg, ffprobe] = await Promise.all([
      checkExecutable(config.ffmpegPath, 'FFmpeg'),
      checkExecutable(config.ffprobePath, 'FFprobe'),
    ]);
    this.status = ffmpeg.error || ffprobe.error
      ? { ready: false, error: ffmpeg.error ?? ffprobe.error, checkedAt: new Date().toISOString() }
      : { ready: true, version: ffmpeg.version, checkedAt: new Date().toISOString() };
    return this.status;
  }
}

export const mediaEngine = new MediaEngine();
