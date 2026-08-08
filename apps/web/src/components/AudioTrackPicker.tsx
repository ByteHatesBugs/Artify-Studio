import { useRef, type ChangeEvent } from 'react';
import { Music2, Upload, Volume2, X } from 'lucide-react';
import type { SelectedAudio } from '../types';

interface AudioTrackPickerProps {
  audio?: SelectedAudio;
  volume: number;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onVolumeChange: (volume: number) => void;
}

export function AudioTrackPicker({ audio, volume, disabled, onSelect, onRemove, onVolumeChange }: AudioTrackPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onSelect(file);
    event.target.value = '';
  };

  return (
    <section className="audio-card" aria-labelledby="audio-heading">
      <input ref={inputRef} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg" hidden onChange={handleChange} />
      <div className="audio-heading">
        <span><Music2 size={16} /></span>
        <div><strong id="audio-heading">Soundtrack</strong><small>Optional · loops to the video length</small></div>
        {audio && <button type="button" aria-label="Remove soundtrack" onClick={onRemove} disabled={disabled}><X size={14} /></button>}
      </div>

      {audio ? (
        <div className="audio-loaded">
          <div className="audio-file"><strong title={audio.file.name}>{audio.file.name}</strong><span>{(audio.file.size / 1024 / 1024).toFixed(1)} MB</span></div>
          <audio controls preload="metadata" src={audio.previewUrl}>Your browser cannot preview this audio file.</audio>
          <label className="audio-volume"><span><Volume2 size={14} /> Mix volume</span><input aria-label="Soundtrack volume" type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} disabled={disabled} /><strong>{Math.round(volume * 100)}%</strong></label>
        </div>
      ) : (
        <button className="audio-empty" type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Upload size={16} /><span><strong>Add soundtrack</strong><small>MP3, WAV, M4A, AAC, or OGG · max 25 MB</small></span>
        </button>
      )}
    </section>
  );
}
