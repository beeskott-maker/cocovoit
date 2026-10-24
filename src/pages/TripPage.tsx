import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import carIcon from '../assets/figma/car.svg';
import { CarCard } from '../components/CarCard';
import { MapsSheet } from '../components/MapsSheet';
import { RequireAccount } from '../components/RequireAccount';
import { Toast } from '../components/Toast';
import { TripHeader } from '../components/TripHeader';
import { useApi } from '../lib/api';
import { inviteUrl } from '../lib/format';
import { routeUrl, useMapsPreference, type MapsAppId } from '../lib/maps';
import { useAuth } from '../lib/auth';
import { bookedDirections } from '../lib/seats';
import type { Leg } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';
import { tripTitle, useDocumentTitle } from '../lib/useDocumentTitle';
import { useTripState } from '../lib/useTripState';

export function TripPage() {
  return <RequireAccount>{(token) => <Trip token={token} />}</RequireAccount>;
}

function Trip({ token }: { token: string }) {
  const { code = '' } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const { logout, sessionExpired } = useAuth();
  const { state, error, reload } = useTripState(token, code);
  const [busyLegId, setBusyLegId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const maps = useMapsPreference();
  const [mapsOpen, setMapsOpen] = useState(false);
  const closeMaps = useCallback(() => setMapsOpen(false), []);
  useDocumentTitle(tripTitle(state?.trip.name));

  if (error?.code === 'unauthenticated') {
    sessionExpired();
    return null;
  }
  // Pas encore dans ce voyage : le lien d'invitation y ajoute le compte.
  if (error?.code === 'forbidden') return <Navigate to={`/j/${code}`} replace />;
  if (error?.code === 'not_found') return <NotFoundPage />;
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
  const myDirections = bookedDirections(state.cars, state.me.id);
  const carHref = myCar ? `/t/${code}/voiture/${myCar.id}` : `/t/${code}/voiture`;

  async function act(leg: Leg, action: 'take' | 'leave') {
    setBusyLegId(leg.id);
    try {
      if (action === 'take') await api.takeSeat(token, code, leg.id);
      else await api.leaveSeat(token, code, leg.id);
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

  // Réservé à l'organisateur, après confirmation.
  async function deleteTrip() {
    if (!state || !window.confirm(`Êtes-vous sûr de bien vouloir supprimer le voyage « ${state.trip.name} » ?`)) return;
    try {
      await api.deleteTrip(token, code);
      navigate('/');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  }

  // Itinéraire : l'appli mémorisée directement, sinon le choix de l'appli.
  function openRoute() {
    const destination = state?.trip.destination;
    if (!destination) return;
    if (!maps.preference) {
      setMapsOpen(true);
      return;
    }
    const url = routeUrl(maps.preference, destination);
    if (maps.preference === 'other') window.location.href = url;
    else window.open(url, '_blank', 'noreferrer');
  }
  function chooseMaps(app: MapsAppId, remember: boolean) {
    if (remember) maps.save(app);
    setMapsOpen(false);
  }

  // Déconnexion, puis connexion (éventuellement avec un autre compte) sur ce voyage.
  async function switchPerson() {
    await logout();
    navigate(`/j/${code}`);
  }

  return (
    <>
      <TripHeader trip={state.trip} onShare={shareLink} onRoute={openRoute} />
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
              myDirections={myDirections}
              iDrive={!!myCar}
              onTake={(leg) => act(leg, 'take')}
              onLeave={(leg) => act(leg, 'leave')}
            />
          ))
        )}
        {!myCar &&
          (myDirections.size > 0 ? (
            // Un passager ne peut pas aussi conduire : il libère d'abord ses places.
            <div className="add-car-locked">
              <button type="button" className="btn btn--tertiary" disabled aria-describedby="add-car-hint">
                Ajouter ma voiture
              </button>
              <p id="add-car-hint" className="body-medium">
                Vous avez une place de passager : libérez-la pour ajouter votre voiture.
              </p>
            </div>
          ) : (
            // Aucune voiture encore : l'ajout est l'action principale de l'écran.
            <Link className={state.cars.length === 0 ? 'btn btn--primary' : 'btn btn--tertiary'} to={carHref}>
              Ajouter ma voiture
            </Link>
          ))}
        {state.me.isOrganizer && (
          <button type="button" className="btn btn--danger" onClick={deleteTrip}>
            Supprimer ce voyage
          </button>
        )}
      </main>
      <footer className="trip-footer body-medium">
        <span>Connecté·e en tant que {state.me.name}</span>
        <span>
          <button type="button" className="link-btn" onClick={switchPerson}>
            Déconnexion
          </button>
          {' · '}
          <Link to="/">Mes voyages</Link>
        </span>
        {maps.app && (
          <span>
            Itinéraire avec {maps.app.name}
            {' · '}
            <button type="button" className="link-btn" onClick={() => maps.save(null)}>
              Changer d'appli
            </button>
          </span>
        )}
      </footer>
      {mapsOpen && state.trip.destination && (
        <MapsSheet address={state.trip.destination} onChoose={chooseMaps} onClose={closeMaps} />
      )}
      {toast && <Toast message={toast} onDone={hideToast} />}
    </>
  );
}
