// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
});

vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
  ok: true,
  json: async () => String(input).includes('/api/health')
    ? { status: 'ok', service: 'artify-api', engine: { ready: true, checkedAt: new Date().toISOString() }, timestamp: new Date().toISOString() }
    : { batches: [] },
})));

describe('Artify Studio', () => {
  it('renders the upload workspace and disabled empty render action', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /still images/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload images/i })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /render 0 videos/i })).toHaveProperty('disabled', true);
    expect(screen.getByRole('heading', { name: /your render queue is ready/i })).toBeTruthy();
  });
});
