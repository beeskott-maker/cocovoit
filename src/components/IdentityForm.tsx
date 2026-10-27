import { useState, type FormEvent, type ReactNode } from 'react';
import mail from '../assets/figma/mail.svg';
import person from '../assets/figma/person.svg';
import phoneIcon from '../assets/figma/phone.svg';
import { isEmail } from '../lib/format';
import { parsePhone } from '../lib/phone';
import { AUTH_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';
import { BrandHeader } from './BrandHeader';
import { TextField } from './TextField';

interface Props {
  title: ReactNode;
  intro?: string;
  /** Formulaire inactif (ex. voyage en cours de chargement). */
  disabled?: boolean;
  /** Après l'email : « done » si la personne est reconnue, sinon on demande son nom. */
  onEmail: (email: string) => Promise<'done' | 'needs_name'>;
  onName: (email: string, name: string, phone: string | null) => Promise<void>;
}

/** Identification en deux temps (maquette « Rejoindre ») : email, puis nom (et téléphone facultatif) si besoin. */
export function IdentityForm({ title, intro, disabled, onEmail, onName }: Props) {
  useDocumentTitle(AUTH_TITLE);
  const [step, setStep] = useState<'email' | 'name'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !disabled && (step === 'email' ? isEmail(email) : name.trim().length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (step === 'email') {
        if ((await onEmail(email.trim())) === 'needs_name') setStep('name');
      } else {
        const parsed = parsePhone(phone);
        if (parsed === undefined) {
          setPhoneError('Numéro invalide : par exemple 06 12 34 56 78');
          return;
        }
        await onName(email.trim(), name.trim(), parsed);
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
        <h1 className="display-small">{title}</h1>
        {intro && <p className="body-medium">{intro}</p>}
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
          disabled={step === 'name' || disabled}
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
        {step === 'name' && (
          <TextField
            label="Mon téléphone (facultatif)"
            icon={phoneIcon}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError(null);
            }}
            error={phoneError}
            hint="Pour vous joindre le jour du départ : visible par votre chauffeur si vous êtes passager, par le voyage si vous conduisez."
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
