import { useMemo, useState } from 'react';
import { AlertCircle, Check, Download, Film, Inbox, LoaderCircle, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { batchDownloadUrl, jobDownloadUrl } from '../api';
import type { Batch, JobStatus } from '../types';

interface BatchQueueProps {
  batches: Batch[];
  loading: boolean;
  busyIds: Set<string>;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
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

export function BatchQueue({ batches, loading, busyIds, onCancel, onRetry, onDelete }: BatchQueueProps) {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const visibleBatches = useMemo(() => batches.filter((batch) => {
    if (filter === 'active') return batch.status === 'queued' || batch.status === 'processing';
    if (filter === 'ready') return batch.status === 'completed';
    if (filter === 'attention') return batch.status === 'failed' || batch.status === 'cancelled';
    return true;
  }), [batches, filter]);
  const filters: Array<{ value: QueueFilter; label: string }> = [
    { value: 'all', label: `All ${batches.length}` },
    { value: 'active', label: 'Active' },
    { value: 'ready', label: 'Ready' },
    { value: 'attention', label: 'Attention' },
  ];

  return (
    <section className="queue-section" aria-labelledby="queue-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Render activity</span>
          <h2 id="queue-heading">Your output queue</h2>
        </div>
        <div className="queue-filters" aria-label="Filter renders">
          {filters.map((option) => <button type="button" key={option.value} className={filter === option.value ? 'selected' : ''} onClick={() => setFilter(option.value)}>{option.label}</button>)}
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
            <article className="batch-card" key={batch.id}>
              <div className="batch-topline">
                <div className="batch-title">
                  <span className="batch-icon"><Film size={19} /></span>
                  <div><h3>{batch.name}</h3><p>{batch.jobs.length} outputs · {batch.settings.resolution} · effect {batch.settings.effectStart ?? 0}–{batch.settings.effectEnd ?? batch.settings.duration}s · {batch.settings.quality || 'balanced'} · {batch.settings.format.toUpperCase()}</p></div>
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
                <div className="progress-track"><span style={{ width: `${batch.progress}%` }} /></div>
                <strong>{batch.progress}%</strong>
              </div>
              <div className="job-list">
                {batch.jobs.map((job) => (
                  <div className="job-row" key={job.id}>
                    <div className={`job-status ${job.status}`}><StatusIcon status={job.status} /></div>
                    <div className="job-name"><strong>{job.originalName}</strong><span title={job.error}>{job.error || `${statusLabel[job.status]} · Attempt ${job.attempts || 0}`}</span></div>
                    <div className="job-mini-progress"><span style={{ width: `${job.progress}%` }} /></div>
                    {job.status === 'completed' ? (
                      <a className="icon-button" href={jobDownloadUrl(batch.id, job.id)} aria-label={`Download ${job.outputName}`}><Download size={15} /></a>
                    ) : <span className="job-percent">{job.progress}%</span>}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
