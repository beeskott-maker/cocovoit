import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import armchair from '../assets/figma/armchair.svg';
import pin from '../assets/figma/pin-dark.svg';
import { BrandHeader } from '../components/BrandHeader';
import { RequireAccount } from '../components/RequireAccount';
import { TextField } from '../components/TextField';
import { useApi } from '../lib/api';
import { toDateTimeLocal } from '../lib/format';
import { useAuth } from '../lib/auth';
import type { Direction, LegInput, TripState } from '../lib/types';
import { useTripState } from '../lib/useTripState';

interface LegForm {
  enabled: boolean;
  departsAt: string;
  meetingPoint: string;
}

const MAX_SEATS = 8;

function initialForm(state: TripState, carId: string | undefined) {
  const car = state.cars.find((c) => c.id === carId);
  const leg = (direction: Direction, fallback: string): LegForm => {
    const existing = car?.legs.find((l) => l.direction === direction);
    return existing
      ? { enabled: true, departsAt: toDateTimeLocal(existing.departsAt), meetingPoint: existing.meetingPoint ?? '' }
      : { enabled: !car, departsAt: fallback, meetingPoint: '' };
  };
  return {
    seats: car?.seats ?? 3,
    aller: leg('aller', `${state.trip.startsOn}T09:00`),
    retour: leg('retour', `${state.trip.endsOn}T17:00`),
  };
}

/** Ajouter ou modifier sa voiture : places et trajets aller / retour. */
export function CarFormPage() {
  return <RequireAccount>{(token) => <CarFormLoader token={token} />}</RequireAccount>;
}

function CarFormLoader({ token }: { token: string }) {
  const { code = '', carId } = useParams();
  const { sessionExpired } = useAuth();
  const { state, error } = useTripState(token, code);
  if (error?.code === 'unauthenticated') {
    sessionExpired();
    return null;
  }
  if (error?.code === 'forbidden' || error?.code === 'not_found') return <Navigate to={`/j/${code}`} replace />;
  if (!state) return <p className="loading">Chargement…</p>;
  const car = state.cars.find((c) => c.id === carId);
  if (carId && (!car || car.driver.id !== state.me.id)) return <Navigate to={`/t/${code}`} replace />;
  // Garde-fou : une seule voiture par personne.
  const mine = state.cars.find((c) => c.driver.id === state.me.id);
  if (!carId && mine) return <Navigate to={`/t/${code}/voiture/${mine.id}`} replace />;
  return <CarForm code={code} token={token} state={state} carId={carId} />;
}

function CarForm({ code, token, state, carId }: { code: string; token: string; state: TripState; carId?: string }) {
  const api = useApi();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => initialForm(state, carId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [form]);

  const legs: LegInput[] = (['aller', 'retour'] as const)
    .filter((d) => form[d].enabled)
    .map((d) => ({
      direction: d,
      departsAt: new Date(form[d].departsAt).toISOString(),
      // Le retour part du lieu du voyage : pas de point de RDV.
      meetingPoint: d === 'aller' ? form[d].meetingPoint.trim() || null : null,
    }));
  const valid = legs.length > 0 && (['aller', 'retour'] as const).every((d) => !form[d].enabled || form[d].departsAt);

  const setLeg = (d: Direction, patch: Partial<LegForm>) => setForm((f) => ({ ...f, [d]: { ...f[d], ...patch } }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await api.saveCar(token, code, { carId: carId ?? null, seats: form.seats, legs });
      navigate(`/t/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setBusy(false);
    }
  }

  async function remove() {
    if (!carId || !window.confirm('Supprimer votre voiture ? Les passagers perdront leur place.')) return;
    setBusy(true);
    try {
      await api.deleteCar(token, code, carId);
      navigate(`/t/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setBusy(false);
    }
  }

  return (
    <>
      <BrandHeader />
      <div className="page-title">
        <h1 className="display-small">{carId ? 'Ma voiture' : 'Ajouter ma voiture'}</h1>
        <p className="body-medium">{state.trip.name}</p>
      </div>
      <form className="form form--compact" onSubmit={submit} noValidate>
        <div className="stepper">
          <div>
            <p className="body-large" id="seats-label">
              Places passagers
            </p>
            <p className="body-medium">Sans compter le conducteur</p>
          </div>
          <div className="stepper__controls" role="group" aria-labelledby="seats-label">
            <button
              type="button"
              className="stepper__btn"
              aria-label="Une place de moins"
              disabled={form.seats <= 1}
              onClick={() => setForm((f) => ({ ...f, seats: f.seats - 1 }))}
            >
              −
            </button>
            <span className="stepper__value" aria-live="polite">
              <img src={armchair} alt="" width={24} height={24} />
              {form.seats}
            </span>
            <button
              type="button"
              className="stepper__btn"
              aria-label="Une place de plus"
              disabled={form.seats >= MAX_SEATS}
              onClick={() => setForm((f) => ({ ...f, seats: f.seats + 1 }))}
            >
              +
            </button>
          </div>
        </div>

        {(['aller', 'retour'] as const).map((d) => (
          <fieldset key={d} className={form[d].enabled ? 'leg-fieldset' : 'leg-fieldset leg-fieldset--off'}>
            <label className="switch">
              <span className="body-large">{d === 'aller' ? "Je fais l'aller" : 'Je fais le retour'}</span>
              <input type="checkbox" checked={form[d].enabled} onChange={(e) => setLeg(d, { enabled: e.target.checked })} />
            </label>
            {form[d].enabled && (
              <>
                <TextField
                  label="Départ"
                  type="datetime-local"
                  value={form[d].departsAt}
                  onChange={(e) => setLeg(d, { departsAt: e.target.value })}
                />
                {d === 'aller' && (
                  <TextField
                    label="Point de RDV"
                    icon={pin}
                    placeholder="Ex. Gare Part-Dieu, Lyon"
                    value={form[d].meetingPoint}
                    onChange={(e) => setLeg(d, { meetingPoint: e.target.value })}
                    maxLength={300}
                  />
                )}
              </>
            )}
          </fieldset>
        ))}
        {legs.length === 0 && <p className="field-hint">Choisissez au moins un trajet.</p>}
        {error && (
          <p className="field-hint field-hint--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={!valid || busy}>
          {carId ? 'Enregistrer' : 'Proposer ma voiture'}
        </button>
        {carId && (
          <button type="button" className="btn btn--danger" onClick={remove} disabled={busy}>
            Supprimer ma voiture
          </button>
        )}
        <Link className="btn btn--text" to={`/t/${code}`}>
          Annuler
        </Link>
      </form>
    </>
  );
}
