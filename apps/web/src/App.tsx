import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp, Download, Github, Images, ShieldCheck, SlidersHorizontal, WandSparkles, X, Zap } from 'lucide-react';
import { cancelBatch, createBatch, deleteBatch, getHealth, listBatches, renameRenderedJob, rerenderJob, retryBatch } from './api';
import { BatchQueue } from './components/BatchQueue';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Logo } from './components/Logo';
import { SettingsPanel } from './components/SettingsPanel';
import { UploadZone } from './components/UploadZone';
import type { Batch, EffectSegment, HealthStatus, RenderJob, RenderSettings, SelectedImage } from './types';

const initialEffect: EffectSegment = { motion: 'zoom-in', focus: 'center', strength: 50, easing: 'cinematic', speed: 1, effectStart: 0, effectEnd: 5 };

const initialSettings: RenderSettings = {
  name: 'Campaign motion set',
  duration: 5,
  effectStart: 0,
  effectEnd: 5,
  fps: 30,
  resolution: '1080p',
  motion: 'zoom-in',
  focus: 'center',
  format: 'mp4',
  fit: 'cover',
  quality: 'balanced',
  fade: true,
  background: '#09090b',
  effects: [initialEffect],
};

const normalizeEffectStack = (effects: EffectSegment[] | undefined, duration: number, fallback = initialEffect) => {
  const source = effects?.length ? effects.slice(0, 8) : [{ ...fallback, effectEnd: duration }];
  const normalized: EffectSegment[] = [];
  for (const effect of source) {
    const effectStart = Math.max(0, Math.min(effect.effectStart, duration - 0.05));
    const effectEnd = Math.min(duration, Math.max(effect.effectEnd, effectStart + 0.05));
    if (effectStart >= duration || effectEnd <= effectStart) continue;
    normalized.push({ ...effect, strength: effect.strength ?? 50, easing: effect.easing ?? 'cinematic', speed: effect.speed ?? 1, effectStart: Number(effectStart.toFixed(2)), effectEnd: Number(effectEnd.toFixed(2)) });
  }
  return normalized.length ? normalized : [{ ...fallback, effectStart: 0, effectEnd: duration }];
};

const loadSettings = (): RenderSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem('renderflow:render-settings') ?? '{}') as Partial<RenderSettings>;
    const merged = { ...initialSettings, ...saved, fit: 'cover' as const };
    const effects = normalizeEffectStack(saved.effects, merged.duration, {
      motion: merged.motion,
      focus: merged.focus,
      strength: saved.effects?.[0]?.strength ?? 50,
      easing: saved.effects?.[0]?.easing ?? 'cinematic',
      speed: saved.effects?.[0]?.speed ?? 1,
      effectStart: merged.effectStart,
      effectEnd: merged.effectEnd,
    });
    const primary = effects[0]!;
    return {
      ...merged,
      motion: primary.motion,
      focus: primary.focus,
      effectStart: primary.effectStart,
      effectEnd: primary.effectEnd,
      effects,
    };
  } catch {
    return initialSettings;
  }
};

type PendingAction = { kind: 'cancel' | 'delete'; id: string; name: string };
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

