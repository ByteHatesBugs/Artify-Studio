// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Batch } from '../types';
import { BatchQueue } from './BatchQueue';

const storedSearches = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storedSearches.get(key) ?? null,
    setItem: (key: string, value: string) => storedSearches.set(key, value),
    removeItem: (key: string) => storedSearches.delete(key),
    clear: () => storedSearches.clear(),
  },
});

const settings: Batch['settings'] = {
  duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '1080p', motion: 'zoom-in', focus: 'center',
  format: 'mp4', fit: 'cover', quality: 'balanced', fade: true, background: '#09090b', audioVolume: 0.8, audioSourceStart: 0, audioVideoStart: 0,
  effects: [{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }],
};

const batches: Batch[] = [
  { id: 'alpha', name: 'Alpha campaign', status: 'completed', progress: 100, settings, createdAt: '2026-01-01', jobs: [{ id: 'a', originalName: 'hero.jpg', outputName: 'hero.mp4', status: 'completed', progress: 100, attempts: 1, settings }] },
  { id: 'beta', name: 'Beta social', status: 'processing', progress: 40, settings, createdAt: '2026-01-02', jobs: [{ id: 'b', originalName: 'story.jpg', outputName: 'story.mp4', status: 'processing', progress: 40, attempts: 1, settings }] },
];

describe('BatchQueue workflow tools', () => {
  beforeEach(() => window.localStorage.clear());

  it('searches render history and shows useful filter counts', async () => {
    const view = render(<BatchQueue batches={batches} loading={false} busyIds={new Set()} onCancel={vi.fn()} onRetry={vi.fn()} onRenameJob={vi.fn()} onRerenderJob={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Ready 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Active 1' })).toBeTruthy();

    const search = screen.getByRole('combobox', { name: /search render history/i });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: 'hero' } });
    expect(await screen.findByRole('option', { name: 'hero.mp4' })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByText('Beta social')).toBeNull());
    expect(screen.getByText('Alpha campaign')).toBeTruthy();
    expect(window.localStorage.getItem('renderflow:render-search')).toBe('hero');
    expect(window.localStorage.getItem('renderflow:render-search-history')).toContain('hero');
    view.unmount();
    render(<BatchQueue batches={batches} loading={false} busyIds={new Set()} onCancel={vi.fn()} onRetry={vi.fn()} onRenameJob={vi.fn()} onRerenderJob={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /search render history/i })).toHaveProperty('value', 'hero');
  });
});
