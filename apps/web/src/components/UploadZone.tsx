import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, Clock3, Focus, GripVertical, ImagePlus, Plus, SlidersHorizontal, Trash2, UploadCloud } from 'lucide-react';
import type { ImageEffectOverride, RenderSettings, SelectedImage } from '../types';

interface UploadZoneProps {
  images: SelectedImage[];
  settings: RenderSettings;
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, targetIndex: number) => void;
  onOverride: (id: string, effectOverride: ImageEffectOverride | undefined) => void;
  onClear: () => void;
}

export function UploadZone({ images, settings, disabled, onAdd, onRemove, onMove, onOverride, onClear }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingImage = images.find((image) => image.id === editingId);

  const effectiveOverride = (image: SelectedImage): ImageEffectOverride => image.effectOverride ?? {
    motion: settings.motion,
    focus: settings.focus,
    effectStart: settings.effectStart,
    effectEnd: settings.effectEnd,
  };

  const updateOverride = (image: SelectedImage, patch: Partial<ImageEffectOverride>) => {
    onOverride(image.id, { ...effectiveOverride(image), ...patch });
  };

  const choose = () => !disabled && inputRef.current?.click();
  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    onAdd(Array.from(event.target.files ?? []));
    event.target.value = '';
  };
  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) onAdd(Array.from(event.dataTransfer.files));
  };
  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose();
    }
  };

  return (
    <section className="workspace-card" aria-labelledby="assets-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">01 · Source frames</span>
          <h2 id="assets-heading">Build your batch</h2>
        </div>
        {images.length > 0 && (
          <button className="text-button danger" type="button" onClick={onClear} disabled={disabled}>
            <Trash2 size={15} /> Clear all
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={handleInput} />
      {images.length === 0 ? (
        <div
          className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload images"
          onClick={choose}
          onKeyDown={handleKey}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <span className="drop-icon"><UploadCloud size={27} /></span>
          <h3>Drop your images here</h3>
          <p>JPG, PNG, or WebP · up to 25 MB each</p>
          <button className="secondary-button" type="button" tabIndex={-1}><ImagePlus size={17} /> Browse images</button>
        </div>
      ) : (
        <div className="asset-grid">
          {images.map((image, index) => (
            <article
              className={`asset-card ${draggingId === image.id ? 'is-sorting' : ''}`}
              key={image.id}
              draggable={!disabled}
              onDragStart={() => setDraggingId(image.id)}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingId && draggingId !== image.id) onMove(draggingId, index);
                setDraggingId(null);
              }}
            >
              <img src={image.previewUrl} alt={`Preview of ${image.file.name}`} loading="lazy" decoding="async" />
              <span className="asset-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="asset-grip" title="Drag to reorder"><GripVertical size={15} /></span>
              <button type="button" className="asset-remove" aria-label={`Remove ${image.file.name}`} onClick={() => onRemove(image.id)} disabled={disabled}>
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                className={`asset-customize ${image.effectOverride ? 'has-override' : ''}`}
                aria-label={`Customize effect for ${image.file.name}`}
                aria-expanded={editingId === image.id}
                onClick={() => setEditingId((current) => current === image.id ? null : image.id)}
                disabled={disabled}
              >
                <SlidersHorizontal size={13} /><span>{image.effectOverride ? 'Custom' : 'Effect'}</span>
              </button>
              <div className="asset-meta">
                <strong title={image.file.name}>{image.file.name}</strong>
                <span>{(image.file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <div className="asset-order-actions">
                <button type="button" aria-label={`Move ${image.file.name} earlier`} onClick={() => onMove(image.id, index - 1)} disabled={disabled || index === 0}><ArrowLeft size={13} /></button>
                <button type="button" aria-label={`Move ${image.file.name} later`} onClick={() => onMove(image.id, index + 1)} disabled={disabled || index === images.length - 1}><ArrowRight size={13} /></button>
              </div>
            </article>
          ))}
          <button className="add-tile" type="button" onClick={choose} disabled={disabled || images.length >= 50}>
            <Plus size={22} /><span>Add more</span>
          </button>
          {editingImage && (() => {
            const effect = effectiveOverride(editingImage);
            const changeStart = (value: number) => updateOverride(editingImage, { effectStart: Number(Math.max(0, Math.min(value, effect.effectEnd - 0.05)).toFixed(2)) });
            const changeEnd = (value: number) => updateOverride(editingImage, { effectEnd: Number(Math.min(settings.duration, Math.max(value, 0.1, effect.effectStart + 0.05)).toFixed(2)) });
            const effectLeft = (effect.effectStart / settings.duration) * 100;
            const effectWidth = ((effect.effectEnd - effect.effectStart) / settings.duration) * 100;
            return (
              <div className="asset-effect-editor">
                <div className="asset-effect-heading">
                  <div><SlidersHorizontal size={15} /><span><strong>Selective effect</strong><small title={editingImage.file.name}>{editingImage.file.name}</small></span></div>
                  <button type="button" onClick={() => onOverride(editingImage.id, undefined)} disabled={!editingImage.effectOverride || disabled}>Use batch defaults</button>
                </div>
                <div className="asset-effect-fields">
                  <label><span>Motion</span><select value={effect.motion} onChange={(event) => updateOverride(editingImage, { motion: event.target.value as ImageEffectOverride['motion'] })} disabled={disabled}>
                    <option value="zoom-in">Slow zoom in</option><option value="zoom-out">Slow zoom out</option><option value="pan-left">Pan left</option><option value="pan-right">Pan right</option><option value="still">Still frame</option>
                  </select></label>
                  <label><span><Focus size={12} /> Effect focus</span><select value={effect.focus} onChange={(event) => updateOverride(editingImage, { focus: event.target.value as ImageEffectOverride['focus'] })} disabled={disabled}>
                    <option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option>
                  </select></label>
                </div>
                <div className="asset-effect-timing">
                  <span><Clock3 size={13} /> Apply between</span>
                  <label><input type="number" min={0} max={effect.effectEnd - 0.05} step={0.05} value={effect.effectStart} onChange={(event) => changeStart(Number(event.target.value))} disabled={disabled} /><small>sec</small></label>
                  <span>to</span>
                  <label><input type="number" min={Math.max(0.1, effect.effectStart + 0.05)} max={settings.duration} step={0.05} value={effect.effectEnd} onChange={(event) => changeEnd(Number(event.target.value))} disabled={disabled} /><small>sec</small></label>
                </div>
                <div className="asset-effect-range">
                  <div className="timing-track" aria-hidden="true"><span style={{ left: `${effectLeft}%`, width: `${effectWidth}%` }} /></div>
                  <input className="timeline-range" aria-label={`Effect start time for ${editingImage.file.name}`} type="range" min={0} max={settings.duration} step={0.05} value={effect.effectStart} onChange={(event) => changeStart(Number(event.target.value))} disabled={disabled} />
                  <input className="timeline-range" aria-label={`Effect end time for ${editingImage.file.name}`} type="range" min={0.1} max={settings.duration} step={0.05} value={effect.effectEnd} onChange={(event) => changeEnd(Number(event.target.value))} disabled={disabled} />
                </div>
              </div>
            );
          })()}
        </div>
      )}
      <div className="capacity-row">
        <span>{images.length} of 50 images</span>
        <span>{images.length ? `${(images.reduce((sum, image) => sum + image.file.size, 0) / 1024 / 1024).toFixed(1)} MB selected` : 'Batch capacity ready'}</span>
      </div>
    </section>
  );
}
