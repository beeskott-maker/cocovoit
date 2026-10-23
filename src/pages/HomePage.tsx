import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mail from '../assets/figma/mail.svg';
import person from '../assets/figma/person.svg';
import pin from '../assets/figma/pin-dark.svg';
import { BrandHeader } from '../components/BrandHeader';
import { TextField } from '../components/TextField';
import { useApi } from '../lib/api';
import { isEmail } from '../lib/format';
import { listSessions, saveSession } from '../lib/session';

/** Accueil : créer un voyage (organisateur) et retrouver ses voyages. */
export function HomePage() {
  const api = useApi();
  const navigate = useNavigate();
  const sessions = listSessions();
  const [form, setForm] = useState({
    name: '',
    destination: '',
    startsOn: '',
    endsOn: '',
    organizerName: '',
    organizerEmail: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const datesError = form.startsOn && form.endsOn && form.endsOn < form.startsOn ? 'Le retour est avant le départ' : null;
  const emailError = form.organizerEmail.trim() && !isEmail(form.organizerEmail) ? 'Adresse email invalide' : null;
  // Obligatoires : nom du voyage et dates. Le reste est facultatif.
  const valid = form.name.trim() && form.startsOn && form.endsOn && !datesError && !emailError;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const { code, secret } = await api.createTrip(form);
      saveSession({ code, secret, name: form.organizerName.trim() || 'Organisateur', tripName: form.name.trim() });
      navigate(`/t/${code}/inviter?nouveau=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setBusy(false);
    }
  }

  return (
    <>
      <BrandHeader />
      {sessions.length > 0 && (
        <section className="section" aria-labelledby="my-trips">
          <h2 id="my-trips" className="title-large">
            Mes voyages
          </h2>
          <ul className="trip-list">
            {sessions.map((s) => (
              <li key={s.code}>
                <Link to={`/t/${s.code}`}>
                  {s.tripName}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="page-title">
        <h1 className="display-small">
          Organiser
          <br />
          un voyage
        </h1>
        <p className="body-medium">Créez le voyage puis partagez le lien : chacun propose sa voiture ou réserve une place.</p>
      </div>
      <form className="form form--compact" onSubmit={submit} noValidate>
        <TextField label="Nom du voyage" required placeholder="WE dans le Beaujolais" value={form.name} onChange={set('name')} maxLength={120} />
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
        <TextField label="Mon nom" icon={person} autoComplete="given-name" value={form.organizerName} onChange={set('organizerName')} maxLength={80} />
        <TextField
          label="Mon email"
          icon={mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.organizerEmail}
          onChange={set('organizerEmail')}
          error={emailError}
          hint="Pour retrouver le voyage depuis un autre appareil"
        />
        {error && (
          <p className="field-hint field-hint--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={!valid || busy}>
          Créer le voyage
        </button>
      </form>
    </>
  );
}
