import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Plus, SlidersHorizontal, Trash2, UploadCloud } from 'lucide-react';
import type { ImageEffectOverride, RenderSettings, SelectedImage } from '../types';
import { EffectStackEditor } from './EffectStackEditor';

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
    effects: settings.effects,
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
            const override = effectiveOverride(editingImage);
            return (
              <div className="asset-effect-editor">
                <div className="asset-effect-heading">
                  <div><SlidersHorizontal size={15} /><span><strong>Selective effects</strong><small title={editingImage.file.name}>{editingImage.file.name}</small></span></div>
                  <button type="button" onClick={() => onOverride(editingImage.id, undefined)} disabled={!editingImage.effectOverride || disabled}>Use batch defaults</button>
                </div>
                <EffectStackEditor compact effects={override.effects} duration={settings.duration} disabled={disabled} onChange={(effects) => onOverride(editingImage.id, { effects })} />
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
