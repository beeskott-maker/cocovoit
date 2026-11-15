import { useState } from 'react';
import icon from '../assets/brand/icon.svg';
import { useInstall } from '../lib/install';
import { Sheet } from './Sheet';

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 12v8h14v-8" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

/** Aide iPhone / iPad : ajouter l'appli à l'écran d'accueil depuis Safari. */
export function InstallHelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Ajouter à l'écran d'accueil" onClose={onClose}>
      <ol className="install-steps">
        <li>
          <span>
            Touche <b>Partager</b> en bas de Safari
          </span>
          <span className="install-steps__icon">
            <ShareIcon />
          </span>
        </li>
        <li>
          <span>
            Choisis <b>« Sur l'écran d'accueil »</b>
          </span>
          <span className="install-steps__icon">
            <AddIcon />
          </span>
        </li>
        <li>
          <span>
            Touche <b>Ajouter</b>, en haut à droite
          </span>
        </li>
      </ol>
      <button type="button" className="btn btn--primary" onClick={onClose}>
        J'ai compris
      </button>
    </Sheet>
  );
}

/** Encart fixé en bas de Mes voyages : installer l'appli sur l'écran d'accueil. */
export function InstallCard() {
  const { mode, install, dismiss } = useInstall();
  const [help, setHelp] = useState(false);
  if (!mode) return null;

  return (
    <>
      <aside className="install-card" aria-label="Installer l'appli">
        <img src={icon} alt="" width={44} height={44} />
        <div className="install-card__text">
          <p className="install-card__title">Coco·Voit en appli</p>
          <p>Tes voyages en un geste</p>
        </div>
        <button
          type="button"
          className="btn btn--tertiary install-card__btn"
          onClick={() => (mode === 'prompt' ? void install() : setHelp(true))}
        >
          {mode === 'prompt' ? 'Installer' : 'Comment ?'}
        </button>
        <button type="button" className="install-card__close" aria-label="Plus tard" onClick={dismiss}>
          ✕
        </button>
      </aside>
      {help && <InstallHelpSheet onClose={() => setHelp(false)} />}
    </>
  );
}
