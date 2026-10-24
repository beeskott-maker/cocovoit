import { useEffect, useId } from 'react';
import pin from '../assets/figma/pin-dark.svg';
import { mapsApps, routeUrl } from '../lib/maps';

interface Props {
  address: string;
  onClose: () => void;
}

/** Choix de l'appli d'itinéraire, en panneau depuis le bas de l'écran. */
export function MapsSheet({ address, onClose }: Props) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet__handle" aria-hidden="true" />
        <div>
          <h2 id={titleId} className="sheet__title">
            Ouvrir l'itinéraire avec
          </h2>
          <p className="sheet__address">
            <img src={pin} alt="" width={18} height={18} />
            {address}
          </p>
        </div>
        <ul className="maps-list">
          {mapsApps().map((app) => (
            <li key={app.id}>
              <a
                className="maps-option"
                href={routeUrl(app.id, address)}
                // Le lien geo: est géré par Android, pas par un nouvel onglet.
                {...(app.id === 'other' ? {} : { target: '_blank', rel: 'noreferrer' })}
                onClick={onClose}
              >
                {app.icon ? (
                  <img className="maps-option__icon" src={app.icon} alt="" width={36} height={36} />
                ) : (
                  <span className="maps-option__icon maps-option__icon--other" aria-hidden="true">
                    …
                  </span>
                )}
                {app.name}
                {app.hint && <small className="maps-option__hint">{app.hint}</small>}
              </a>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn--text sheet__cancel" onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>
  );
}
