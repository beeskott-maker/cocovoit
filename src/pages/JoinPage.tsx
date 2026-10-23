import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import mail from '../assets/figma/mail.svg';
import person from '../assets/figma/person.svg';
import { BrandHeader } from '../components/BrandHeader';
import { TextField } from '../components/TextField';
import { useApi } from '../lib/api';
import { isEmail } from '../lib/format';
import { getSession, saveSession } from '../lib/session';
import type { TripPreview } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';



/** Parcours de l'invité : email, puis nom si on ne le connaît pas encore. */
export function JoinPage() {
  const { code = '' } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripPreview | null | undefined>(undefined);
  const [step, setStep] = useState<'email' | 'name'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getTripPreview(code).then(
      (t) => alive && setTrip(t),
      () => alive && setTrip(null),
    );
    return () => {
      alive = false;
    };
  }, [api, code]);

  if (getSession(code)) return <Navigate to={`/t/${code}`} replace />;
  if (trip === null) return <NotFoundPage />;

  const canSubmit = step === 'email' ? isEmail(email) : name.trim().length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !trip) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.joinTrip(code, email, step === 'name' ? name : undefined);
      if (res.status === 'needs_name') {
        setStep('name');
      } else {
        saveSession({ code, secret: res.secret, name: res.name, tripName: trip.name });
        navigate(`/t/${code}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BrandHeader />
      <div className="page-title">
        <h1 className="display-small">
          Rejoindre
          <br />
          {trip?.name ?? '…'}
        </h1>
      </div>
      <form className="form" onSubmit={submit} noValidate>
        <TextField
          label="Mon email"
          icon={mail}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={step === 'name' || !trip}
          autoFocus
        />
        {step === 'name' && (
          <TextField
            label="Mon nom"
            icon={person}
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Le prénom que les autres verront dans les voitures"
            maxLength={80}
            autoFocus
          />
        )}
        {error && (
          <p className="field-hint field-hint--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={!canSubmit || busy}>
          Suivant
        </button>
        {step === 'name' && (
          <button type="button" className="btn btn--text" onClick={() => setStep('email')}>
            Ce n'est pas mon email
          </button>
        )}
      </form>
    </>
  );
}
