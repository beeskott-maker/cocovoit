import { useOnline } from '../lib/useOnline';

/** Bandeau affiché sans réseau : les données reviennent toutes seules avec la connexion. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <p className="offline-banner" role="status">
      Pas de réseau : mise à jour dès son retour
    </p>
  );
}
