import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FastForward, Maximize2, Pause, Play, Rewind, Volume2, VolumeX } from 'lucide-react';
import type { RenderJob } from '../types';

interface VideoReviewProps {
  source: string;
  outputName: string;
  settings: RenderJob['settings'];
}

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`;
};

const aspectClass = (resolution: RenderJob['settings']['resolution']) => {
  if (resolution === 'square') return 'is-square';
  if (resolution === 'portrait') return 'is-portrait';
  return 'is-landscape';
};

export function VideoReview({ source, outputName, settings }: VideoReviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(settings.duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const updatePlayhead = () => {
      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
      frame = window.requestAnimationFrame(updatePlayhead);
    };
    frame = window.requestAnimationFrame(updatePlayhead);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play(); else video.pause();
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(time, duration));
    video.currentTime = next;
    setCurrentTime(next);
  };

  const changeVolume = (next: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const changeRate = (next: number) => {
    if (videoRef.current) videoRef.current.playbackRate = next;
    setRate(next);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stageRef.current?.requestFullscreen();
  };

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === ' ') {
      event.preventDefault();
      void togglePlayback();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      seek(currentTime - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      seek(currentTime + 1);
    }
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const effectLeft = duration ? (settings.effectStart / duration) * 100 : 0;
  const effectWidth = duration ? ((settings.effectEnd - settings.effectStart) / duration) * 100 : 100;
  const rulerMarks = Array.from({ length: 6 }, (_, index) => (duration / 5) * index);

  return (
    <div className="video-review" tabIndex={0} onKeyDown={handleKeys}>
      <div className="video-review-heading">
        <div><strong>Video review</strong><span>Preview the final timing and motion before download</span></div>
        <span>{settings.resolution} · {settings.format.toUpperCase()} · {settings.fps} FPS</span>
      </div>

      <div className="video-stage-shell">
        <div ref={stageRef} className={`video-stage ${aspectClass(settings.resolution)}`}>
          <video
            ref={videoRef}
            playsInline
            preload="metadata"
            src={source}
            onClick={() => void togglePlayback()}
            onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : settings.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => { setPlaying(false); setCurrentTime(videoRef.current?.currentTime ?? 0); }}
            onEnded={() => { setPlaying(false); setCurrentTime(duration); }}
          >Your browser cannot preview this video format.</video>
          {!playing && <button className="stage-play" type="button" aria-label="Play preview" onClick={() => void togglePlayback()}><Play size={24} fill="currentColor" /></button>}
        </div>
      </div>

      <div className="video-control-bar">
        <div className="playback-controls">
          <button type="button" aria-label="Go back one second" onClick={() => seek(currentTime - 1)}><Rewind size={15} /></button>
          <button className="primary-play" type="button" aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={() => void togglePlayback()}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
          <button type="button" aria-label="Go forward one second" onClick={() => seek(currentTime + 1)}><FastForward size={15} /></button>
          <code>{formatTime(currentTime)} <span>/ {formatTime(duration)}</span></code>
        </div>
        <div className="view-controls">
          <button type="button" aria-label={muted ? 'Unmute preview' : 'Mute preview'} onClick={toggleMute}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          <input aria-label="Preview volume" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} />
          <select aria-label="Playback speed" value={rate} onChange={(event) => changeRate(Number(event.target.value))}>
            <option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option>
          </select>
          <button type="button" aria-label="Toggle fullscreen preview" onClick={() => void toggleFullscreen()}><Maximize2 size={15} /></button>
        </div>
      </div>

      <div className="review-timeline" aria-label="Video timeline">
        <div className="timeline-ruler" aria-hidden="true">
          {rulerMarks.map((mark) => <span key={mark} style={{ left: `${duration ? (mark / duration) * 100 : 0}%` }}>{formatTime(mark)}</span>)}
        </div>
        <div className="timeline-clip">
          <div className="clip-fill"><strong>{outputName}</strong><span>{settings.motion.replace('-', ' ')} · {settings.focus ?? 'center'} focus</span></div>
          <span className="clip-effect" style={{ left: `${effectLeft}%`, width: `${effectWidth}%` }} title={`Effect ${settings.effectStart}s–${settings.effectEnd}s`} />
          <span className="timeline-playhead" style={{ left: `${progress}%` }} aria-hidden="true"><i /></span>
          <input aria-label="Seek through preview" type="range" min={0} max={duration || 0.1} step={0.01} value={Math.min(currentTime, duration)} onChange={(event) => seek(Number(event.target.value))} />
        </div>
        <div className="timeline-legend"><span><i /> Motion window</span><small>Space: play/pause · ←/→: seek 1 second</small></div>
      </div>
    </div>
  );
}
