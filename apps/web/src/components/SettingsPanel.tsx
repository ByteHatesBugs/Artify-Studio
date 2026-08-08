import { useEffect, useRef, useState } from 'react';
import { Blend, Clapperboard, Clock3, Crop, Eye, Gauge, MonitorUp, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { RenderSettings } from '../types';
import { resolutionAspect, resolutionOptions } from '../resolutionOptions';
import { EffectStackEditor } from './EffectStackEditor';

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

const profiles: Array<{ label: string; detail: string; settings: Partial<RenderSettings> }> = [
  { label: 'Campaign', detail: 'Full HD · MP4', settings: { resolution: '1080p', format: 'mp4', motion: 'zoom-in', focus: 'center', duration: 5, effectStart: 0, effectEnd: 5, effects: [{ motion: 'zoom-in', focus: 'center', strength: 50, easing: 'cinematic', speed: 1, effectStart: 0, effectEnd: 5 }], fps: 30, fit: 'cover', quality: 'high', fade: true } },
  { label: 'Social', detail: 'Portrait · MP4', settings: { resolution: 'portrait', format: 'mp4', motion: 'zoom-in', focus: 'center', duration: 5, effectStart: 0.5, effectEnd: 4.5, effects: [{ motion: 'zoom-in', focus: 'center', strength: 45, easing: 'ease-in-out', speed: 1, effectStart: 0.5, effectEnd: 4.5 }], fps: 30, fit: 'cover', quality: 'balanced', fade: true } },
  { label: 'Lightweight', detail: 'HD · WebM', settings: { resolution: '720p', format: 'webm', motion: 'still', focus: 'center', duration: 3, effectStart: 0, effectEnd: 3, effects: [{ motion: 'still', focus: 'center', strength: 0, easing: 'linear', speed: 1, effectStart: 0, effectEnd: 3 }], fps: 24, fit: 'cover', quality: 'draft', fade: false } },
];

export function SettingsPanel({ settings, previewImage, imageCount, isSubmitting, engineReady, onChange, onReset, onSubmit }: SettingsPanelProps) {
  const previewRef = useRef<HTMLImageElement>(null);
  const [previewEffects, setPreviewEffects] = useState(settings.effects);
  const update = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => onChange({ ...settings, [key]: value });
  const qualityFactor = settings.quality === 'draft' ? 0.65 : settings.quality === 'high' ? 1.6 : 1;
  const estimatedSeconds = Math.ceil((imageCount * settings.duration / 2) * qualityFactor);
  const readyToRender = imageCount > 0 && settings.name.trim().length > 0 && engineReady;
  const readinessMessage = !imageCount
    ? 'Add at least one image to continue.'
    : !settings.name.trim()
      ? 'Enter a batch name to continue.'
      : !engineReady
        ? 'The render engine must be ready before exporting.'
        : `Ready for ${imageCount} verified, silent ${settings.format.toUpperCase()} output${imageCount === 1 ? '' : 's'}.`;
  const submitLabel = isSubmitting
    ? 'Uploading batch…'
    : !engineReady
      ? 'Render engine unavailable'
      : !imageCount
        ? 'Add images to continue'
        : !settings.name.trim()
          ? 'Name your batch to continue'
          : `Render ${imageCount} video${imageCount === 1 ? '' : 's'}`;
  const primaryEffect = settings.effects[0]!;
  const objectPosition = { center: 'center', top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center' }[primaryEffect.focus];
  const isProfileSelected = (profile: (typeof profiles)[number]) => Object.entries(profile.settings).every(([key, value]) => {
    const current = settings[key as keyof RenderSettings];
    return Array.isArray(value) ? JSON.stringify(current) === JSON.stringify(value) : current === value;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewEffects(settings.effects), 90);
    return () => window.clearTimeout(timer);
  }, [settings.effects]);

  useEffect(() => {
    const element = previewRef.current;
    if (!element || !previewImage) return;
    const transformsFor = (effect: RenderSettings['effects'][number], progress: number) => {
      const ratio = (effect.strength ?? 50) / 100;
      const scale = 1 + 0.12 * ratio;
      const travel = 6 * ratio;
      const speedAdjusted = Math.max(0, Math.min(1, progress * (effect.speed ?? 1)));
      const eased = effect.easing === 'linear' ? speedAdjusted
        : effect.easing === 'ease-in' ? speedAdjusted ** 3
          : effect.easing === 'ease-out' ? 1 - (1 - speedAdjusted) ** 3
            : effect.easing === 'ease-in-out' ? speedAdjusted * speedAdjusted * (3 - 2 * speedAdjusted)
              : speedAdjusted * speedAdjusted * speedAdjusted * (speedAdjusted * (speedAdjusted * 6 - 15) + 10);
      if (effect.motion === 'zoom-in') return `scale(${1 + (scale - 1) * eased})`;
      if (effect.motion === 'zoom-out') return `scale(${scale - (scale - 1) * eased})`;
      if (effect.motion === 'pan-left') return `scale(${scale}) translateX(${travel - travel * 2 * eased}%)`;
      if (effect.motion === 'pan-right') return `scale(${scale}) translateX(${-travel + travel * 2 * eased}%)`;
      if (effect.motion === 'pan-up') return `scale(${scale}) translateY(${travel - travel * 2 * eased}%)`;
      if (effect.motion === 'pan-down') return `scale(${scale}) translateY(${-travel + travel * 2 * eased}%)`;
      const horizontal = effect.motion.endsWith('left') ? travel - travel * 2 * eased : -travel + travel * 2 * eased;
      const vertical = effect.motion.includes('up-') ? travel - travel * 2 * eased : -travel + travel * 2 * eased;
      if (effect.motion.startsWith('drift-')) return `scale(${scale}) translate(${horizontal}%, ${vertical}%)`;
      return 'scale(1)';
    };
    const keyframes: Keyframe[] = Array.from({ length: 61 }, (_, index) => {
      const offset = index / 60;
      const time = offset * settings.duration;
      const active = previewEffects.find((effect) => time >= effect.effectStart && time <= effect.effectEnd);
      const completed = [...previewEffects].filter((effect) => effect.effectEnd < time).sort((left, right) => right.effectEnd - left.effectEnd)[0];
      const effect = active ?? completed;
      const progress = !effect ? 0 : active ? Math.max(0, Math.min(1, (time - effect.effectStart) / (effect.effectEnd - effect.effectStart))) : 1;
      return { transform: effect ? transformsFor(effect, progress) : 'scale(1)', offset };
    });
    const motionAnimation = element.animate(keyframes, { duration: settings.duration * 1000, iterations: Infinity, easing: 'linear' });
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
  }, [previewEffects, previewImage, settings.duration, settings.fade]);

  const changeDuration = (duration: number) => {
    const effects = settings.effects.map((effect) => ({
      ...effect,
      effectStart: Number(((effect.effectStart / settings.duration) * duration).toFixed(2)),
      effectEnd: Number(((effect.effectEnd / settings.duration) * duration).toFixed(2)),
    }));
    const primary = effects[0]!;
    onChange({ ...settings, duration, effects, motion: primary.motion, focus: primary.focus, effectStart: primary.effectStart, effectEnd: primary.effectEnd });
  };

  const changeEffects = (effects: RenderSettings['effects']) => {
    const primary = effects[0]!;
    onChange({ ...settings, effects, motion: primary.motion, focus: primary.focus, effectStart: primary.effectStart, effectEnd: primary.effectEnd });
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
          <button
            type="button"
            key={profile.label}
            className={isProfileSelected(profile) ? 'selected' : ''}
            aria-pressed={isProfileSelected(profile)}
            onClick={() => onChange({ ...settings, ...profile.settings })}
          >
            <strong>{profile.label}</strong><span>{profile.detail}</span>
          </button>
        ))}
      </div>

      <div className="preview-heading"><span><Eye size={14} /> Live preview</span><small>First frame</small></div>
      <div className={`motion-preview preview-${resolutionAspect(settings.resolution)}`} style={{ backgroundColor: settings.background }}>
        {previewImage ? (
          <img
            ref={previewRef}
            src={previewImage}
            alt="Motion preview of the first selected image"
            decoding="async"
            style={{ objectFit: settings.fit, objectPosition }}
          />
        ) : <div className="preview-placeholder"><Sparkles size={19} /><span>Add an image to preview motion</span></div>}
        <span className="preview-badge">{settings.fit} · {settings.effects.length} effect{settings.effects.length === 1 ? '' : 's'}</span>
      </div>

      <label className="field-label" htmlFor="batch-name">Batch name</label>
      <input id="batch-name" className="text-input" value={settings.name} maxLength={80} onChange={(event) => update('name', event.target.value)} />

      <div className="field-grid">
        <label className="field-control">
          <span><Clock3 size={15} /> Duration</span>
          <select value={settings.duration} onChange={(event) => changeDuration(Number(event.target.value))}>
            {[3, 5, 8, 10, 15, 30, 45, 60].map((duration) => <option key={duration} value={duration}>{duration} seconds</option>)}
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
        {resolutionOptions.map((resolution) => (
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
        <div className="field-control full-frame-control">
          <span><Crop size={15} /> Framing</span>
          <div><strong>Full frame</strong><small>Edge-to-edge output</small></div>
        </div>
        <label className="field-control">
          <span><Gauge size={15} /> Quality</span>
          <select value={settings.quality} onChange={(event) => update('quality', event.target.value as RenderSettings['quality'])}>
            <option value="draft">Draft · Fast</option>
            <option value="balanced">Balanced</option>
            <option value="high">High · Detailed</option>
          </select>
        </label>
      </div>

      <EffectStackEditor effects={settings.effects} duration={settings.duration} onChange={changeEffects} />

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
      {imageCount > 1 && <p className="batch-settings-note">These are batch defaults. Use “Effect” on any image to set its own motion, focus, and timing.</p>}
      <div className="requirement-summary" aria-label="Video output requirements">
        <span><strong>{resolutionOptions.find((option) => option.value === settings.resolution)?.detail}</strong> canvas</span>
        <span><strong>{settings.duration}s</strong> duration</span>
        <span><strong>{settings.fps}</strong> FPS</span>
        <span><strong>Silent</strong> output</span>
      </div>
      <button className="primary-button" type="button" onClick={onSubmit} disabled={!readyToRender || isSubmitting} title="Render batch · Ctrl or Command + Enter" aria-describedby="render-readiness">
        {isSubmitting ? <span className="spinner" /> : <Play size={17} fill="currentColor" />}
        {submitLabel}
        {!isSubmitting && engineReady && <kbd>Ctrl/⌘ ↵</kbd>}
      </button>
      <p className={`privacy-note ${readyToRender ? 'is-ready' : ''}`} id="render-readiness" aria-live="polite">{readinessMessage}</p>
    </aside>
  );
}
