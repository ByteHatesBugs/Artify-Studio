// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
});

vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
  ok: true,
  json: async () => String(input).includes('/api/health')
    ? { status: 'ok', service: 'renderflow-api', engine: { ready: true, checkedAt: new Date().toISOString() }, timestamp: new Date().toISOString() }
    : { batches: [] },
})));

describe('RenderFlow', () => {
  it('renders the upload workspace and disabled empty render action', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /still images/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /source to verified export/i })).toBeTruthy();
    expect(screen.getByText(/11 effects · 5 curves/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload images/i })).toBeTruthy();
    expect(screen.queryByText(/soundtrack/i)).toBeNull();
    expect(screen.getByRole('combobox', { name: /search render history/i })).toBeTruthy();
    const campaignProfile = screen.getByRole('button', { name: /campaign full hd/i });
    expect(campaignProfile.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(campaignProfile);
    expect(campaignProfile.getAttribute('aria-pressed')).toBe('true');
    expect(await screen.findByRole('button', { name: /add images to continue/i })).toHaveProperty('disabled', true);
    expect(screen.getByText(/add at least one image to continue/i)).toBeTruthy();
    expect(screen.getByLabelText(/video output requirements/i).textContent).toMatch(/silent output/i);
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    expect(screen.getByRole('heading', { name: /your render queue is ready/i })).toBeTruthy();
  });
});
