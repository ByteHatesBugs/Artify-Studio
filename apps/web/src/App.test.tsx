// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ batches: [] }) }));

describe('Artify Studio', () => {
  it('renders the upload workspace and disabled empty render action', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /still images/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload images/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /render 0 videos/i })).toHaveProperty('disabled', true);
  });
});
