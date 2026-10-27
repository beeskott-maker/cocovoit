import { useCallback, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import carIcon from '../assets/figma/car.svg';
import { BookedDialog } from '../components/BookedDialog';
import { CarCard } from '../components/CarCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MapsSheet } from '../components/MapsSheet';
import { PhoneDialog } from '../components/PhoneDialog';
import { CallIcon } from '../components/PhoneIcons';
import { RequireAccount } from '../components/RequireAccount';
import { Toast } from '../components/Toast';
import { TripHeader } from '../components/TripHeader';
import { useApi } from '../lib/api';
import { storageKey } from '../lib/env';
import { inviteUrl } from '../lib/format';
import { useAuth } from '../lib/auth';
import { bookedDirections, keepOrder, sortCars } from '../lib/seats';
import type { Leg } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';
import { tripTitle, useDocumentTitle } from '../lib/useDocumentTitle';
import { useTripState } from '../lib/useTripState';

/** Délai avant la pop-in « C'est tout bon » (ms). */
const BOOKED_DELAY = 300;

// « Plus tard » sur l'invitation à donner son numéro : mémorisé dans ce navigateur.
const PHONE_LATER = storageKey('phone-later');
function phoneLater(): boolean {
  try {
    return localStorage.getItem(PHONE_LATER) === '1';
  } catch {
    return false;
  }
}
function setPhoneLater() {
  try {
    localStorage.setItem(PHONE_LATER, '1');
  } catch {
    // Stockage indisponible : l'invitation reviendra au prochain chargement.
  }
}

export function TripPage() {
  return <RequireAccount>{(token) => <Trip token={token} />}</RequireAccount>;
}

function Trip({ token }: { token: string }) {
  const { code = '' } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
  const { state, error, reload } = useTripState(token, code);
  const [busyLegId, setBusyLegId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const [mapsOpen, setMapsOpen] = useState(false);
  const closeMaps = useCallback(() => setMapsOpen(false), []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bookedBoth, setBookedBoth] = useState(false);
  const closeBooked = useCallback(() => setBookedBoth(false), []);
  const carOrder = useRef<string[] | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const closePhone = useCallback(() => setPhoneOpen(false), []);
  const [askPhoneLater, setAskPhoneLater] = useState(phoneLater);
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

  // Ordre calculé à l'arrivée sur la page, puis figé : une voiture ne saute pas
  // ailleurs juste après qu'on y a pris ou libéré une place.
  carOrder.current ??= sortCars(state.cars, state.me.id).map((c) => c.id);
  const cars = keepOrder(state.cars, carOrder.current);
  const myCar = state.cars.find((c) => c.driver.id === state.me.id);
  const myDirections = bookedDirections(state.cars, state.me.id);
  const carHref = myCar ? `/t/${code}/voiture/${myCar.id}` : `/t/${code}/voiture`;
  // Invitation à donner son numéro : seulement si on conduit ou qu'on a une place.
  const askPhone = !state.me.phone && !askPhoneLater && (!!myCar || myDirections.size > 0);

  async function act(leg: Leg, action: 'take' | 'leave') {
    setBusyLegId(leg.id);
    let both = false;
    try {
      if (action === 'take') await api.takeSeat(token, code, leg.id);
      else await api.leaveSeat(token, code, leg.id);
      const other = leg.direction === 'aller' ? 'retour' : 'aller';
      // Place prise dans le seul sens qui manquait : récapitulatif aller + retour.
      if (action === 'take' && myDirections.has(other)) both = true;
      else setToast(action === 'take' ? `Place réservée pour ${leg.direction === 'aller' ? "l'aller" : 'le retour'}` : 'Place libérée');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setBusyLegId(null);
      await reload();
      // Après le rechargement, et un court instant plus tard : on voit d'abord
      // « Prendre 1 place » devenir « Libérer ma place ».
      if (both) setTimeout(() => setBookedBoth(true), BOOKED_DELAY);
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
    try {
      await api.deleteTrip(token, code);
      navigate('/');
    } catch (err) {
      setConfirmDelete(false);
      setToast(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  }

  async function savePhone(phone: string | null) {
    await api.setPhone(token, phone);
    setPhoneOpen(false);
    await reload();
    setToast(phone ? 'Numéro enregistré' : 'Numéro retiré');
  }

  function later() {
    setPhoneLater();
    setAskPhoneLater(true);
    setPhoneOpen(false);
  }

  // Déconnexion, fermée par le lien d'invitation (connexion éventuellement avec un autre compte).
  function switchPerson() {
    navigate(`/j/${code}`, { state: { logout: true } });
  }

  return (
    <>
      <TripHeader trip={state.trip} onShare={shareLink} onRoute={() => setMapsOpen(true)} />
      {api.mode === 'demo' && (
        <p className="banner">
          Mode démo : les données restent dans ce navigateur. Configurez Supabase pour partager le voyage.
        </p>
      )}
      <main className="trip-body">
        {askPhone && (
          <section className="ask-phone" aria-label="Ajoutez votre numéro">
            <span className="ask-phone__icon" aria-hidden="true">
              <CallIcon size={20} />
            </span>
            <div className="ask-phone__body">
              <p>
                <strong>Ajoutez votre numéro</strong>
                <br />
                {myCar
                  ? 'Vos passagers pourront vous appeler ou vous écrire le jour du départ.'
                  : 'Votre chauffeur pourra vous appeler ou vous écrire le jour du départ.'}
              </p>
              <div className="ask-phone__actions">
                <button type="button" className="btn btn--text" onClick={later}>
                  Plus tard
                </button>
                <button type="button" className="btn btn--primary" onClick={() => setPhoneOpen(true)}>
                  Ajouter
                </button>
              </div>
            </div>
          </section>
        )}
        {state.cars.length === 0 ? (
          <div className="empty">
            <img src={carIcon} alt="" />
            <p className="body-large">Personne n'a encore proposé de voiture.</p>
            <p className="body-medium">Vous conduisez ? Ajoutez votre voiture pour que les autres réservent une place.</p>
          </div>
        ) : (
          cars.map((car) => (
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
              tripName={state.trip.name}
              tripUrl={inviteUrl(code)}
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
          <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
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
          <button type="button" className="link-btn" onClick={() => setPhoneOpen(true)}>
            Mon numéro
          </button>
          {' · '}
          <Link to="/">Mes voyages</Link>
        </span>
      </footer>
      {bookedBoth && <BookedDialog state={state} tripUrl={inviteUrl(code)} onClose={closeBooked} />}
      {confirmDelete && (
        <ConfirmDialog title="Supprimer le voyage ?" onConfirm={deleteTrip} onCancel={() => setConfirmDelete(false)}>
          <p>
            Le voyage <strong>« {state.trip.name} »</strong> sera supprimé pour tous les participants, avec ses voitures et ses places. Cette
            action est irréversible.
          </p>
        </ConfirmDialog>
      )}
      {phoneOpen && (
        <PhoneDialog
          phone={state.me.phone}
          driver={!!myCar}
          onSave={savePhone}
          onClose={state.me.phone ? closePhone : later}
        />
      )}
      {mapsOpen && state.trip.destination && (
        <MapsSheet address={state.trip.destination} onClose={closeMaps} />
      )}
      {toast && <Toast message={toast} onDone={hideToast} />}
    </>
  );
}
