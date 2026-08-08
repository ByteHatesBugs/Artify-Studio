import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Music2, Volume2 } from 'lucide-react';

interface AudioTimelineProps {
  source: string;
  name: string;
  videoDuration: number;
  sourceStart: number;
  videoStart: number;
  volume: number;
  disabled?: boolean;
  onSourceStartChange: (time: number) => void;
  onVideoStartChange: (time: number) => void;
  onVolumeChange: (volume: number) => void;
}

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${(safe % 60).toFixed(1).padStart(4, '0')}`;
};

const fallbackPeaks = Array.from({ length: 80 }, (_, index) => 0.2 + ((index * 37) % 67) / 100);

export function AudioTimeline({ source, name, videoDuration, sourceStart, videoStart, volume, disabled = false, onSourceStartChange, onVideoStartChange, onVolumeChange }: AudioTimelineProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [peaks, setPeaks] = useState(fallbackPeaks);
  const safeVideoStart = Math.min(videoStart, Math.max(0, videoDuration - 0.05));
  const availableVideoTime = Math.max(0.05, videoDuration - safeVideoStart);
  const sourceLimit = audioDuration > 0 ? Math.max(0, audioDuration - 0.05) : 3600;
  const selectionStart = audioDuration > 0 ? Math.min(100, (sourceStart / audioDuration) * 100) : 0;
  const selectionWidth = audioDuration > 0 ? Math.min(100 - selectionStart, (availableVideoTime / audioDuration) * 100) : 100;
  const selectedRange = useMemo(() => ({ start: selectionStart, end: selectionStart + selectionWidth }), [selectionStart, selectionWidth]);

  useEffect(() => {
    let cancelled = false;
    setPeaks(fallbackPeaks);
    const decode = async () => {
      if (!window.AudioContext) return;
      const response = await fetch(source);
      const context = new window.AudioContext();
      try {
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        const channel = decoded.getChannelData(0);
        const bucketSize = Math.max(1, Math.floor(channel.length / fallbackPeaks.length));
        const next = fallbackPeaks.map((_peak, index) => {
          let maximum = 0;
          const start = index * bucketSize;
          const end = Math.min(channel.length, start + bucketSize);
          for (let sample = start; sample < end; sample += Math.max(1, Math.floor(bucketSize / 120))) maximum = Math.max(maximum, Math.abs(channel[sample] ?? 0));
          return Math.max(0.08, maximum);
        });
        if (!cancelled) setPeaks(next);
      } finally {
        await context.close();
      }
    };
    void decode().catch(() => undefined);
    return () => { cancelled = true; };
  }, [source]);

  useEffect(() => {
    const player = audioRef.current;
    if (player && Number.isFinite(player.duration) && Math.abs(player.currentTime - sourceStart) > 0.05) player.currentTime = Math.min(sourceStart, player.duration);
  }, [source, sourceStart]);

  const changeSourceStart = (time: number) => {
    const safe = Math.max(0, Math.min(time, sourceLimit));
    onSourceStartChange(Number(safe.toFixed(2)));
    if (audioRef.current) audioRef.current.currentTime = safe;
  };

  return (
    <div className="audio-timeline">
      <div className="audio-waveform-heading"><span><Music2 size={13} /> Audio track</span><code>{formatTime(sourceStart)} source · {formatTime(safeVideoStart)} video</code></div>
      <button
        className="audio-waveform"
        type="button"
        aria-label={`Choose start position in ${name}`}
        disabled={disabled || audioDuration <= 0}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          changeSourceStart(((event.clientX - bounds.left) / bounds.width) * audioDuration);
        }}
      >
        <span className="audio-waveform-selection" style={{ left: `${selectedRange.start}%`, width: `${selectedRange.end - selectedRange.start}%` }} />
        {peaks.map((peak, index) => {
          const position = (index / (peaks.length - 1)) * 100;
          return <i key={index} className={position >= selectedRange.start && position <= selectedRange.end ? 'selected' : ''} style={{ height: `${Math.round(peak * 92)}%` }} />;
        })}
      </button>
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={source}
        onLoadedMetadata={(event) => {
          const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
          setAudioDuration(nextDuration);
          if (sourceStart >= nextDuration && nextDuration > 0) onSourceStartChange(Math.max(0, Number((nextDuration - 0.05).toFixed(2))));
          else if (nextDuration > 0) event.currentTarget.currentTime = sourceStart;
        }}
      >Your browser cannot preview this audio file.</audio>
      <div className="audio-timing-grid">
        <label><span><Music2 size={12} /> Start in soundtrack</span><div><input aria-label="Start time in soundtrack" type="number" min={0} max={sourceLimit} step={0.1} value={sourceStart} onChange={(event) => changeSourceStart(Number(event.target.value))} disabled={disabled} /><small>sec</small></div></label>
        <label><span><Clock3 size={12} /> Place in video</span><div><input aria-label="Soundtrack start time in video" type="number" min={0} max={Math.max(0, videoDuration - 0.05)} step={0.1} value={safeVideoStart} onChange={(event) => onVideoStartChange(Number(Math.max(0, Math.min(Number(event.target.value), videoDuration - 0.05)).toFixed(2)))} disabled={disabled} /><small>sec</small></div></label>
      </div>
      <label className="audio-volume"><span><Volume2 size={14} /> Mix volume</span><input aria-label="Soundtrack volume" type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} disabled={disabled} /><strong>{Math.round(volume * 100)}%</strong></label>
    </div>
  );
}
