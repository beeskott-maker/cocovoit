import { useCallback, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { Toast } from '../components/Toast';
import { inviteUrl } from '../lib/format';
import { getSession } from '../lib/session';

/** Partage du lien unique d'invitation. */
export function InvitePage() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const session = getSession(code);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  if (!session) return <Navigate to={`/j/${code}`} replace />;

  const url = inviteUrl(code);
  const text = `Rejoins « ${session.tripName} » sur Cocovoit pour t'organiser en covoiturage :`;

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
      await navigator.share({ title: session!.tripName, text, url });
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
          Envoyez ce lien aux participants de <strong>{session.tripName}</strong>. Ils indiqueront leur email et leur nom,
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
