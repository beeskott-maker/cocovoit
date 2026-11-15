import { useId, useState } from 'react';
import { markPushAsked, pushResultMessage, usePush } from '../lib/push';
import { InstallHelpSheet } from './InstallCard';
import { Sheet } from './Sheet';

function Bell() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const CONTENT = {
  driver: {
    title: "Être prévenu quand quelqu'un monte ?",
    items: [
      ['🙋', "Quelqu'un prend ou libère une place dans ta voiture"],
      ['⏰', 'Rappel la veille du départ'],
    ],
  },
  passenger: {
    title: 'Être prévenu si ta place change ?',
    items: [
      ['🚗', "Le conducteur change l'heure ou le point de rendez-vous"],
      ['😕', 'Ta place est annulée'],
      ['⏰', 'Rappel la veille du départ'],
    ],
  },
} as const;

/**
 * Proposition d'activer les notifications, au moment où elles ont du sens :
 * après avoir ajouté sa voiture (conducteur) ou pris sa première place (passager).
 */
export function PushAskSheet({
  token,
  role,
  onDone,
}: {
  token: string;
  role: 'driver' | 'passenger';
  /** Fermeture, avec le message à afficher (activées, refusées, erreur) ou null. */
  onDone: (message: string | null) => void;
}) {
  const { status, enable } = usePush(token);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const content = CONTENT[role];

  function later() {
    markPushAsked();
    onDone(null);
  }

  async function activate() {
    markPushAsked();
    setBusy(true);
    try {
      onDone(pushResultMessage(await enable()));
    } catch (err) {
      onDone(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  }

  if (help) return <InstallHelpSheet onClose={() => onDone(null)} />;
  if (!status) return null;

  return (
    <Sheet title={content.title} onClose={later}>
      <div className="push-ask">
        <div className="push-ask__bell">
          <Bell />
        </div>
        <ul className="push-ask__list">
          {content.items.map(([emoji, text]) => (
            <li key={text}>
              <span aria-hidden="true">{emoji}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        {status === 'needs-install' && (
          <p className="push-ask__ios">
            Sur iPhone, les notifications marchent avec <b>l'appli installée</b> sur l'écran d'accueil.
          </p>
        )}
        <div className="push-ask__actions">
          {status === 'needs-install' ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                markPushAsked();
                setHelp(true);
              }}
            >
              Installer l'appli
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => void activate()} disabled={busy}>
              Activer les notifications
            </button>
          )}
          <button type="button" className="link-btn" onClick={later}>
            Plus tard
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Interrupteur « Notifications » de Mes voyages, pour cet appareil. */
export function PushSetting({ token, onMessage }: { token: string; onMessage: (message: string) => void }) {
  const { status, enable, disable } = usePush(token);
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (!status || status === 'unsupported') return null;

  const hint =
    status === 'needs-install'
      ? "Installe l'appli sur l'écran d'accueil pour les activer"
      : status === 'denied'
        ? 'Bloquées : réautorise-les dans les réglages du téléphone'
        : 'Places prises ou libérées, changements, rappel la veille';

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      const s = on ? await enable() : await disable();
      const message = on ? pushResultMessage(s) : 'Notifications coupées sur cet appareil';
      if (message) onMessage(message);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="push-setting">
      <label className="recap-switch" htmlFor={id}>
        <span className="recap-switch__text">
          🔔 Notifications
          <small>{hint}</small>
        </span>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="recap-switch__input"
          checked={status === 'on'}
          disabled={busy || status === 'needs-install' || status === 'denied'}
          onChange={(e) => void toggle(e.target.checked)}
        />
        <span className="recap-switch__track" aria-hidden="true">
          <span className="recap-switch__thumb" />
        </span>
      </label>
    </div>
  );
}
