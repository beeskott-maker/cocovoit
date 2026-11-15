import { useEffect, useState } from 'react';
import { storageKey } from './env';

/**
 * Installation de l'appli (PWA) sur l'écran d'accueil.
 * - Chrome / Edge / Android : l'évènement « beforeinstallprompt » est gardé pour
 *   ouvrir la fenêtre d'installation depuis notre bouton.
 * - iPhone / iPad : pas d'installation depuis la page, on explique comment faire.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = storageKey('install-dismissed');
const DISMISS_DAYS = 30;

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** À appeler au démarrage : l'évènement peut arriver avant l'affichage de Mes voyages. */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

export type InstallMode = 'prompt' | 'ios' | null;

/** Mode d'installation proposé (null : rien à proposer), et actions associées. */
export function useInstall() {
  const [, rerender] = useState(0);
  const [dismissed, setDismissed] = useState(dismissedRecently);
  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  let mode: InstallMode = null;
  if (!dismissed && !isStandalone()) mode = deferred ? 'prompt' : isIos() ? 'ios' : null;

  async function install() {
    const e = deferred;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') {
      deferred = null;
      notify();
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Stockage indisponible : masqué pour cette visite seulement.
    }
    setDismissed(true);
  }

  return { mode, install, dismiss };
}
