import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronUp, CirclePlay, Download, Film, Inbox, LoaderCircle, Pencil, RotateCcw, Search, Square, Trash2, X } from 'lucide-react';
import { batchDownloadUrl, jobDownloadUrl, jobPreviewUrl } from '../api';
import type { Batch, JobStatus, RenderJob } from '../types';

const VideoReview = lazy(() => import('./VideoReview').then((module) => ({ default: module.VideoReview })));
const RenderedVideoEditor = lazy(() => import('./RenderedVideoEditor').then((module) => ({ default: module.RenderedVideoEditor })));

interface BatchQueueProps {
  batches: Batch[];
  loading: boolean;
  busyIds: Set<string>;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRenameJob: (batchId: string, jobId: string, outputName: string) => void;
  onRerenderJob: (batchId: string, jobId: string, outputName: string, settings: RenderJob['settings']) => void;
  onDelete: (id: string) => void;
}

const statusLabel: Record<JobStatus, string> = {
  queued: 'Waiting',
  processing: 'Rendering',
  completed: 'Ready',
  failed: 'Needs attention',
  cancelled: 'Cancelled',
};

const StatusIcon = ({ status }: { status: JobStatus }) => {
  if (status === 'completed') return <Check size={14} />;
  if (status === 'failed') return <AlertCircle size={14} />;
  if (status === 'cancelled') return <X size={14} />;
  return <LoaderCircle size={14} className={status === 'processing' ? 'spin' : ''} />;
};

type QueueFilter = 'all' | 'active' | 'ready' | 'attention';

