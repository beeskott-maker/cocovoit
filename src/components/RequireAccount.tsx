import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Page réservée aux personnes connectées : sinon, connexion puis retour ici. */
export function RequireAccount({ children }: { children: (token: string) => ReactNode }) {
  const { auth } = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <p className="loading">Chargement…</p>;
  if (auth.status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/identification?suite=${next}`} replace />;
  }
  return <>{children(auth.token)}</>;
}
