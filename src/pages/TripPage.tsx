import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import carIcon from '../assets/figma/car.svg';
import { CarCard } from '../components/CarCard';
import { Toast } from '../components/Toast';
import { TripHeader } from '../components/TripHeader';
import { useApi } from '../lib/api';
import { inviteUrl } from '../lib/format';
import { clearSession, getSession } from '../lib/session';
import type { Leg } from '../lib/types';
import { useTripState } from '../lib/useTripState';

export function TripPage() {
  const { code = '' } = useParams();
  const session = getSession(code);
  const api = useApi();
  const navigate = useNavigate();
  const { state, error, reload } = useTripState(code, session?.secret);
  const [busyLegId, setBusyLegId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  if (!session || error?.code === 'forbidden') {
    if (session) clearSession(code);
    return <Navigate to={`/j/${code}`} replace />;
  }
  if (!state) {
    return error ? (
      <p className="banner banner--error" role="alert">
        {error.message}
      </p>
    ) : (
      <p className="loading">Chargement du voyage…</p>
    );
  }

  const myCar = state.cars.find((c) => c.driver.id === state.me.id);
  const carHref = myCar ? `/t/${code}/voiture/${myCar.id}` : `/t/${code}/voiture`;

  async function act(leg: Leg, action: 'take' | 'leave') {
    setBusyLegId(leg.id);
    try {
      if (action === 'take') await api.takeSeat(code, session!.secret, leg.id);
      else await api.leaveSeat(code, session!.secret, leg.id);
      setToast(action === 'take' ? `Place réservée pour ${leg.direction === 'aller' ? "l'aller" : 'le retour'}` : 'Place libérée');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setBusyLegId(null);
      await reload();
    }
  }

  async function shareLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setToast("Lien copié : envoyez-le aux nouveaux passagers");
    } catch {
      setToast(`Copie impossible. Lien : ${inviteUrl(code)}`);
    }
  }

  function switchPerson() {
    clearSession(code);
    navigate(`/j/${code}`);
  }

  return (
    <>
      <TripHeader trip={state.trip} onShare={shareLink} />
      {api.mode === 'demo' && (
        <p className="banner">
          Mode démo : les données restent dans ce navigateur. Configurez Supabase pour partager le voyage.
        </p>
      )}
      <main className="trip-body">
        {state.cars.length === 0 ? (
          <div className="empty">
            <img src={carIcon} alt="" />
            <p className="body-large">Personne n'a encore proposé de voiture.</p>
            <p className="body-medium">Vous conduisez ? Ajoutez votre voiture pour que les autres réservent une place.</p>
          </div>
        ) : (
          state.cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              meId={state.me.id}
              editHref={`/t/${code}/voiture/${car.id}`}
              busyLegId={busyLegId}
              onTake={(leg) => act(leg, 'take')}
              onLeave={(leg) => act(leg, 'leave')}
            />
          ))
        )}
        {!myCar && (
          <Link className="btn btn--tertiary" to={carHref}>
            Ajouter ma voiture
          </Link>
        )}
      </main>
      <footer className="trip-footer body-medium">
        <span>
          Connecté·e en tant que <strong>{state.me.name}</strong>
        </span>
        <span>
          <button type="button" className="link-btn" onClick={switchPerson}>
            Ce n'est pas moi
          </button>
          {' · '}
          <Link to="/">Mes voyages</Link>
        </span>
      </footer>
      {toast && <Toast message={toast} onDone={hideToast} />}
    </>
  );
}
