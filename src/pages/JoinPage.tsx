import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { IdentityForm } from '../components/IdentityForm';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ApiError, type TripPreview } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

/**
 * Lien d'invitation d'un voyage.
 * - Personne connectée : son compte rejoint le voyage, puis on l'ouvre.
 * - Sinon : connexion (email, puis nom pour un nouveau compte), puis idem.
 */
export function JoinPage() {
  const { code = '' } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, login, logout, sessionExpired } = useAuth();
  // « Déconnexion » depuis la page voyage : on ferme la session ici, une fois
  // sur le lien d'invitation, pour que la page voyage ne renvoie pas d'abord
  // vers l'identification.
  const switching = (location.state as { logout?: boolean } | null)?.logout === true;
  const [trip, setTrip] = useState<TripPreview | null | undefined>(undefined);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinStarted = useRef(false);

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

  useEffect(() => {
    if (!switching) return;
    void logout();
    navigate(location.pathname, { replace: true, state: null });
  }, [switching, logout, navigate, location.pathname]);

  useEffect(() => {
    if (switching || auth.status !== 'connected' || !trip || joinStarted.current) return;
    joinStarted.current = true;
    api.joinTrip(auth.token, code).then(
      () => navigate(`/t/${code}`, { replace: true }),
      (err) => {
        joinStarted.current = false;
        if (err instanceof ApiError && err.code === 'unauthenticated') sessionExpired();
        else setJoinError(err instanceof ApiError ? err.message : 'Connexion impossible, réessayez.');
      },
    );
  }, [api, auth, code, navigate, sessionExpired, switching, trip]);

  if (trip === null) return <NotFoundPage />;
  if (auth.status !== 'anonymous') {
    return joinError ? (
      <p className="banner banner--error" role="alert">
        {joinError}
      </p>
    ) : (
      <p className="loading">Ouverture du voyage…</p>
    );
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
      onEmail={(email) => login(email)}
      onName={async (email, name) => {
        await login(email, name);
      }}
    />
  );
}
