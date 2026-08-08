// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AudioTrackPicker } from './AudioTrackPicker';

describe('AudioTrackPicker', () => {
  it('previews a soundtrack and exposes mix and removal controls', () => {
    const onRemove = vi.fn();
    const onVolumeChange = vi.fn();
    render(<AudioTrackPicker audio={{ file: new File(['music'], 'launch.mp3', { type: 'audio/mpeg' }), previewUrl: 'blob:music' }} volume={0.8} onSelect={vi.fn()} onRemove={onRemove} onVolumeChange={onVolumeChange} />);

    expect(screen.getByText('launch.mp3')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: /soundtrack volume/i }), { target: { value: '0.55' } });
    expect(onVolumeChange).toHaveBeenCalledWith(0.55);
    fireEvent.click(screen.getByRole('button', { name: /remove soundtrack/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
