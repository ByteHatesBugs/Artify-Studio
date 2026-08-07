import { AlertCircle, Check, Download, Film, LoaderCircle, Square, Trash2, X } from 'lucide-react';
import { batchDownloadUrl, jobDownloadUrl } from '../api';
import type { Batch, JobStatus } from '../types';

interface BatchQueueProps {
  batches: Batch[];
  onCancel: (id: string) => void;
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

export function BatchQueue({ batches, onCancel, onDelete }: BatchQueueProps) {
  if (!batches.length) return null;

  return (
    <section className="queue-section" aria-labelledby="queue-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Render activity</span>
          <h2 id="queue-heading">Your output queue</h2>
        </div>
        <span className="queue-count">{batches.length} {batches.length === 1 ? 'batch' : 'batches'}</span>
      </div>

      <div className="batch-list">
        {batches.map((batch) => {
          const active = batch.status === 'processing' || batch.status === 'queued';
          const completedCount = batch.jobs.filter((job) => job.status === 'completed').length;
          return (
            <article className="batch-card" key={batch.id}>
              <div className="batch-topline">
                <div className="batch-title">
                  <span className="batch-icon"><Film size={19} /></span>
                  <div><h3>{batch.name}</h3><p>{batch.jobs.length} outputs · {batch.settings.resolution} · {batch.settings.format.toUpperCase()}</p></div>
                </div>
                <div className="batch-actions">
                  {!active && completedCount > 0 && <a className="icon-action download-action" href={batchDownloadUrl(batch.id)} aria-label={`Download ${batch.name}`}><Download size={16} /><span>Download all</span></a>}
                  {active ? (
                    <button className="icon-action" type="button" onClick={() => onCancel(batch.id)}><Square size={13} fill="currentColor" /> Stop</button>
                  ) : (
                    <button className="icon-button" type="button" aria-label={`Delete ${batch.name}`} onClick={() => onDelete(batch.id)}><Trash2 size={16} /></button>
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
                    <div className="job-name"><strong>{job.originalName}</strong><span>{job.error || statusLabel[job.status]}</span></div>
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