export default function App() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [settings, setSettings] = useState(loadSettings);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const noticeTimerRef = useRef<number | undefined>(undefined);
  const refreshInFlightRef = useRef(false);
  const batchSignatureRef = useRef('');
  const submitRef = useRef<() => void>(() => undefined);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const data = await listBatches();
      const signature = data.batches.map((batch) => `${batch.id}:${batch.status}:${batch.progress}:${batch.jobs.map((job) => `${job.id}:${job.status}:${job.progress}:${job.outputName}`).join(',')}`).join('|');
      if (signature !== batchSignatureRef.current) {
        batchSignatureRef.current = signature;
        setBatches(data.batches);
      }
    } catch {
      // Keep the current queue visible during a brief server interruption.
    } finally {
      refreshInFlightRef.current = false;
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void getHealth().then(setHealth).catch(() => setHealth({
      status: 'degraded',
      service: 'renderflow-api',
      engine: { ready: false, error: 'The processing server is unreachable.', checkedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    }));
  }, [refresh]);

  useEffect(() => {
    const hasActiveWork = batches.some((batch) => batch.status === 'queued' || batch.status === 'processing');
    if (!hasActiveWork) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(refreshWhenVisible, 2000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [batches, refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage?.setItem('renderflow:render-settings', JSON.stringify(settings));
      } catch {
        // Private browsing and embedded contexts may disable local preferences.
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  const showNotice = (tone: 'error' | 'success', message: string) => {
    setNotice({ tone, message });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4500);
  };

  const addImages = (files: File[]) => {
    const supported = files.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 25 * 1024 * 1024);
    const existing = new Set(images.map((image) => fileKey(image.file)));
    const unique = supported.filter((file) => !existing.has(fileKey(file)) && existing.add(fileKey(file)));
    const available = Math.max(0, 50 - images.length);
    const accepted = unique.slice(0, available);
    if (accepted.length !== files.length) showNotice('error', 'Some files were skipped. Use JPG, PNG, or WebP images under 25 MB.');
    setImages((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))]);
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  };

  const moveImage = (id: string, targetIndex: number) => {
    setImages((current) => {
      const sourceIndex = current.findIndex((image) => image.id === id);
      if (sourceIndex < 0) return current;
      const destination = Math.max(0, Math.min(targetIndex, current.length - 1));
      if (sourceIndex === destination) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(sourceIndex, 1);
      if (!moved) return current;
      reordered.splice(destination, 0, moved);
      return reordered;
    });
  };

  const clearImages = () => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
  };

  const changeSettings = (next: RenderSettings) => {
    const effects = normalizeEffectStack(next.effects, next.duration);
    const primary = effects[0]!;
    const normalizedNext = { ...next, fit: 'cover' as const, effects, motion: primary.motion, focus: primary.focus, effectStart: primary.effectStart, effectEnd: primary.effectEnd };
    const durationChanged = normalizedNext.duration !== settings.duration;
    setSettings(normalizedNext);
    if (!durationChanged) return;
    setImages((current) => current.map((image) => {
      if (!image.effectOverride) return image;
      return { ...image, effectOverride: { effects: normalizeEffectStack(image.effectOverride.effects, normalizedNext.duration, primary) } };
    }));
  };

  const changeImageOverride = (id: string, effectOverride: SelectedImage['effectOverride']) => {
    setImages((current) => current.map((image) => image.id === id ? { ...image, effectOverride } : image));
  };

  const submit = async () => {
    if (!images.length || isSubmitting || !settings.name.trim() || health?.engine.ready !== true) return;
    setIsSubmitting(true);
    try {
      const { batch } = await createBatch(images, settings);
      clearImages();
      setBatches((current) => [batch, ...current]);
      showNotice('success', 'Batch added to the render queue.');
      window.setTimeout(() => document.querySelector('#queue-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The batch could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  };
  submitRef.current = () => void submit();

  const setActionBusy = (id: string, busy: boolean) => setBusyIds((current) => {
    const next = new Set(current);
    if (busy) next.add(id); else next.delete(id);
    return next;
  });

  const stop = async (id: string) => {
    setActionBusy(id, true);
    try {
      await cancelBatch(id);
      await refresh();
      showNotice('success', 'The active render was stopped safely. You can retry it at any time.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The batch could not be stopped.');
    } finally {
      setActionBusy(id, false);
    }
  };

  const removeBatch = async (id: string) => {
    setActionBusy(id, true);
    try {
      await deleteBatch(id);
      setBatches((current) => current.filter((batch) => batch.id !== id));
      showNotice('success', 'Batch and associated media were deleted.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The batch could not be deleted.');
    } finally {
      setActionBusy(id, false);
    }
  };

  const retry = async (id: string) => {
    setActionBusy(id, true);
    try {
      const { batch, retried } = await retryBatch(id);
      setBatches((current) => current.map((candidate) => candidate.id === id ? batch : candidate));
      showNotice('success', `${retried} render${retried === 1 ? '' : 's'} returned to the queue.`);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The batch could not be retried.');
    } finally {
      setActionBusy(id, false);
    }
  };

  const renameJob = async (batchId: string, jobId: string, outputName: string) => {
    setActionBusy(batchId, true);
    try {
      const { batch } = await renameRenderedJob(batchId, jobId, outputName);
      setBatches((current) => current.map((candidate) => candidate.id === batchId ? batch : candidate));
      showNotice('success', 'Video renamed successfully.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The video could not be renamed.');
    } finally {
      setActionBusy(batchId, false);
    }
  };

  const updateRenderedJob = async (batchId: string, jobId: string, outputName: string, jobSettings: RenderJob['settings']) => {
    setActionBusy(batchId, true);
    try {
      const { batch } = await rerenderJob(batchId, jobId, outputName, jobSettings);
      setBatches((current) => current.map((candidate) => candidate.id === batchId ? batch : candidate));
      showNotice('success', 'Updated video added to the render queue. The previous version is protected until it finishes.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'The video could not be updated.');
    } finally {
      setActionBusy(batchId, false);
    }
  };

  const requestAction = (kind: PendingAction['kind'], id: string) => {
    const batch = batches.find((candidate) => candidate.id === id);
    if (batch) setPendingAction({ kind, id, name: batch.name });
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    if (action.kind === 'cancel') await stop(action.id);
    else await removeBatch(action.id);
    setPendingAction(null);
  };

  return (
    <div className="app-shell" id="top">
      <a className="skip-link" href="#workspace">Skip to editor</a>
      <header className="topbar">
        <Logo />
        <nav aria-label="Primary navigation">
          <a className="active" href="#workspace">Studio</a>
          <a href="#queue-heading">Renders</a>
        </nav>
        <div className="header-actions">
          <a className="icon-button" href="https://github.com/ByteHatesBugs/RF/tree/dev" target="_blank" rel="noreferrer" aria-label="View RenderFlow development branch on GitHub"><Github size={18} /></a>
          <button className="help-button" type="button" onClick={() => showNotice('success', 'Start with a quick profile, then refine each effect’s timing, strength, curve, and speed.')}><CircleHelp size={16} /> Help</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className={`status-pill ${health && !health.engine.ready ? 'engine-off' : ''}`} title={health?.engine.version || health?.engine.error}>
              <span /> {health ? health.engine.ready ? 'Verified render pipeline ready' : 'Render pipeline unavailable' : 'Checking render pipeline'}
            </span>
            <h1>Still images.<br /><em>Built to move.</em></h1>
            <p>Turn image batches into verified, screen-ready video assets with precise motion control and a production-safe render queue.</p>
          </div>
          <div className="hero-stats" aria-label="Product qualities">
            <div><span className="stat-icon"><Zap size={18} /></span><strong>Batch-first</strong><small>Up to 50 outputs</small></div>
            <div><span className="stat-icon"><WandSparkles size={18} /></span><strong>Precision motion</strong><small>11 effects · 5 curves</small></div>
            <div><span className="stat-icon"><ShieldCheck size={18} /></span><strong>Verified delivery</strong><small>Size, FPS & duration checked</small></div>
          </div>
        </section>

        <section className="workflow-strip" aria-labelledby="workflow-heading">
          <div className="workflow-title"><span className="eyebrow">Production workflow</span><h2 id="workflow-heading">Source to verified export</h2></div>
          <ol>
            <li><span className="workflow-number">01</span><span className="workflow-icon"><Images size={17} /></span><div><strong>Upload & order</strong><small>Build a batch of up to 50 source frames.</small></div></li>
            <li><span className="workflow-number">02</span><span className="workflow-icon"><SlidersHorizontal size={17} /></span><div><strong>Direct the motion</strong><small>Control timing, focus, strength, curve, and speed.</small></div></li>
            <li><span className="workflow-number">03</span><span className="workflow-icon"><Download size={17} /></span><div><strong>Review & deliver</strong><small>Preview verified outputs before downloading.</small></div></li>
          </ol>
        </section>

        <section className="studio-layout" id="workspace">
          <div className="source-column">
            <UploadZone images={images} settings={settings} disabled={isSubmitting} onAdd={addImages} onRemove={removeImage} onMove={moveImage} onOverride={changeImageOverride} onClear={clearImages} />
          </div>
          <SettingsPanel settings={settings} previewImage={images[0]?.previewUrl} imageCount={images.length} isSubmitting={isSubmitting} engineReady={health?.engine.ready === true} onChange={changeSettings} onReset={() => changeSettings({ ...initialSettings, name: settings.name })} onSubmit={submit} />
        </section>

        <BatchQueue batches={batches} loading={isHistoryLoading} busyIds={busyIds} onCancel={(id) => requestAction('cancel', id)} onRetry={retry} onRenameJob={renameJob} onRerenderJob={updateRenderedJob} onDelete={(id) => requestAction('delete', id)} />
      </main>

      <footer><Logo /><p>Verified batch motion production for focused creative teams.</p><span>RenderFlow · {new Date().getFullYear()}</span></footer>
      {notice && <div className={`toast ${notice.tone}`} role="status">{notice.tone === 'success' ? <Checkmark /> : <span>!</span>}<p>{notice.message}</p><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={14} /></button></div>}
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.kind === 'cancel' ? 'Stop this render?' : 'Delete this batch?'}
          message={pendingAction.kind === 'cancel'
            ? `RenderFlow will safely stop “${pendingAction.name}”. Completed files remain available and unfinished files can be retried.`
            : `“${pendingAction.name}” and all of its source and output files will be permanently removed.`}
          confirmLabel={pendingAction.kind === 'cancel' ? 'Stop render' : 'Delete batch'}
          destructive={pendingAction.kind === 'delete'}
          busy={busyIds.has(pendingAction.id)}
          onConfirm={() => void confirmAction()}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

function Checkmark() {
  return <span>✓</span>;
}
