import { useState } from 'react';
import { Clapperboard, Clock3, Crop, Gauge, MonitorUp, RefreshCw, Save, X } from 'lucide-react';
import type { RenderJob } from '../types';
import { EffectStackEditor } from './EffectStackEditor';

interface RenderedVideoEditorProps {
  job: RenderJob;
  busy: boolean;
  onRename: (outputName: string) => void;
  onRerender: (outputName: string, settings: RenderJob['settings']) => void;
  onClose: () => void;
}

const withoutExtension = (name: string) => name.replace(/\.[^.]+$/, '');

export function RenderedVideoEditor({ job, busy, onRename, onRerender, onClose }: RenderedVideoEditorProps) {
  const [outputName, setOutputName] = useState(() => withoutExtension(job.outputName));
  const [settings, setSettings] = useState<RenderJob['settings']>(() => ({
    ...job.settings,
    effects: (job.settings.effects?.length ? job.settings.effects : [{ motion: job.settings.motion, focus: job.settings.focus, effectStart: job.settings.effectStart, effectEnd: job.settings.effectEnd }]).map((effect) => ({ ...effect })),
  }));

  const update = <K extends keyof RenderJob['settings']>(key: K, value: RenderJob['settings'][K]) => setSettings((current) => ({ ...current, [key]: value }));

  const changeDuration = (duration: number) => {
    const safeDuration = Math.max(1, Math.min(60, duration));
    setSettings((current) => {
      const effects = current.effects.map((effect, index) => ({
        ...effect,
        effectStart: Number(((effect.effectStart / current.duration) * safeDuration).toFixed(2)),
        effectEnd: Number((index === current.effects.length - 1 ? safeDuration : (effect.effectEnd / current.duration) * safeDuration).toFixed(2)),
      }));
      const primary = effects[0]!;
      return { ...current, duration: safeDuration, effects, motion: primary.motion, focus: primary.focus, effectStart: primary.effectStart, effectEnd: primary.effectEnd };
    });
  };

  const changeEffects = (effects: RenderJob['settings']['effects']) => {
    const primary = effects[0]!;
    setSettings((current) => ({ ...current, effects, motion: primary.motion, focus: primary.focus, effectStart: primary.effectStart, effectEnd: primary.effectEnd }));
  };

  const validName = outputName.trim().length > 0;

  return (
    <div className="render-edit-panel">
      <div className="render-edit-heading">
        <div><span><RefreshCw size={15} /></span><div><strong>Edit completed video</strong><small>Change the retained render settings and create an updated version.</small></div></div>
        <button type="button" aria-label="Close video editor" onClick={onClose}><X size={15} /></button>
      </div>

      <div className="render-name-editor">
        <label><span>Video name</span><div><input value={outputName} maxLength={80} onChange={(event) => setOutputName(event.target.value)} /><code>.{settings.format}</code></div></label>
        <button type="button" onClick={() => onRename(outputName)} disabled={busy || !validName}><Save size={14} /> Rename only</button>
      </div>

      <div className="render-edit-grid">
        <label><span><Clock3 size={13} /> Duration</span><div className="duration-edit"><input type="number" min={1} max={60} step={1} value={settings.duration} onChange={(event) => changeDuration(Number(event.target.value))} /><small>seconds · max 60</small></div></label>
        <label><span><MonitorUp size={13} /> Canvas</span><select value={settings.resolution} onChange={(event) => update('resolution', event.target.value as RenderJob['settings']['resolution'])}><option value="720p">HD · 1280×720</option><option value="1080p">Full HD · 1920×1080</option><option value="square">Square · 1080×1080</option><option value="portrait">Portrait · 1080×1920</option></select></label>
        <label><span><Crop size={13} /> Framing</span><select value={settings.fit} onChange={(event) => update('fit', event.target.value as RenderJob['settings']['fit'])}><option value="cover">Fill full canvas</option><option value="contain">Fit entire image</option></select></label>
        <label><span><Gauge size={13} /> Frame rate</span><select value={settings.fps} onChange={(event) => update('fps', Number(event.target.value))}><option value={24}>24 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
        <label><span><Gauge size={13} /> Quality</span><select value={settings.quality} onChange={(event) => update('quality', event.target.value as RenderJob['settings']['quality'])}><option value="draft">Draft · Fast</option><option value="balanced">Balanced</option><option value="high">High · Detailed</option></select></label>
        <label><span><Clapperboard size={13} /> Format</span><div className="locked-format">{settings.format.toUpperCase()} <small>Create a new render to change format</small></div></label>
      </div>

      <EffectStackEditor effects={settings.effects} duration={settings.duration} disabled={busy} onChange={changeEffects} />

      <div className="render-edit-options">
        <button type="button" role="switch" aria-checked={settings.fade} onClick={() => update('fade', !settings.fade)}><span className={`switch ${settings.fade ? 'on' : ''}`}><span /></span><span><strong>Fade transition</strong><small>Fade in and out</small></span></button>
        <label><span>Canvas background</span><div><input type="color" value={settings.background} onChange={(event) => update('background', event.target.value)} /><code>{settings.background}</code></div></label>
      </div>

      <div className="render-edit-footer">
        <p>The previous video stays available unless the updated render finishes successfully.</p>
        <button className="rerender-button" type="button" onClick={() => onRerender(outputName, settings)} disabled={busy || !validName}>{busy ? <span className="spinner" /> : <RefreshCw size={15} />} {busy ? 'Updating video…' : 'Apply changes & re-render'}</button>
      </div>
    </div>
  );
}
