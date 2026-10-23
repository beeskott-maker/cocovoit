import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import mail from '../assets/figma/mail.svg';
import { BrandHeader } from '../components/BrandHeader';
import { TextField } from '../components/TextField';
import { Toast } from '../components/Toast';
import { useApi } from '../lib/api';
import { formatTripDates, isEmail } from '../lib/format';
import { ApiError, type AdminTrip } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

const createdFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
type LoadResult = 'ok' | 'unauthorized' | 'error';

// Adresse mémorisée dans ce navigateur pour ne pas la ressaisir.
const EMAIL_KEY = 'cocovoit:admin-email';
function readEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}
function writeEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  } catch {
    // Stockage indisponible : il faudra ressaisir l'adresse.
  }
}

/**
 * Liste de tous les voyages, avec ouverture et suppression.
 * Servie à l'URL #/x/<clé> : sans la bonne clé, on voit « Lien introuvable ».
 * Avec la bonne clé, il faut aussi saisir l'adresse email autorisée, vérifiée
 * par la base à chaque appel.
 */
export function TripsAdminPage() {
  const { key = '' } = useParams();
  const api = useApi();
  const [email, setEmail] = useState<string | null>(null);
  const [trips, setTrips] = useState<AdminTrip[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const load = useCallback(
    async (candidate: string): Promise<LoadResult> => {
      try {
        setTrips(await api.adminListTrips(key, candidate));
        setEmail(candidate);
        writeEmail(candidate);
        setError(null);
        return 'ok';
      } catch (err) {
        if (err instanceof ApiError && err.code === 'forbidden') {
          setForbidden(true);
          return 'error';
        }
        if (err instanceof ApiError && err.code === 'unauthorized_email') {
          setEmail(null);
          writeEmail(null);
          return 'unauthorized';
        }
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        return 'error';
      }
    },
    [api, key],
  );

  // Au chargement : la clé est vérifiée en premier (mauvaise clé → « Lien
  // introuvable »), puis l'adresse mémorisée si elle existe.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    void load(readEmail()).then(() => setChecked(true));
  }, [load]);

  if (forbidden) return <NotFoundPage />;
  if (!checked) return <p className="loading">Chargement…</p>;
  if (!email) return <EmailLogin onSubmit={load} />;

  async function remove(trip: AdminTrip) {
    const details = `${plural(trip.participants, 'participant')}, ${plural(trip.cars, 'voiture')}`;
    if (!window.confirm(`Supprimer « ${trip.name} » (${details}) ?\n\nToutes ses données seront effacées et son lien d'invitation ne marchera plus. Cette action est irréversible.`)) {
      return;
    }
    setBusyCode(trip.code);
    try {
      await api.adminDeleteTrip(key, email!, trip.code);
      setToast(`« ${trip.name} » supprimé`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setBusyCode(null);
      await load(email!);
    }
  }

  return (
    <>
      <BrandHeader />
      <div className="page-title">
        <h1 className="display-small">Voyages</h1>
        {trips && <p className="body-medium">{plural(trips.length, 'voyage')}</p>}
        <p className="body-medium">
          Connecté·e avec <strong>{email}</strong> ·{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              writeEmail(null);
              setEmail(null);
              setTrips(null);
            }}
          >
            Se déconnecter
          </button>
        </p>
      </div>
      <main className="admin-list">
        <Link className="btn btn--primary" to="/">
          Créer un voyage
        </Link>
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
              {trip.destination && <p className="body-medium">{trip.destination}</p>}
              <p className="body-medium">
                {plural(trip.participants, 'participant')} · {plural(trip.cars, 'voiture')} · créé le{' '}
                {createdFormat.format(new Date(trip.createdAt))}
              </p>
            </div>
            <div className="admin-trip__actions">
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => remove(trip)}
                disabled={busyCode === trip.code}
              >
                Supprimer
              </button>
              <Link className="btn btn--outline" to={`/j/${trip.code}`}>
                Ouvrir
              </Link>
            </div>
          </article>
        ))}
      </main>
      {toast && <Toast message={toast} onDone={hideToast} />}
    </>
  );
}

function EmailLogin({ onSubmit }: { onSubmit: (email: string) => Promise<LoadResult> }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isEmail(value)) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit(value.trim());
    if (result === 'unauthorized') {
      setError(`L'adresse ${value.trim()} n'est pas autorisée à accéder à cette page. Vérifiez qu'il s'agit de la bonne adresse.`);
    } else if (result === 'error') {
      setError('Vérification impossible pour le moment, réessayez.');
    }
    if (result !== 'ok') setBusy(false);
  }

  return (
    <>
      <BrandHeader />
      <div className="page-title">
        <h1 className="display-small">Accès réservé</h1>
        <p className="body-medium">Indiquez votre adresse email pour gérer les voyages.</p>
      </div>
      <form className="form" onSubmit={submit} noValidate>
        <TextField
          label="Mon email"
          icon={mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          error={error}
          autoFocus
        />
        <button type="submit" className="btn btn--primary" disabled={!isEmail(value) || busy}>
          Accéder
        </button>
      </form>
    </>
  );
}
