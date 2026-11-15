import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import { listenForInstallPrompt } from '../lib/install';
import { InstallCard } from './InstallCard';

beforeAll(() => listenForInstallPrompt());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
});

function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(e);
  });
  return { prompt, e };
}

describe('encart « Installer l\'appli »', () => {
  it('rien à proposer sur un navigateur qui ne sait pas installer', () => {
    render(<InstallCard />);
    expect(screen.queryByRole('complementary', { name: "Installer l'appli" })).toBeNull();
  });

  it('Chrome / Android : « Installer » ouvre la fenêtre d\'installation, puis l\'encart disparaît', async () => {
    render(<InstallCard />);
    const { prompt, e } = offerInstall();
    expect(e.defaultPrevented).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Installer' }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull();
  });

  it('la croix masque l\'encart et s\'en souvient', () => {
    const { unmount } = render(<InstallCard />);
    offerInstall();
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull();
    unmount();
    render(<InstallCard />);
    expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull();
  });

  it('iPhone : « Comment ? » ouvre l\'aide en trois étapes', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    );
    render(<InstallCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Comment ?' }));
    const dialog = screen.getByRole('dialog', { name: "Ajouter à l'écran d'accueil" });
    expect(dialog).toHaveTextContent("Sur l'écran d'accueil");
    fireEvent.click(screen.getByRole('button', { name: "J'ai compris" }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
