// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RenderSettings } from '../types';
import { SettingsPanel } from './SettingsPanel';

const settings: RenderSettings = {
  name: 'Performance test', duration: 5, effectStart: 0, effectEnd: 5, fps: 30, resolution: '1080p',
  motion: 'zoom-in', focus: 'center', format: 'mp4', fit: 'cover', quality: 'balanced', fade: false,
  background: '#09090b', effects: [{ motion: 'zoom-in', focus: 'center', strength: 50, easing: 'cinematic', speed: 1, effectStart: 0, effectEnd: 5 }],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SettingsPanel preview performance', () => {
  it('uses a compact keyframe set and debounces rapid effect changes', () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const animate = vi.fn((_keyframes: Keyframe[]) => ({ cancel }));
    Object.defineProperty(HTMLImageElement.prototype, 'animate', { configurable: true, value: animate });
    const common = { previewImage: '/preview.png', imageCount: 1, isSubmitting: false, engineReady: true, onChange: vi.fn(), onReset: vi.fn(), onSubmit: vi.fn() };
    const { rerender } = render(<SettingsPanel settings={settings} {...common} />);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]?.[0]).toHaveLength(61);

    const faster = { ...settings, effects: [{ ...settings.effects[0]!, speed: 2 }] };
    rerender(<SettingsPanel settings={faster} {...common} />);
    expect(animate).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(90));
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[1]?.[0]).toHaveLength(61);
  });
});
