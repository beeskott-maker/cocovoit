import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import pin from '../assets/figma/pin-dark.svg';
import { BrandHeader } from '../components/BrandHeader';
import { RequireAccount } from '../components/RequireAccount';
import { TextField } from '../components/TextField';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatTripDates } from '../lib/format';
import { APP_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';
import { ApiError, type MyTrip } from '../lib/types';

/**
 * Accueil : créer un voyage (organisateur) et retrouver ses voyages.
 * Réservé aux personnes connectées ; l'organisateur est le compte connecté.
 */
export function HomePage() {
  return <RequireAccount>{(token) => <Home token={token} />}</RequireAccount>;
}

function roles(trip: MyTrip): string {
  const list = [trip.isDriver && 'conducteur', trip.isPassenger && 'passager'];
  const text = list.filter(Boolean).join(' · ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function Home({ token }: { token: string }) {
  useDocumentTitle(`${APP_TITLE} · Mes voyages`);
  const api = useApi();
  const navigate = useNavigate();
  const { sessionExpired } = useAuth();
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
  // Le formulaire s'ouvre sur « Nouveau voyage », ou d'emblée s'il n'y a aucun voyage.
  const [creating, setCreating] = useState(false);
  const showForm = creating || (myTrips !== null && myTrips.length === 0);
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
          <ul className="trip-list">
            {myTrips.map((t) => (
              <li key={t.code}>
                <Link to={`/t/${t.code}`}>
                  <span className="trip-list__text">
                    {t.name}
                    <span className="trip-list__dates">{formatTripDates(t.startsOn, t.endsOn)}</span>
                    {roles(t) && <span className="trip-list__roles">{roles(t)}</span>}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
          {!showForm && (
            <button type="button" className="btn btn--tonal" onClick={() => setCreating(true)}>
              Nouveau voyage
            </button>
          )}
        </section>
      )}
      {showForm && (
        // Dépliement animé seulement quand on ouvre via « Nouveau voyage ».
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
    </>
  );
}
