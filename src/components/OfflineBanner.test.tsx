import { act, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

afterEach(() => vi.restoreAllMocks());

describe('bandeau hors ligne', () => {
  it('apparaît sans réseau et disparaît au retour de la connexion', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();

    setOnline(false);
    expect(screen.getByRole('status')).toHaveTextContent('Pas de réseau');

    setOnline(true);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
