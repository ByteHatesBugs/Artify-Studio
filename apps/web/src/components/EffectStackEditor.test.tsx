// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EffectStackEditor } from './EffectStackEditor';

afterEach(cleanup);

describe('EffectStackEditor', () => {
  it('adds a second effect and distributes both across the duration', () => {
    const onChange = vi.fn();
    render(
      <EffectStackEditor
        duration={6}
        effects={[{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 6 }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add effect/i }));
    expect(onChange).toHaveBeenCalledWith([
      { motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 3 },
      { motion: 'pan-right', focus: 'center', strength: 50, effectStart: 3, effectEnd: 6 },
    ]);
  });

  it('updates an individual effect strength', () => {
    const onChange = vi.fn();
    render(<EffectStackEditor duration={5} effects={[{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: /effect 1 strength/i }), { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledWith([{ motion: 'zoom-in', focus: 'center', strength: 75, effectStart: 0, effectEnd: 5 }]);
  });
});
