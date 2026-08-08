import { useRef, type ChangeEvent } from 'react';
import { Music2, Upload, X } from 'lucide-react';
import type { SelectedAudio } from '../types';
import { AudioTimeline } from './AudioTimeline';

interface AudioTrackPickerProps {
  audio?: SelectedAudio;
  volume: number;
  videoDuration: number;
  sourceStart: number;
  videoStart: number;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onVolumeChange: (volume: number) => void;
  onSourceStartChange: (time: number) => void;
  onVideoStartChange: (time: number) => void;
}

export function AudioTrackPicker({ audio, volume, videoDuration, sourceStart, videoStart, disabled, onSelect, onRemove, onVolumeChange, onSourceStartChange, onVideoStartChange }: AudioTrackPickerProps) {
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
        <div><strong id="audio-heading">Soundtrack</strong><small>Optional · trim and place it on the video timeline</small></div>
        {audio && <button type="button" aria-label="Remove soundtrack" onClick={onRemove} disabled={disabled}><X size={14} /></button>}
      </div>

      {audio ? (
        <div className="audio-loaded">
          <div className="audio-file"><strong title={audio.file.name}>{audio.file.name}</strong><span>{(audio.file.size / 1024 / 1024).toFixed(1)} MB</span></div>
          <AudioTimeline source={audio.previewUrl} name={audio.file.name} videoDuration={videoDuration} sourceStart={sourceStart} videoStart={videoStart} volume={volume} disabled={disabled} onSourceStartChange={onSourceStartChange} onVideoStartChange={onVideoStartChange} onVolumeChange={onVolumeChange} />
        </div>
      ) : (
        <button className="audio-empty" type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Upload size={16} /><span><strong>Add soundtrack</strong><small>MP3, WAV, M4A, AAC, or OGG · max 25 MB</small></span>
        </button>
      )}
    </section>
  );
}
