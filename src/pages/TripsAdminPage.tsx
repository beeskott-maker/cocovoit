import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { Toast } from '../components/Toast';
import { useApi } from '../lib/api';
import { formatTripDates } from '../lib/format';
import { ApiError, type AdminTrip } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

const createdFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/**
 * Liste de tous les voyages, avec ouverture et suppression.
 * Servie à l'URL #/x/<clé> : sans la bonne clé, on voit « Lien introuvable ».
 */
export function TripsAdminPage() {
  const { key = '' } = useParams();
  const api = useApi();
  const [trips, setTrips] = useState<AdminTrip[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    try {
      setTrips(await api.adminListTrips(key));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'forbidden') setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  }, [api, key]);

  useEffect(() => {
    void load();
  }, [load]);

  if (forbidden) return <NotFoundPage />;

  async function remove(trip: AdminTrip) {
    const details = `${plural(trip.participants, 'participant')}, ${plural(trip.cars, 'voiture')}`;
    if (!window.confirm(`Supprimer « ${trip.name} » (${details}) ?\n\nToutes ses données seront effacées et son lien d'invitation ne marchera plus. Cette action est irréversible.`)) {
      return;
    }
    setBusyCode(trip.code);
    try {
      await api.adminDeleteTrip(key, trip.code);
      setToast(`« ${trip.name} » supprimé`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setBusyCode(null);
      await load();
    }
  }

  return (
    <>
      <BrandHeader />
      <div className="page-title">
        <h1 className="display-small">Voyages</h1>
        {trips && <p className="body-medium">{plural(trips.length, 'voyage')}</p>}
      </div>
      <main className="admin-list">
        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}
        {!trips && !error && <p className="loading">Chargement…</p>}
        {trips?.length === 0 && <p className="body-large empty">Aucun voyage pour l'instant.</p>}
        {trips?.map((trip) => (
          <article key={trip.code} className="admin-trip" aria-label={trip.name}>
            <div className="admin-trip__infos">
              <h2 className="title-large">{trip.name}</h2>
              <p className="body-medium">{formatTripDates(trip.startsOn, trip.endsOn)}</p>
              <p className="body-medium">{trip.destination}</p>
              <p className="body-medium">
                {plural(trip.participants, 'participant')} · {plural(trip.cars, 'voiture')} · créé le{' '}
                {createdFormat.format(new Date(trip.createdAt))}
              </p>
            </div>
            <div className="admin-trip__actions">
              <Link className="btn btn--outline" to={`/j/${trip.code}`}>
                Ouvrir
              </Link>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => remove(trip)}
                disabled={busyCode === trip.code}
              >
                Supprimer
              </button>
            </div>
          </article>
        ))}
      </main>
      {toast && <Toast message={toast} onDone={hideToast} />}
    </>
  );
}
