import { useEffect, useId, useState, type FormEvent } from 'react';
import phoneIcon from '../assets/figma/phone.svg';
import { formatPhone, parsePhone } from '../lib/phone';
import { CallIcon } from './PhoneIcons';
import { TextField } from './TextField';

interface Props {
  /** Numéro actuel (format international), null si aucun. */
  phone: string | null;
  /** Je conduis : mon numéro est visible par tout le voyage. Sinon, par mon chauffeur. */
  driver: boolean;
  /** Enregistre le numéro (null : le retire). */
  onSave: (phone: string | null) => Promise<void>;
  onClose: () => void;
}

/** Pop-in d'ajout ou de modification de son numéro de téléphone. */
export function PhoneDialog({ phone, driver, onSave, onClose }: Props) {
  const titleId = useId();
  const [value, setValue] = useState(phone ? formatPhone(phone) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parsePhone(value);
    if (parsed === undefined) {
      setError('Numéro invalide : par exemple 06 12 34 56 78');
      return;
    }
    setBusy(true);
    try {
      await onSave(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setBusy(false);
    }
  }

  return (
    <div className="confirm-layer">
      <div className="sheet-scrim" onClick={() => !busy && onClose()} aria-hidden="true" />
      <form className="confirm" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} noValidate>
        <div className="confirm__icon confirm__icon--phone" aria-hidden="true">
          <CallIcon size={24} />
        </div>
        <h2 id={titleId} className="confirm__title">
          Mon numéro de téléphone
        </h2>
        <div className="confirm__text">
          <p>
            {driver
              ? 'Visible par les participants du voyage, puisque vous conduisez : ils pourront vous appeler ou vous écrire.'
              : 'Visible par votre chauffeur seulement, pour qu’il puisse vous joindre le jour du départ.'}
          </p>
        </div>
        <TextField
          label="Mon téléphone"
          icon={phoneIcon}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          error={error}
          hint={phone ? 'Videz le champ pour retirer votre numéro.' : undefined}
          autoFocus
        />
        <div className="confirm__actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            {phone ? 'Annuler' : 'Plus tard'}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
