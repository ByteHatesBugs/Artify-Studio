import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp, Github, ShieldCheck, WandSparkles, X, Zap } from 'lucide-react';
import { cancelBatch, createBatch, deleteBatch, getHealth, listBatches, retryBatch } from './api';
import { BatchQueue } from './components/BatchQueue';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Logo } from './components/Logo';
import { SettingsPanel } from './components/SettingsPanel';
import { UploadZone } from './components/UploadZone';
import type { Batch, HealthStatus, RenderSettings, SelectedImage } from './types';

const initialSettings: RenderSettings = {
  name: 'Campaign motion set',
  duration: 5,
  fps: 30,
  resolution: '1080p',
  motion: 'zoom-in',
  format: 'mp4',
  background: '#09090b',
};

const loadSettings = (): RenderSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem('artify:render-settings') ?? '{}') as Partial<RenderSettings>;
    return { ...initialSettings, ...saved };
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
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const refresh = useCallback(async () => {
    try {
      const data = await listBatches();
      setBatches(data.batches);
    } catch {
      // Keep the current queue visible during a brief server interruption.
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void getHealth().then(setHealth).catch(() => setHealth({
      status: 'degraded',
      service: 'artify-api',
      engine: { ready: false, error: 'The processing server is unreachable.', checkedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    }));
  }, [refresh]);

  useEffect(() => {
    const hasActiveWork = batches.some((batch) => batch.status === 'queued' || batch.status === 'processing');
    if (!hasActiveWork) return;
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(timer);
  }, [batches, refresh]);

  useEffect(() => {
    try {
      window.localStorage?.setItem('artify:render-settings', JSON.stringify(settings));
    } catch {
      // Private browsing and embedded contexts may disable local preferences.
    }
  }, [settings]);

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

  const submit = async () => {
    if (!images.length || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { batch } = await createBatch(images.map((image) => image.file), settings);
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
      <header className="topbar">
        <Logo />
        <nav aria-label="Primary navigation">
          <a className="active" href="#workspace">Studio</a>
          <a href="#queue-heading">Renders</a>
        </nav>
        <div className="header-actions">
          <a className="icon-button" href="https://github.com/ByteHatesBugs/Artify-Studio" target="_blank" rel="noreferrer" aria-label="View project on GitHub"><Github size={18} /></a>
          <button className="help-button" type="button" onClick={() => showNotice('success', 'Tip: use Full HD and slow zoom for the most versatile campaign output.')}><CircleHelp size={16} /> Help</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className={`status-pill ${health && !health.engine.ready ? 'engine-off' : ''}`} title={health?.engine.version || health?.engine.error}>
              <span /> {health ? health.engine.ready ? 'FFmpeg engine ready' : 'Render engine unavailable' : 'Checking render engine'}
            </span>
            <h1>Still images.<br /><em>Built to move.</em></h1>
            <p>Turn an entire image set into polished, consistent video assets—without repetitive timelines or exports.</p>
          </div>
          <div className="hero-stats" aria-label="Product qualities">
            <div><span className="stat-icon"><Zap size={18} /></span><strong>Batch-first</strong><small>Up to 50 outputs</small></div>
            <div><span className="stat-icon"><WandSparkles size={18} /></span><strong>Motion-ready</strong><small>Five clean effects</small></div>
            <div><span className="stat-icon"><ShieldCheck size={18} /></span><strong>Queue-safe</strong><small>Controlled processing</small></div>
          </div>
        </section>

        <section className="studio-layout" id="workspace">
          <UploadZone images={images} disabled={isSubmitting} onAdd={addImages} onRemove={removeImage} onMove={moveImage} onClear={clearImages} />
          <SettingsPanel settings={settings} imageCount={images.length} isSubmitting={isSubmitting} engineReady={health?.engine.ready === true} onChange={setSettings} onReset={() => setSettings({ ...initialSettings, name: settings.name })} onSubmit={submit} />
        </section>

        <BatchQueue batches={batches} loading={isHistoryLoading} busyIds={busyIds} onCancel={(id) => requestAction('cancel', id)} onRetry={retry} onDelete={(id) => requestAction('delete', id)} />
      </main>

      <footer><Logo /><p>Batch motion production for focused creative teams.</p><span>Artify Studio · {new Date().getFullYear()}</span></footer>
      {notice && <div className={`toast ${notice.tone}`} role="status">{notice.tone === 'success' ? <Checkmark /> : <span>!</span>}<p>{notice.message}</p><button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={14} /></button></div>}
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.kind === 'cancel' ? 'Stop this render?' : 'Delete this batch?'}
          message={pendingAction.kind === 'cancel'
            ? `Artify will safely stop “${pendingAction.name}”. Completed files remain available and unfinished files can be retried.`
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
