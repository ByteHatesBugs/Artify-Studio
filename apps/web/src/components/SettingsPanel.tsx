import { useEffect, useRef } from 'react';
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
  { label: 'Campaign', detail: 'Full HD · MP4', settings: { resolution: '1080p', format: 'mp4', motion: 'zoom-in', duration: 5, effectStart: 0, effectEnd: 5, fps: 30, fit: 'cover', quality: 'high', fade: true } },
  { label: 'Social', detail: 'Portrait · MP4', settings: { resolution: 'portrait', format: 'mp4', motion: 'zoom-in', duration: 5, effectStart: 0.5, effectEnd: 4.5, fps: 30, fit: 'cover', quality: 'balanced', fade: true } },
  { label: 'Lightweight', detail: 'HD · WebM', settings: { resolution: '720p', format: 'webm', motion: 'still', duration: 3, effectStart: 0, effectEnd: 3, fps: 24, fit: 'contain', quality: 'draft', fade: false } },
];

export function SettingsPanel({ settings, previewImage, imageCount, isSubmitting, engineReady, onChange, onReset, onSubmit }: SettingsPanelProps) {
  const previewRef = useRef<HTMLImageElement>(null);
  const update = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => onChange({ ...settings, [key]: value });
  const qualityFactor = settings.quality === 'draft' ? 0.65 : settings.quality === 'high' ? 1.6 : 1;
  const estimatedSeconds = Math.ceil((imageCount * settings.duration / 2) * qualityFactor);
  const effectLeft = (settings.effectStart / settings.duration) * 100;
  const effectWidth = ((settings.effectEnd - settings.effectStart) / settings.duration) * 100;

  useEffect(() => {
    const element = previewRef.current;
    if (!element || !previewImage) return;
    const transforms: Record<RenderSettings['motion'], [string, string]> = {
      'zoom-in': ['scale(1)', 'scale(1.08)'],
      'zoom-out': ['scale(1.08)', 'scale(1)'],
      'pan-left': ['scale(1.08) translateX(3%)', 'scale(1.08) translateX(-3%)'],
      'pan-right': ['scale(1.08) translateX(-3%)', 'scale(1.08) translateX(3%)'],
      still: ['scale(1)', 'scale(1)'],
    };
    const [from, to] = transforms[settings.motion];
    const startOffset = settings.effectStart / settings.duration;
    const endOffset = settings.effectEnd / settings.duration;
    const motionAnimation = element.animate([
      { transform: from, offset: 0 },
      { transform: from, offset: startOffset, easing: 'ease-in-out' },
      { transform: to, offset: endOffset },
      { transform: to, offset: 1 },
    ], { duration: settings.duration * 1000, iterations: Infinity, direction: 'alternate', easing: 'linear' });
    const fadeDuration = Math.min(0.5, settings.duration / 4) / settings.duration;
    const fadeAnimation = settings.fade ? element.animate([
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: fadeDuration },
      { opacity: 1, offset: 1 - fadeDuration },
      { opacity: 0, offset: 1 },
    ], { duration: settings.duration * 1000, iterations: Infinity, direction: 'alternate', easing: 'linear' }) : undefined;
    return () => {
      motionAnimation.cancel();
      fadeAnimation?.cancel();
    };
  }, [previewImage, settings.duration, settings.effectStart, settings.effectEnd, settings.motion, settings.fade]);

  const changeDuration = (duration: number) => {
    const effectEnd = Math.min(settings.effectEnd, duration);
    const effectStart = Math.min(settings.effectStart, Math.max(0, effectEnd - 0.1));
    onChange({ ...settings, duration, effectStart, effectEnd });
  };

  const changeEffectStart = (effectStart: number) => {
    onChange({ ...settings, effectStart: Math.max(0, Math.min(effectStart, settings.effectEnd - 0.1)) });
  };

  const changeEffectEnd = (effectEnd: number) => {
    onChange({ ...settings, effectEnd: Math.min(settings.duration, Math.max(effectEnd, settings.effectStart + 0.1)) });
  };

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
            ref={previewRef}
            src={previewImage}
            alt="Motion preview of the first selected image"
            decoding="async"
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
          <select value={settings.duration} onChange={(event) => changeDuration(Number(event.target.value))}>
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

      <div className="timing-control">
        <div className="timing-heading">
          <span><Clock3 size={15} /> Effect timing</span>
          <small>Applied to every image</small>
        </div>
        <div className="timing-track" aria-hidden="true">
          <span style={{ left: `${effectLeft}%`, width: `${effectWidth}%` }} />
        </div>
        <div className="timing-inputs">
          <label>
            <span>Start</span>
            <div><input type="number" min={0} max={Math.max(0, settings.effectEnd - 0.1)} step={0.1} value={settings.effectStart} onChange={(event) => changeEffectStart(Number(event.target.value))} /><small>sec</small></div>
          </label>
          <span className="timing-arrow">→</span>
          <label>
            <span>End</span>
            <div><input type="number" min={settings.effectStart + 0.1} max={settings.duration} step={0.1} value={settings.effectEnd} onChange={(event) => changeEffectEnd(Number(event.target.value))} /><small>sec</small></div>
          </label>
        </div>
        <p>The selected motion starts at {settings.effectStart.toFixed(1)}s, finishes at {settings.effectEnd.toFixed(1)}s, and holds its frame outside that window.</p>
      </div>

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
      {imageCount > 1 && <p className="batch-settings-note">One consistent profile will be applied to all {imageCount} images.</p>}
      <button className="primary-button" type="button" onClick={onSubmit} disabled={!imageCount || isSubmitting || !settings.name.trim() || !engineReady}>
        {isSubmitting ? <span className="spinner" /> : <Play size={17} fill="currentColor" />}
        {isSubmitting ? 'Uploading batch…' : !engineReady ? 'Render engine unavailable' : `Render ${imageCount || 0} video${imageCount === 1 ? '' : 's'}`}
      </button>
      <p className="privacy-note">{engineReady ? 'Files stay on your processing server and expire automatically.' : 'Ask the server administrator to configure FFmpeg.'}</p>
    </aside>
  );
}
