// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EffectStackEditor } from './EffectStackEditor';

describe('EffectStackEditor', () => {
  it('adds a second effect and distributes both across the duration', () => {
    const onChange = vi.fn();
    render(
      <EffectStackEditor
        duration={6}
        effects={[{ motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 6 }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add effect/i }));
    expect(onChange).toHaveBeenCalledWith([
      { motion: 'zoom-in', focus: 'center', effectStart: 0, effectEnd: 3 },
      { motion: 'pan-right', focus: 'center', effectStart: 3, effectEnd: 6 },
    ]);
  });
});
