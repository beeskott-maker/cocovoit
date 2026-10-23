import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { Toast } from '../components/Toast';
import { useApi } from '../lib/api';
import { inviteUrl } from '../lib/format';
import type { TripPreview } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

/** Partage du lien unique d'invitation. */
export function InvitePage() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const api = useApi();
  const [trip, setTrip] = useState<TripPreview | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
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
  if (trip === null) return <NotFoundPage />;
  if (!trip) return <p className="loading">Chargement…</p>;

  const url = inviteUrl(code);
  const text = `Rejoins « ${trip.name} » sur Cocovoit pour t'organiser en covoiturage :`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setToast('Lien copié');
    } catch {
      setToast('Copie impossible, sélectionnez le lien à la main');
    }
  }

  async function share() {
    try {
      await navigator.share({ title: trip!.name, text, url });
    } catch {
      // Partage annulé par l'utilisateur.
    }
  }

  return (
    <>
      <BrandHeader />
      <div className="page-title stack">
        <h1 className="display-small">{params.has('nouveau') ? 'Voyage créé !' : 'Inviter des proches'}</h1>
        <p className="body-large">
          Envoyez ce lien aux participants de <strong>{trip.name}</strong>. Ils indiqueront leur email et leur nom,
          puis pourront réserver une place ou proposer leur voiture.
        </p>
      </div>
      <div className="form form--compact">
        <div className="invite-link">
          <code>{url}</code>
        </div>
        <button type="button" className="btn btn--primary" onClick={copy}>
          Copier le lien
        </button>
        {typeof navigator.share === 'function' && (
          <button type="button" className="btn btn--outline" onClick={share}>
            Partager…
          </button>
        )}
        <Link className="btn btn--tertiary" to={`/t/${code}`}>
          Voir le voyage
        </Link>
      </div>
      {toast && <Toast message={toast} onDone={hideToast} />}
    </>
  );
}
