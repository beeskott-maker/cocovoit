import { useEffect, useState } from 'react';
import { useApi } from '../lib/api';
import { ApiError, type AccountDeletionPreview } from '../lib/types';
import { ConfirmDialog } from './ConfirmDialog';
import { TextField } from './TextField';

interface Props {
  token: string;
  email: string;
  /** Après la suppression : déconnexion et retour à l'accueil. */
  onDeleted: () => void;
  onCancel: () => void;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const names = (list: string[]) =>
  list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;

/** Suppression du compte : ce qui va changer, puis confirmation en retapant son email. */
export function DeleteAccountDialog({ token, email, onDeleted, onCancel }: Props) {
  const api = useApi();
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.accountDeletionPreview(token).then(
      (p) => alive && setPreview(p),
      () => alive && setPreview({ transferred: [], deletedTrips: [], cars: [], seats: [] }),
    );
    return () => {
      alive = false;
    };
  }, [api, token]);

  async function confirm() {
    setError(null);
    try {
      await api.deleteAccount(token, typed);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue, réessayez.');
    }
  }

  const items = preview
    ? [
        ...preview.transferred.map((t) => ({
          kind: 'pass',
          tag: 'Transmis',
          text: (
            <>
              <strong>{t.trip}</strong> : {t.to} devient l'organisateur.
            </>
          ),
        })),
        ...preview.deletedTrips.map((trip) => ({
          kind: 'del',
          tag: 'Supprimé',
          text: (
            <>
              <strong>{trip}</strong> : vous étiez seul·e dans ce voyage.
            </>
          ),
        })),
        ...preview.cars.map((c) => ({
          kind: 'del',
          tag: 'Supprimé',
          text: (
            <>
              <strong>Ma voiture</strong> ({c.trip})
              {c.passengers.length > 0 &&
                ` : ${names(c.passengers)} ${c.passengers.length > 1 ? 'perdent leur' : 'perd sa'} place`}
              .
            </>
          ),
        })),
        ...preview.seats.map((s) => ({
          kind: 'free',
          tag: 'Libérée',
          text: (
            <>
              Votre place dans la <strong>voiture de {s.driver}</strong> ({s.trip}).
            </>
          ),
        })),
      ]
    : [];

  return (
    <ConfirmDialog
      title="Supprimer votre compte ?"
      icon="person"
      confirmDisabled={!preview || !same(typed, email)}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <p>Votre email, votre nom et votre numéro seront effacés. Cette action est irréversible.</p>
      {preview === null ? (
        <p>Chargement…</p>
      ) : (
        items.length > 0 && (
          <ul className="confirm__list deletion-list">
            {items.map((item, i) => (
              <li key={i}>
                <span className={`deletion-tag deletion-tag--${item.kind}`}>{item.tag}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )
      )}
      <TextField
        label="Retapez votre email pour confirmer"
        type="email"
        autoComplete="off"
        inputMode="email"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        error={error}
      />
    </ConfirmDialog>
  );
}
