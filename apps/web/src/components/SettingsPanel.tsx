import { Clapperboard, Clock3, Gauge, MonitorUp, Play, Sparkles } from 'lucide-react';
import type { RenderSettings } from '../types';

interface SettingsPanelProps {
  settings: RenderSettings;
  imageCount: number;
  isSubmitting: boolean;
  onChange: (settings: RenderSettings) => void;
  onSubmit: () => void;
}

const resolutions = [
  { value: '720p', label: 'HD', detail: '1280 × 720' },
  { value: '1080p', label: 'Full HD', detail: '1920 × 1080' },
  { value: 'square', label: 'Square', detail: '1080 × 1080' },
  { value: 'portrait', label: 'Portrait', detail: '1080 × 1920' },
] as const;

export function SettingsPanel({ settings, imageCount, isSubmitting, onChange, onSubmit }: SettingsPanelProps) {
  const update = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => onChange({ ...settings, [key]: value });
  const estimatedSeconds = Math.ceil(imageCount * settings.duration / 2);

  return (
    <aside className="settings-card" aria-labelledby="settings-heading">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">02 · Render profile</span>
          <h2 id="settings-heading">Motion settings</h2>
        </div>
        <span className="profile-chip"><Sparkles size={13} /> Custom</span>
      </div>

      <label className="field-label" htmlFor="batch-name">Batch name</label>
      <input id="batch-name" className="text-input" value={settings.name} maxLength={80} onChange={(event) => update('name', event.target.value)} />

      <div className="field-grid">
        <label className="field-control">
          <span><Clock3 size={15} /> Duration</span>
          <select value={settings.duration} onChange={(event) => update('duration', Number(event.target.value))}>
            {[3, 5, 8, 10, 15].map((duration) => <option key={duration} value={duration}>{duration} seconds</option>)}
          </select>
        </label>
        <label className="field-control">
          <span><Gauge size={15} /> Frame rate</span>
          <select value={settings.fps} onChange={(event) => update('fps', Number(event.target.value))}>
            {[24, 30, 60].map((fps) => <option key={fps} value={fps}>{fps} FPS</option>)}
          </select>
        </label>
      </div>

      <span className="field-label"><MonitorUp size={15} /> Canvas</span>
      <div className="segmented-grid">
        {resolutions.map((resolution) => (
          <button
            type="button"
            key={resolution.value}
            className={settings.resolution === resolution.value ? 'selected' : ''}
            onClick={() => update('resolution', resolution.value)}
          >
            <strong>{resolution.label}</strong><span>{resolution.detail}</span>
          </button>
        ))}
      </div>

      <label className="field-control full">
        <span><Sparkles size={15} /> Motion</span>
        <select value={settings.motion} onChange={(event) => update('motion', event.target.value as RenderSettings['motion'])}>
          <option value="zoom-in">Slow zoom in</option>
          <option value="zoom-out">Slow zoom out</option>
          <option value="pan-left">Pan left</option>
          <option value="pan-right">Pan right</option>
          <option value="still">Still frame</option>
        </select>
      </label>

      <div className="field-grid">
        <label className="field-control">
          <span><Clapperboard size={15} /> Format</span>
          <select value={settings.format} onChange={(event) => update('format', event.target.value as RenderSettings['format'])}>
            <option value="mp4">MP4 · H.264</option>
            <option value="webm">WebM · VP9</option>
          </select>
        </label>
        <label className="field-control color-control">
          <span>Background</span>
          <div><input type="color" value={settings.background} onChange={(event) => update('background', event.target.value)} /><code>{settings.background}</code></div>
        </label>
      </div>

      <div className="render-summary">
        <div><span>Outputs</span><strong>{imageCount || '—'} videos</strong></div>
        <div><span>Est. processing</span><strong>{imageCount ? `~${estimatedSeconds}s` : '—'}</strong></div>
      </div>
      <button className="primary-button" type="button" onClick={onSubmit} disabled={!imageCount || isSubmitting || !settings.name.trim()}>
        {isSubmitting ? <span className="spinner" /> : <Play size={17} fill="currentColor" />}
        {isSubmitting ? 'Uploading batch…' : `Render ${imageCount || 0} video${imageCount === 1 ? '' : 's'}`}
      </button>
      <p className="privacy-note">Files stay on your processing server and expire automatically.</p>
    </aside>
  );
}
