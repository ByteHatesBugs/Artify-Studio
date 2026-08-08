// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EffectStackEditor } from './EffectStackEditor';

afterEach(cleanup);

describe('EffectStackEditor', () => {
  it('adds a second effect without changing the first effect duration', () => {
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
      { motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 6 },
      { motion: 'pan-right', focus: 'center', strength: 50, effectStart: 3, effectEnd: 6 },
    ]);
  });

  it('allows overlapping times and keeps the first effect bar unchanged', () => {
    const onChange = vi.fn();
    const effects = [
      { motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 3 },
      { motion: 'pan-right', focus: 'center', strength: 50, effectStart: 3, effectEnd: 6 },
    ] as const;
    render(<EffectStackEditor duration={6} effects={[...effects]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /effect 1 end/i }), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith([
      { ...effects[0], effectEnd: 5 },
      effects[1],
    ]);
  });

  it('updates an individual effect strength', () => {
    const onChange = vi.fn();
    render(<EffectStackEditor duration={5} effects={[{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: /effect 1 strength/i }), { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledWith([{ motion: 'zoom-in', focus: 'center', strength: 75, effectStart: 0, effectEnd: 5 }]);
  });

  it('offers vertical and diagonal motion effects', () => {
    const onChange = vi.fn();
    render(<EffectStackEditor duration={5} effects={[{ motion: 'zoom-in', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }]} onChange={onChange} />);
    const motion = screen.getByRole('combobox', { name: /motion/i });
    expect(screen.getByRole('option', { name: 'Pan up' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Drift down right' })).not.toBeNull();
    fireEvent.change(motion, { target: { value: 'drift-down-right' } });
    expect(onChange).toHaveBeenCalledWith([{ motion: 'drift-down-right', focus: 'center', strength: 50, effectStart: 0, effectEnd: 5 }]);
  });
});
