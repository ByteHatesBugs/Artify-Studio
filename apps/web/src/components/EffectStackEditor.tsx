import { Blend, Clock3, FastForward, Focus, Gauge, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { EffectSegment } from '../types';

interface EffectStackEditorProps {
  effects: EffectSegment[];
  duration: number;
  compact?: boolean;
  disabled?: boolean;
  onChange: (effects: EffectSegment[]) => void;
}

const motionOptions: Array<{ value: EffectSegment['motion']; label: string; detail: string }> = [
  { value: 'zoom-in', label: 'Cinematic push in', detail: 'Draw attention gently toward the focal point.' },
  { value: 'zoom-out', label: 'Cinematic pull out', detail: 'Reveal more of the frame with a measured pull back.' },
  { value: 'pan-left', label: 'Pan left', detail: 'Travel horizontally toward the left edge.' },
  { value: 'pan-right', label: 'Pan right', detail: 'Travel horizontally toward the right edge.' },
  { value: 'pan-up', label: 'Rising pan', detail: 'Move upward for an elevated, aspirational feel.' },
  { value: 'pan-down', label: 'Descending pan', detail: 'Move downward to reveal lower-frame detail.' },
  { value: 'drift-up-left', label: 'Drift ↖ upper left', detail: 'A subtle diagonal move toward the upper left.' },
  { value: 'drift-up-right', label: 'Drift ↗ upper right', detail: 'A subtle diagonal move toward the upper right.' },
  { value: 'drift-down-left', label: 'Drift ↙ lower left', detail: 'A subtle diagonal move toward the lower left.' },
  { value: 'drift-down-right', label: 'Drift ↘ lower right', detail: 'A subtle diagonal move toward the lower right.' },
  { value: 'still', label: 'Locked frame', detail: 'Hold a precise static composition.' },
];

const focusOptions: Array<{ value: EffectSegment['focus']; label: string }> = [
  { value: 'center', label: 'Center' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
];
const easingOptions: Array<{ value: NonNullable<EffectSegment['easing']>; label: string }> = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'ease-in-out', label: 'Smooth' },
  { value: 'ease-in', label: 'Ease in' },
  { value: 'ease-out', label: 'Ease out' },
  { value: 'linear', label: 'Linear' },
];

const roundTime = (value: number) => Number(value.toFixed(2));

