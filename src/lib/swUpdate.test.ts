import { vi } from 'vitest';
import { reloadOnNewVersion } from './swUpdate';

/** Fenêtre simulée : service worker, page et rechargement observables. */
function fakeWindow(controlled = true) {
  const sw = new EventTarget() as EventTarget & {
    controller: object | null;
    getRegistration: () => Promise<{ update: () => Promise<void> }>;
  };
  const update = vi.fn().mockResolvedValue(undefined);
  sw.controller = controlled ? {} : null;
  sw.getRegistration = vi.fn().mockResolvedValue({ update });
  const doc = new EventTarget() as EventTarget & { visibilityState: string };
  doc.visibilityState = 'visible';
  const reload = vi.fn();
  const win = Object.assign(new EventTarget(), {
    navigator: { serviceWorker: sw },
    document: doc,
    location: { reload },
  }) as unknown as Window;
  const setVisibility = (state: string) => {
    doc.visibilityState = state;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  const goTo = () => win.dispatchEvent(new Event('hashchange'));
  return { win, sw, doc, reload, update, setVisibility, goTo };
}

describe('nouvelle version de l’appli', () => {
  it('recharge la page quand la nouvelle version prend la main (une seule fois)', () => {
    const { win, sw, reload } = fakeWindow();
    reloadOnNewVersion(win);
    sw.dispatchEvent(new Event('controllerchange'));
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('première visite : pas de rechargement, mais la version suivante recharge', () => {
    const { win, sw, reload } = fakeWindow(false);
    reloadOnNewVersion(win);
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('formulaire commencé : attend le changement d’écran', () => {
    const { win, sw, doc, reload, goTo } = fakeWindow();
    reloadOnNewVersion(win);
    doc.dispatchEvent(new Event('input'));
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    goTo();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('saisie sur un écran précédent : rechargement immédiat', () => {
    const { win, sw, doc, reload, goTo } = fakeWindow();
    reloadOnNewVersion(win);
    doc.dispatchEvent(new Event('input'));
    goTo();
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('retour au premier plan : cherche une nouvelle version', async () => {
    const { win, update, setVisibility } = fakeWindow();
    reloadOnNewVersion(win);
    setVisibility('hidden');
    setVisibility('visible');
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  });
});
