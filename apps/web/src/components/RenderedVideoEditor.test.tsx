// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RenderedVideoEditor } from './RenderedVideoEditor';
import type { RenderJob } from '../types';

const job: RenderJob = {
  id: 'job-1',
  originalName: 'source.jpg',
  audioName: 'soundtrack.mp3',
  outputName: 'campaign.mp4',
  status: 'completed',
  progress: 100,
  attempts: 1,
  settings: {
    duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '1080p', motion: 'zoom-in', focus: 'center',
    format: 'mp4', fit: 'cover', quality: 'balanced', fade: true, background: '#09090b', audioVolume: 0.8, audioSourceStart: 0, audioVideoStart: 0,
    effects: [{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }],
  },
};

describe('RenderedVideoEditor', () => {
  it('renames and rerenders a completed video with a one-minute duration', () => {
    const onRename = vi.fn();
    const onRerender = vi.fn();
    render(<RenderedVideoEditor job={job} audioSource="/api/audio" busy={false} onRename={onRename} onRerender={onRerender} onClose={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue('campaign'), { target: { value: 'launch-final' } });
    fireEvent.click(screen.getByRole('button', { name: /rename only/i }));
    expect(onRename).toHaveBeenCalledWith('launch-final');

    fireEvent.change(screen.getByRole('spinbutton', { name: /duration/i }), { target: { value: '60' } });
    fireEvent.change(screen.getByRole('slider', { name: /soundtrack volume/i }), { target: { value: '0.5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /start time in soundtrack/i }), { target: { value: '8.5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /soundtrack start time in video/i }), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }));
    expect(onRerender).toHaveBeenCalledWith('launch-final', expect.objectContaining({ duration: 60, audioVolume: 0.5, audioSourceStart: 8.5, audioVideoStart: 4 }));
  });
});
