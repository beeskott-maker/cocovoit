import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Sheet } from './Sheet';

function swipe(el: HTMLElement, from: number, to: number) {
  fireEvent.touchStart(el, { touches: [{ clientY: from }] });
  fireEvent.touchMove(el, { touches: [{ clientY: to }] });
  fireEvent.touchEnd(el, { touches: [] });
}

describe('panneau (Sheet)', () => {
  it('glissé vers le bas : se ferme au-delà du seuil, revient sinon', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Point de rendez-vous" onClose={onClose}>
        <p>Contenu</p>
      </Sheet>,
    );
    const sheet = screen.getByRole('dialog', { name: 'Point de rendez-vous' });

    swipe(sheet, 100, 120);
    expect(sheet.style.transform).toBe('');
    expect(onClose).not.toHaveBeenCalled();

    swipe(sheet, 100, 300);
    expect(sheet.style.transform).toBe('translateY(100%)');
    fireEvent.transitionEnd(sheet);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
