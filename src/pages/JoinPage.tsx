import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { IdentityForm } from '../components/IdentityForm';
import { useApi } from '../lib/api';
import { getIdentity, saveIdentity } from '../lib/identity';
import { getSession, saveSession } from '../lib/session';
import { ApiError, type TripPreview } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

/**
 * Lien d'invitation d'un voyage.
 * - Personne déjà identifiée dans ce navigateur : ajoutée automatiquement au voyage.
 * - Sinon : email, puis nom si on ne la connaît pas encore ; l'identité est mémorisée.
 */
export function JoinPage() {
  const { code = '' } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripPreview | null | undefined>(undefined);
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null);
  const [identity] = useState(getIdentity);
  const hasSession = getSession(code) !== null;
  const autoJoinStarted = useRef(false);

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

  // Ajout automatique avec l'identité mémorisée.
  useEffect(() => {
    if (hasSession || !identity || !trip || autoJoinStarted.current) return;
    autoJoinStarted.current = true;
    api.joinTrip(code, identity.email, identity.name).then(
      (res) => {
        if (res.status !== 'ok') return;
        saveSession({ code, secret: res.secret, name: res.name, tripName: trip.name });
        navigate(`/t/${code}`, { replace: true });
      },
      (err) => setAutoJoinError(err instanceof ApiError ? err.message : 'Connexion impossible, réessayez.'),
    );
  }, [api, code, identity, navigate, hasSession, trip]);

  if (hasSession) return <Navigate to={`/t/${code}`} replace />;
  if (trip === null) return <NotFoundPage />;
  if (identity) {
    return autoJoinError ? (
      <p className="banner banner--error" role="alert">
        {autoJoinError}
      </p>
    ) : (
      <p className="loading">Ouverture du voyage…</p>
    );
  }

  function enter(secret: string, email: string, name: string) {
    saveSession({ code, secret, name, tripName: trip!.name });
    saveIdentity({ email, name });
    navigate(`/t/${code}`, { replace: true });
  }

  return (
    <IdentityForm
      title={
        <>
          Rejoindre
          <br />
          {trip?.name ?? '…'}
        </>
      }
      disabled={!trip}
      onEmail={async (email) => {
        const res = await api.joinTrip(code, email);
        if (res.status === 'needs_name') return 'needs_name';
        enter(res.secret, email, res.name);
        return 'done';
      }}
      onName={async (email, name) => {
        const res = await api.joinTrip(code, email, name);
        if (res.status === 'ok') enter(res.secret, email, res.name);
      }}
    />
  );
}
