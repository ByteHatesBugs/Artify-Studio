// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RenderedVideoEditor } from './RenderedVideoEditor';
import type { RenderJob } from '../types';

const job: RenderJob = {
  id: 'job-1',
  originalName: 'source.jpg',
  outputName: 'campaign.mp4',
  status: 'completed',
  progress: 100,
  attempts: 1,
  settings: {
    duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '1080p', motion: 'zoom-in', focus: 'center',
    format: 'mp4', fit: 'cover', quality: 'balanced', fade: true, background: '#09090b',
    effects: [{ motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 5 }],
  },
};

describe('RenderedVideoEditor', () => {
  it('renames and rerenders a completed video with a one-minute duration', () => {
    const onRename = vi.fn();
    const onRerender = vi.fn();
    render(<RenderedVideoEditor job={job} busy={false} onRename={onRename} onRerender={onRerender} onClose={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue('campaign'), { target: { value: 'launch-final' } });
    fireEvent.click(screen.getByRole('button', { name: /rename only/i }));
    expect(onRename).toHaveBeenCalledWith('launch-final');

    fireEvent.change(screen.getByRole('spinbutton', { name: /duration/i }), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }));
    expect(onRerender).toHaveBeenCalledWith('launch-final', expect.objectContaining({ duration: 60 }));
  });
});
