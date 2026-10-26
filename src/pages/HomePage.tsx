import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import pin from '../assets/figma/pin-dark.svg';
import { BrandHeader } from '../components/BrandHeader';
import { RequireAccount } from '../components/RequireAccount';
import { TextField } from '../components/TextField';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatTripDates, localToday, tripTiming } from '../lib/format';
import { APP_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';
import { ApiError, type MyTrip } from '../lib/types';

/**
 * Accueil : créer un voyage (organisateur) et retrouver ses voyages.
 * Réservé aux personnes connectées ; l'organisateur est le compte connecté.
 */
export function HomePage() {
  return <RequireAccount>{(token) => <Home token={token} />}</RequireAccount>;
}

// Un seul rôle affiché : organisateur, sinon conducteur, sinon passager.
function role(trip: MyTrip): string {
  if (trip.isOrganizer) return 'Organisateur';
  return trip.isDriver ? 'Conducteur' : 'Passager';
}

function TripItem({ trip, badge }: { trip: MyTrip; badge?: string }) {
  return (
    <li>
      <Link to={`/t/${trip.code}`}>
        <span className="trip-list__text">
          {trip.name}
          <span className="trip-list__dates">{formatTripDates(trip.startsOn, trip.endsOn)}</span>
          <span className="trip-list__roles">{role(trip)}</span>
          {badge && <span className="trip-badge">{badge}</span>}
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    </li>
  );
}

function Home({ token }: { token: string }) {
  useDocumentTitle(`${APP_TITLE} · Mes voyages`);
  const api = useApi();
  const navigate = useNavigate();
  const { auth, logout, sessionExpired } = useAuth();
  // « Mes voyages » : les voyages du compte, lus en base.
  const [myTrips, setMyTrips] = useState<MyTrip[] | null>(null);
  useEffect(() => {
    let alive = true;
    api.myTrips(token).then(
      (trips) => alive && setMyTrips(trips),
      (err) => {
        if (!alive) return;
        if (err instanceof ApiError && err.code === 'unauthenticated') sessionExpired();
        else setMyTrips([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [api, token, sessionExpired]);
  const [form, setForm] = useState({
    name: '',
    destination: '',
    startsOn: '',
    endsOn: '',
  });
  // Le formulaire s'ouvre sur « Créer un voyage », ou d'emblée s'il n'y a aucun voyage.
  const [creating, setCreating] = useState(false);
  const showForm = creating || (myTrips !== null && myTrips.length === 0);
  // À venir (le plus proche d'abord) et passés (le plus récent d'abord).
  const today = localToday();
  const timed = (myTrips ?? []).map((trip) => ({ trip, timing: tripTiming(trip.startsOn, trip.endsOn, today) }));
  const upcoming = timed
    .filter((t) => t.timing.status !== 'past')
    .sort((a, b) => a.trip.startsOn.localeCompare(b.trip.startsOn) || a.trip.name.localeCompare(b.trip.name));
  const past = timed
    .filter((t) => t.timing.status === 'past')
    .sort((a, b) => b.trip.endsOn.localeCompare(a.trip.endsOn) || a.trip.name.localeCompare(b.trip.name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const datesError = form.startsOn && form.endsOn && form.endsOn < form.startsOn ? 'Le retour est avant le départ' : null;
  // Obligatoires : nom du voyage et dates. La destination est facultative.
  const valid = form.name.trim() && form.startsOn && form.endsOn && !datesError;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const code = await api.createTrip(token, form);
      navigate(`/t/${code}/inviter?nouveau=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setBusy(false);
    }
  }

  return (
    <>
      <BrandHeader />
      {myTrips && myTrips.length > 0 && (
        <section className="section" aria-labelledby="my-trips">
          <h2 id="my-trips" className="title-large">
            Mes voyages
          </h2>
          {upcoming.length > 0 && (
            <ul className="trip-list">
              {upcoming.map(({ trip, timing }) => (
                <TripItem key={trip.code} trip={trip} badge={timing.label} />
              ))}
            </ul>
          )}
          {!showForm && (
            <button type="button" className="btn btn--tonal" onClick={() => setCreating(true)}>
              Créer un voyage
            </button>
          )}
        </section>
      )}
      {showForm && (
        // Dépliement animé seulement quand on ouvre via « Créer un voyage ».
        <div className={creating ? 'new-trip new-trip--unfold' : 'new-trip'}>
          <div className="new-trip__inner">
            <div className="page-title">
              <h1 className="display-small">Créer un voyage</h1>
              <p className="body-medium">Créez le voyage puis partagez le lien : chacun propose sa voiture ou réserve une place.</p>
            </div>
            <form className="form form--compact" onSubmit={submit} noValidate>
              <TextField
                label="Nom du voyage"
                required
                placeholder="WE dans le Beaujolais"
                value={form.name}
                onChange={set('name')}
                maxLength={120}
              />
              <TextField
                label="Destination"
                icon={pin}
                placeholder="Adresse du lieu"
                autoComplete="street-address"
                value={form.destination}
                onChange={set('destination')}
                maxLength={300}
              />
              <div className="row">
                <TextField label="Départ le" required type="date" value={form.startsOn} onChange={set('startsOn')} />
                <TextField
                  label="Retour le"
                  required
                  type="date"
                  value={form.endsOn}
                  min={form.startsOn || undefined}
                  onChange={set('endsOn')}
                  error={datesError}
                />
              </div>
              {error && (
                <p className="field-hint field-hint--error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn--primary" disabled={!valid || busy}>
                Créer
              </button>
              {myTrips && myTrips.length > 0 && (
                <button type="button" className="btn btn--outline" onClick={() => setCreating(false)}>
                  Annuler
                </button>
              )}
            </form>
          </div>
        </div>
      )}
      {past.length > 0 && (
        <section className="section section--past" aria-labelledby="past-trips">
          <h2 id="past-trips" className="title-large">
            Passés
          </h2>
          <ul className="trip-list trip-list--past">
            {past.map(({ trip }) => (
              <TripItem key={trip.code} trip={trip} />
            ))}
          </ul>
        </section>
      )}
      {auth.status === 'connected' && (
        <footer className="trip-footer body-medium">
          <span>Connecté·e en tant que {auth.account.name}</span>
          <button type="button" className="link-btn" onClick={logout}>
            Déconnexion
          </button>
        </footer>
      )}
    </>
  );
}
