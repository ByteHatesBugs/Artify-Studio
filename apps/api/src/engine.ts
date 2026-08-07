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
    this.status = await new Promise<EngineStatus>((resolve) => {
      const process = spawn(config.ffmpegPath, ['-version'], { windowsHide: true });
      let output = '';
      let settled = false;
      const finish = (status: EngineStatus) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(status);
      };
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        finish({ ready: false, error: 'FFmpeg did not respond within 5 seconds.', checkedAt: new Date().toISOString() });
      }, 5000);
      process.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      process.once('error', (error) => finish({ ready: false, error: error.message, checkedAt: new Date().toISOString() }));
      process.once('close', (code) => {
        const version = output.split(/\r?\n/)[0]?.replace(/^ffmpeg version\s+/i, '') || undefined;
        finish(code === 0
          ? { ready: true, version, checkedAt: new Date().toISOString() }
          : { ready: false, error: `FFmpeg exited with code ${code ?? 'unknown'}.`, checkedAt: new Date().toISOString() });
      });
    });
    return this.status;
  }
}

export const mediaEngine = new MediaEngine();