export function EffectStackEditor({ effects, duration, compact = false, disabled = false, onChange }: EffectStackEditorProps) {
  const updateEffect = (index: number, patch: Partial<EffectSegment>) => {
    const current = effects[index]!;
    let effectStart = patch.effectStart ?? current.effectStart;
    let effectEnd = patch.effectEnd ?? current.effectEnd;
    effectStart = Math.max(0, Math.min(effectStart, duration - 0.05, effectEnd - 0.05));
    effectEnd = Math.min(duration, Math.max(effectEnd, effectStart + 0.05));
    const next = effects.map((effect, effectIndex) => effectIndex === index ? {
      ...effect,
      ...patch,
      effectStart: roundTime(effectStart),
      effectEnd: roundTime(effectEnd),
    } : effect);
    onChange(next);
  };

  const addEffect = () => {
    if (effects.length >= 8) return;
    const motions: EffectSegment['motion'][] = ['zoom-in', 'pan-right', 'pan-up', 'drift-down-left', 'zoom-out', 'pan-left', 'pan-down', 'drift-up-right'];
    const windowLength = Math.max(0.05, duration / (effects.length + 1));
    const effectEnd = duration;
    const effectStart = Math.max(0, effectEnd - windowLength);
    onChange([...effects, {
      motion: motions[effects.length % motions.length]!,
      focus: 'center' as const,
      strength: 50,
      easing: 'cinematic',
      speed: 1,
      effectStart: roundTime(effectStart),
      effectEnd: roundTime(effectEnd),
    }]);
  };

  const removeEffect = (index: number) => {
    if (effects.length === 1) return;
    onChange(effects.filter((_effect, effectIndex) => effectIndex !== index));
  };

  return (
    <div className={`effect-stack-editor ${compact ? 'compact' : ''}`}>
      <div className="effect-stack-heading">
        <div><Sparkles size={14} /><span><strong>Precision motion timeline</strong><small>{effects.length} effect{effects.length === 1 ? '' : 's'} · earlier effects win overlaps</small></span></div>
        <button type="button" onClick={addEffect} disabled={disabled || effects.length >= 8}><Plus size={13} /> Add effect</button>
      </div>

      <div className="effect-stack-track" aria-label={`${effects.length} scheduled effects`} style={{ height: `${Math.max(25, effects.length * 19 + 6)}px` }}>
        {effects.map((effect, index) => (
          <span
            key={`${effect.motion}-${index}`}
            className={`effect-color-${index % 4}`}
            style={{ left: `${(effect.effectStart / duration) * 100}%`, width: `${((effect.effectEnd - effect.effectStart) / duration) * 100}%`, top: `${index * 19 + 3}px` }}
            title={`${index + 1}. ${effect.motion.replaceAll('-', ' ')} · ${effect.easing ?? 'cinematic'} curve · ${effect.strength}% strength · ${effect.speed ?? 1}× speed · ${effect.effectStart}s–${effect.effectEnd}s`}
          ><i>{index + 1}</i></span>
        ))}
      </div>

      <div className="effect-stack-list">
        {effects.map((effect, index) => {
          return (
            <article className="effect-segment" key={`${effect.motion}-${index}`}>
              <div className="effect-segment-index"><span className={`effect-color-${index % 4}`}>{index + 1}</span><strong>Effect {index + 1}</strong><small>Priority {index + 1}</small></div>
              <p className="effect-preset-note">{motionOptions.find((option) => option.value === effect.motion)?.detail}</p>
              <label><span><Sparkles size={11} /> Motion</span><select value={effect.motion} onChange={(event) => updateEffect(index, { motion: event.target.value as EffectSegment['motion'] })} disabled={disabled}>{motionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span><Focus size={11} /> Focus</span><select value={effect.focus} onChange={(event) => updateEffect(index, { focus: event.target.value as EffectSegment['focus'] })} disabled={disabled}>{focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span><Blend size={11} /> Motion curve</span><select aria-label={`Effect ${index + 1} motion curve`} value={effect.easing ?? 'cinematic'} onChange={(event) => updateEffect(index, { easing: event.target.value as NonNullable<EffectSegment['easing']> })} disabled={disabled || effect.motion === 'still'}>{easingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="effect-strength"><span><Gauge size={11} /> Strength <strong>{effect.motion === 'still' ? 'Off' : `${effect.strength}%`}</strong></span><input aria-label={`Effect ${index + 1} strength`} type="range" min={0} max={100} step={5} value={effect.strength} onChange={(event) => updateEffect(index, { strength: Number(event.target.value) })} disabled={disabled || effect.motion === 'still'} /></label>
              <label className="effect-speed"><span><FastForward size={11} /> Speed <strong>{effect.motion === 'still' ? 'Off' : `${effect.speed ?? 1}×`}</strong></span><input aria-label={`Effect ${index + 1} speed`} type="range" min={0.25} max={3} step={0.25} value={effect.speed ?? 1} onChange={(event) => updateEffect(index, { speed: Number(event.target.value) })} disabled={disabled || effect.motion === 'still'} /></label>
              <div className="effect-time-fields">
                <span><Clock3 size={11} /> Timing</span>
                <label><input aria-label={`Effect ${index + 1} start`} type="number" min={0} max={effect.effectEnd - 0.05} step={0.05} value={effect.effectStart} onChange={(event) => updateEffect(index, { effectStart: Number(event.target.value) })} disabled={disabled} /><small>s</small></label>
                <i>→</i>
                <label><input aria-label={`Effect ${index + 1} end`} type="number" min={effect.effectStart + 0.05} max={duration} step={0.05} value={effect.effectEnd} onChange={(event) => updateEffect(index, { effectEnd: Number(event.target.value) })} disabled={disabled} /><small>s</small></label>
              </div>
              <button className="effect-remove" type="button" aria-label={`Remove effect ${index + 1}`} onClick={() => removeEffect(index)} disabled={disabled || effects.length === 1}><Trash2 size={13} /></button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
