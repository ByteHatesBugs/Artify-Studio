import { Clock3, Focus, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { EffectSegment } from '../types';

interface EffectStackEditorProps {
  effects: EffectSegment[];
  duration: number;
  compact?: boolean;
  disabled?: boolean;
  onChange: (effects: EffectSegment[]) => void;
}

const motionOptions: Array<{ value: EffectSegment['motion']; label: string }> = [
  { value: 'zoom-in', label: 'Slow zoom in' },
  { value: 'zoom-out', label: 'Slow zoom out' },
  { value: 'pan-left', label: 'Pan left' },
  { value: 'pan-right', label: 'Pan right' },
  { value: 'still', label: 'Hold frame' },
];

const focusOptions: Array<{ value: EffectSegment['focus']; label: string }> = [
  { value: 'center', label: 'Center' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
];

const roundTime = (value: number) => Number(value.toFixed(2));

export function EffectStackEditor({ effects, duration, compact = false, disabled = false, onChange }: EffectStackEditorProps) {
  const updateEffect = (index: number, patch: Partial<EffectSegment>) => {
    const current = effects[index]!;
    const previousEnd = effects[index - 1]?.effectEnd ?? 0;
    const nextStart = effects[index + 1]?.effectStart ?? duration;
    let effectStart = patch.effectStart ?? current.effectStart;
    let effectEnd = patch.effectEnd ?? current.effectEnd;
    effectStart = Math.max(previousEnd, Math.min(effectStart, effectEnd - 0.05));
    effectEnd = Math.min(nextStart, duration, Math.max(effectEnd, effectStart + 0.05));
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
    const motions: EffectSegment['motion'][] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];
    const expanded = [...effects, { motion: motions[effects.length % motions.length]!, focus: 'center' as const, effectStart: 0, effectEnd: duration }];
    const slice = duration / expanded.length;
    onChange(expanded.map((effect, index) => ({
      ...effect,
      effectStart: roundTime(slice * index),
      effectEnd: roundTime(index === expanded.length - 1 ? duration : slice * (index + 1)),
    })));
  };

  const removeEffect = (index: number) => {
    if (effects.length === 1) return;
    onChange(effects.filter((_effect, effectIndex) => effectIndex !== index));
  };

  return (
    <div className={`effect-stack-editor ${compact ? 'compact' : ''}`}>
      <div className="effect-stack-heading">
        <div><Sparkles size={14} /><span><strong>Effect timeline</strong><small>{effects.length} effect{effects.length === 1 ? '' : 's'} · up to 8</small></span></div>
        <button type="button" onClick={addEffect} disabled={disabled || effects.length >= 8}><Plus size={13} /> Add effect</button>
      </div>

      <div className="effect-stack-track" aria-label={`${effects.length} scheduled effects`}>
        {effects.map((effect, index) => (
          <span
            key={`${effect.motion}-${index}`}
            className={`effect-color-${index % 4}`}
            style={{ left: `${(effect.effectStart / duration) * 100}%`, width: `${((effect.effectEnd - effect.effectStart) / duration) * 100}%` }}
            title={`${index + 1}. ${effect.motion.replace('-', ' ')}: ${effect.effectStart}s–${effect.effectEnd}s`}
          ><i>{index + 1}</i></span>
        ))}
      </div>

      <div className="effect-stack-list">
        {effects.map((effect, index) => {
          const previousEnd = effects[index - 1]?.effectEnd ?? 0;
          const nextStart = effects[index + 1]?.effectStart ?? duration;
          return (
            <article className="effect-segment" key={`${effect.motion}-${index}`}>
              <div className="effect-segment-index"><span className={`effect-color-${index % 4}`}>{index + 1}</span><strong>Effect {index + 1}</strong></div>
              <label><span><Sparkles size={11} /> Motion</span><select value={effect.motion} onChange={(event) => updateEffect(index, { motion: event.target.value as EffectSegment['motion'] })} disabled={disabled}>{motionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span><Focus size={11} /> Focus</span><select value={effect.focus} onChange={(event) => updateEffect(index, { focus: event.target.value as EffectSegment['focus'] })} disabled={disabled}>{focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <div className="effect-time-fields">
                <span><Clock3 size={11} /> Timing</span>
                <label><input aria-label={`Effect ${index + 1} start`} type="number" min={previousEnd} max={effect.effectEnd - 0.05} step={0.05} value={effect.effectStart} onChange={(event) => updateEffect(index, { effectStart: Number(event.target.value) })} disabled={disabled} /><small>s</small></label>
                <i>→</i>
                <label><input aria-label={`Effect ${index + 1} end`} type="number" min={effect.effectStart + 0.05} max={nextStart} step={0.05} value={effect.effectEnd} onChange={(event) => updateEffect(index, { effectEnd: Number(event.target.value) })} disabled={disabled} /><small>s</small></label>
              </div>
              <button className="effect-remove" type="button" aria-label={`Remove effect ${index + 1}`} onClick={() => removeEffect(index)} disabled={disabled || effects.length === 1}><Trash2 size={13} /></button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