export function BatchQueue({ batches, loading, busyIds, onCancel, onRetry, onRenameJob, onRerenderJob, onDelete }: BatchQueueProps) {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [query, setQuery] = useState('');
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const visibleBatches = useMemo(() => batches.filter((batch) => {
    if (filter === 'active') return batch.status === 'queued' || batch.status === 'processing';
    if (filter === 'ready') return batch.status === 'completed';
    if (filter === 'attention') return batch.status === 'failed' || batch.status === 'cancelled';
    return true;
  }).filter((batch) => !deferredQuery || batch.name.toLowerCase().includes(deferredQuery) || batch.jobs.some((job) => job.originalName.toLowerCase().includes(deferredQuery) || job.outputName.toLowerCase().includes(deferredQuery))), [batches, deferredQuery, filter]);
  const counts = useMemo(() => batches.reduce((total, batch) => {
    if (batch.status === 'queued' || batch.status === 'processing') total.active += 1;
    else if (batch.status === 'completed') total.ready += 1;
    else total.attention += 1;
    return total;
  }, { active: 0, ready: 0, attention: 0 }), [batches]);
  const filters: Array<{ value: QueueFilter; label: string }> = [
    { value: 'all', label: `All ${batches.length}` },
    { value: 'active', label: `Active ${counts.active}` },
    { value: 'ready', label: `Ready ${counts.ready}` },
    { value: 'attention', label: `Attention ${counts.attention}` },
  ];

  useEffect(() => {
    const focusSearch = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (event.key === '/' && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  return (
    <section className="queue-section" aria-labelledby="queue-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Render activity</span>
          <h2 id="queue-heading">Your output queue</h2>
        </div>
        <div className="queue-tools">
          <label className="queue-search"><Search size={13} /><input ref={searchRef} aria-label="Search render history" value={query} placeholder="Search renders" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setQuery(''); }} />{query && <button type="button" aria-label="Clear render search" onClick={() => setQuery('')}><X size={12} /></button>}<kbd>/</kbd></label>
          <div className="queue-filters" aria-label="Filter renders">
            {filters.map((option) => <button type="button" key={option.value} className={filter === option.value ? 'selected' : ''} onClick={() => setFilter(option.value)}>{option.label}</button>)}
          </div>
        </div>
      </div>

      <div className="batch-list">
        {loading && batches.length === 0 && <div className="queue-skeleton" aria-label="Loading render history"><span /><span /><span /></div>}
        {!loading && visibleBatches.length === 0 && (
          <div className="queue-empty">
            <span><Inbox size={24} /></span>
            <h3>{batches.length ? 'No renders in this view' : 'Your render queue is ready'}</h3>
            <p>{batches.length ? 'Choose another filter to see your batches.' : 'Add images and start a render. Progress and downloads will appear here.'}</p>
            {!batches.length && <a href="#workspace">Create your first batch</a>}
          </div>
        )}
        {visibleBatches.map((batch) => {
          const active = batch.status === 'processing' || batch.status === 'queued';
          const busy = busyIds.has(batch.id);
          const completedCount = batch.jobs.filter((job) => job.status === 'completed').length;
          const retryableCount = batch.jobs.filter((job) => job.status === 'failed' || job.status === 'cancelled').length;
          return (
            <article className={`batch-card status-${batch.status}`} key={batch.id}>
              <div className="batch-topline">
                <div className="batch-title">
                  <span className="batch-icon"><Film size={19} /></span>
                  <div><h3>{batch.name}</h3><p>{batch.jobs.length} outputs · {batch.settings.resolution} · {batch.settings.effects?.length ?? 1} effect{(batch.settings.effects?.length ?? 1) === 1 ? '' : 's'} · {batch.settings.quality || 'balanced'} · {batch.settings.format.toUpperCase()}</p></div>
                </div>
                <div className="batch-actions">
                  {!active && completedCount > 0 && <a className="icon-action download-action" href={batchDownloadUrl(batch.id)} aria-label={`Download ${batch.name}`}><Download size={16} /><span>Download all</span></a>}
                  {!active && retryableCount > 0 && <button className="icon-action retry-action" type="button" onClick={() => onRetry(batch.id)} disabled={busy}><RotateCcw size={14} /><span>Retry {retryableCount}</span></button>}
                  {active ? (
                    <button className="icon-action" type="button" onClick={() => onCancel(batch.id)} disabled={busy}><Square size={13} fill="currentColor" /> Stop</button>
                  ) : (
                    <button className="icon-button" type="button" aria-label={`Delete ${batch.name}`} onClick={() => onDelete(batch.id)} disabled={busy}><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
              <div className="batch-progress-row">
                <div className={`progress-track ${active ? 'is-active' : ''}`} role="progressbar" aria-label={`${batch.name} render progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={batch.progress}><span style={{ width: `${batch.progress}%` }} /></div>
                <strong>{batch.progress}%</strong>
              </div>
              <div className="job-list">
                {batch.jobs.map((job) => {
                  const key = `${batch.id}:${job.id}`;
                  const previewOpen = previewKey === key;
                  const editorOpen = editorKey === key;
                  const effectSummary = job.settings
                    ? `${job.settings.effects?.length ?? 1} effect${(job.settings.effects?.length ?? 1) === 1 ? '' : 's'} · full canvas`
                    : statusLabel[job.status];
                  return (
                    <div className="job-item" key={job.id}>
                      <div className={`job-row status-${job.status}`}>
                        <div className={`job-status ${job.status}`}><StatusIcon status={job.status} /></div>
                        <div className="job-name"><strong>{job.originalName}</strong><span title={job.error}>{job.error || `${statusLabel[job.status]} · ${effectSummary} · Attempt ${job.attempts || 0}`}</span></div>
                        <div className="job-mini-progress"><span style={{ width: `${job.progress}%` }} /></div>
                        {job.status === 'completed' ? (
                          <div className="job-actions">
                            <button className={`icon-button ${previewOpen ? 'selected' : ''}`} type="button" aria-label={`${previewOpen ? 'Close' : 'Preview'} ${job.outputName}`} aria-expanded={previewOpen} onClick={() => { setEditorKey(null); setPreviewKey(previewOpen ? null : key); }}>{previewOpen ? <ChevronUp size={15} /> : <CirclePlay size={16} />}</button>
                            <button className={`icon-button ${editorOpen ? 'selected' : ''}`} type="button" aria-label={`Edit ${job.outputName}`} aria-expanded={editorOpen} onClick={() => { setPreviewKey(null); setEditorKey(editorOpen ? null : key); }}><Pencil size={14} /></button>
                            <a className="icon-button" href={jobDownloadUrl(batch.id, job.id)} aria-label={`Download ${job.outputName}`}><Download size={15} /></a>
                          </div>
                        ) : <span className="job-percent">{job.progress}%</span>}
                      </div>
                      {previewOpen && (
                        <div className="video-test-panel">
                          <Suspense fallback={<div className="panel-loading"><span className="spinner" /> Loading preview…</div>}><VideoReview source={jobPreviewUrl(batch.id, job.id)} outputName={job.outputName} settings={job.settings} /></Suspense>
                        </div>
                      )}
                      {editorOpen && job.status === 'completed' && (
                        <Suspense fallback={<div className="panel-loading"><span className="spinner" /> Loading editor…</div>}>
                          <RenderedVideoEditor
                            job={job}
                            busy={busy}
                            onRename={(outputName) => onRenameJob(batch.id, job.id, outputName)}
                            onRerender={(outputName, settings) => onRerenderJob(batch.id, job.id, outputName, settings)}
                            onClose={() => setEditorKey(null)}
                          />
                        </Suspense>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
