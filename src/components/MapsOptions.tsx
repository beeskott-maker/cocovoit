import { mapsApps, routeUrl } from '../lib/maps';

/** Liste des applis de carte (selon l'appareil), ouvertes sur l'adresse. */
export function MapsOptions({ address, onChoose }: { address: string; onChoose: () => void }) {
  return (
    <ul className="maps-list">
      {mapsApps().map((app) => (
        <li key={app.id}>
          <a
            className="maps-option"
            href={routeUrl(app.id, address)}
            // Le lien geo: est géré par Android, pas par un nouvel onglet.
            {...(app.id === 'other' ? {} : { target: '_blank', rel: 'noreferrer' })}
            onClick={onChoose}
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
  );
}
