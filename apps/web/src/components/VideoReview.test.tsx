// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VideoReview } from './VideoReview';
import type { RenderJob } from '../types';

const settings: RenderJob['settings'] = {
  duration: 5,
  effectStart: 0.5,
  effectEnd: 4.5,
  fps: 30,
  resolution: 'portrait',
  motion: 'zoom-in',
  focus: 'center',
  format: 'mp4',
  fit: 'cover',
  quality: 'balanced',
  fade: true,
  background: '#09090b',
};

describe('VideoReview', () => {
  it('renders an aspect-aware review canvas and editor controls', () => {
    const { container } = render(<VideoReview source="/preview.mp4" outputName="campaign.mp4" settings={settings} />);

    expect(container.querySelector('.video-stage.is-portrait')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Play preview' })).toHaveLength(2);
    expect(screen.getByRole('slider', { name: 'Seek through preview' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Playback speed' })).toBeTruthy();
    expect(screen.getByText('campaign.mp4')).toBeTruthy();
    expect(screen.getByText(/zoom in · center focus/i)).toBeTruthy();
  });
});
