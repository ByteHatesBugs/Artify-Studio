import { Blend, Clapperboard, Clock3, Crop, Eye, Gauge, MonitorUp, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { RenderSettings } from '../types';

interface SettingsPanelProps {
  settings: RenderSettings;
  previewImage?: string;
  imageCount: number;
  isSubmitting: boolean;
  engineReady: boolean;
  onChange: (settings: RenderSettings) => void;
  onReset: () => void;
  onSubmit: () => void;
}

const resolutions = [
  { value: '720p', label: 'HD', detail: '1280 × 720' },
  { value: '1080p', label: 'Full HD', detail: '1920 × 1080' },
  { value: 'square', label: 'Square', detail: '1080 × 1080' },
  { value: 'portrait', label: 'Portrait', detail: '1080 × 1920' },
] as const;

const profiles: Array<{ label: string; detail: string; settings: Partial<RenderSettings> }> = [
  { label: 'Campaign', detail: 'Full HD · MP4', settings: { resolution: '1080p', format: 'mp4', motion: 'zoom-in', duration: 5, fps: 30, fit: 'cover', quality: 'high', fade: true } },
  { label: 'Social', detail: 'Portrait · MP4', settings: { resolution: 'portrait', format: 'mp4', motion: 'zoom-in', duration: 5, fps: 30, fit: 'cover', quality: 'balanced', fade: true } },
  { label: 'Lightweight', detail: 'HD · WebM', settings: { resolution: '720p', format: 'webm', motion: 'still', duration: 3, fps: 24, fit: 'contain', quality: 'draft', fade: false } },
];

export function SettingsPanel({ settings, previewImage, imageCount, isSubmitting, engineReady, onChange, onReset, onSubmit }: SettingsPanelProps) {
  const update = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => onChange({ ...settings, [key]: value });
  const qualityFactor = settings.quality === 'draft' ? 0.65 : settings.quality === 'high' ? 1.6 : 1;
  const estimatedSeconds = Math.ceil((imageCount * settings.duration / 2) * qualityFactor);

  return (
    <aside className="settings-card" aria-labelledby="settings-heading">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">02 · Render profile</span>
          <h2 id="settings-heading">Motion settings</h2>
        </div>
        <button className="profile-reset" type="button" onClick={onReset} title="Reset render settings"><RotateCcw size={13} /> Reset</button>
      </div>

      <span className="field-label first-label"><Sparkles size={15} /> Quick profiles</span>
      <div className="profile-grid">
        {profiles.map((profile) => (
          <button type="button" key={profile.label} onClick={() => onChange({ ...settings, ...profile.settings })}>
            <strong>{profile.label}</strong><span>{profile.detail}</span>
          </button>
        ))}
      </div>

      <div className="preview-heading"><span><Eye size={14} /> Live preview</span><small>First frame</small></div>
      <div className={`motion-preview preview-${settings.resolution}`} style={{ backgroundColor: settings.background }}>
        {previewImage ? (
          <img
            key={`${previewImage}-${settings.motion}-${settings.fit}-${settings.fade}`}
            className={`motion-${settings.motion} ${settings.fade ? 'with-fade' : ''}`}
            src={previewImage}
            alt="Motion preview of the first selected image"
            style={{ objectFit: settings.fit }}
          />
        ) : <div className="preview-placeholder"><Sparkles size={19} /><span>Add an image to preview motion</span></div>}
        <span className="preview-badge">{settings.fit} · {settings.motion.replace('-', ' ')}</span>
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

      <div className="field-grid">
        <label className="field-control">
          <span><Crop size={15} /> Framing</span>
          <select value={settings.fit} onChange={(event) => update('fit', event.target.value as RenderSettings['fit'])}>
            <option value="contain">Fit entire image</option>
            <option value="cover">Fill and crop</option>
          </select>
        </label>
        <label className="field-control">
          <span><Gauge size={15} /> Quality</span>
          <select value={settings.quality} onChange={(event) => update('quality', event.target.value as RenderSettings['quality'])}>
            <option value="draft">Draft · Fast</option>
            <option value="balanced">Balanced</option>
            <option value="high">High · Detailed</option>
          </select>
        </label>
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

      <button className="switch-row" type="button" role="switch" aria-checked={settings.fade} onClick={() => update('fade', !settings.fade)}>
        <span className="switch-copy"><Blend size={15} /><span><strong>Fade transition</strong><small>Ease the video in and out</small></span></span>
        <span className={`switch ${settings.fade ? 'on' : ''}`}><span /></span>
      </button>

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
        <div><span>Profile</span><strong>{settings.quality}</strong></div>
      </div>
      <button className="primary-button" type="button" onClick={onSubmit} disabled={!imageCount || isSubmitting || !settings.name.trim() || !engineReady}>
        {isSubmitting ? <span className="spinner" /> : <Play size={17} fill="currentColor" />}
        {isSubmitting ? 'Uploading batch…' : !engineReady ? 'Render engine unavailable' : `Render ${imageCount || 0} video${imageCount === 1 ? '' : 's'}`}
      </button>
      <p className="privacy-note">{engineReady ? 'Files stay on your processing server and expire automatically.' : 'Ask the server administrator to configure FFmpeg.'}</p>
    </aside>
  );
}
