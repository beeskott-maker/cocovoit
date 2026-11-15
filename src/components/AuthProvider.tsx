import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApi } from '../lib/api';
import { AuthContext, forgetLegacyStorage, readToken, writeToken, type AuthState, type LoginOutcome } from '../lib/auth';
import { disablePush } from '../lib/push';
import { ApiError } from '../lib/types';

/** Charge le compte de la session mémorisée et expose connexion / déconnexion. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [auth, setAuth] = useState<AuthState>(() => (readToken() ? { status: 'loading' } : { status: 'anonymous' }));

  useEffect(() => {
    forgetLegacyStorage();
    const token = readToken();
    if (!token) return;
    let alive = true;
    const load = () =>
      api.me(token).then(
        (account) => alive && setAuth({ status: 'connected', token, account }),
        (err) => {
          if (!alive) return;
          // Lancée sans réseau : on garde la session et on réessaie au retour de la connexion.
          if (!navigator.onLine) {
            window.addEventListener('online', load, { once: true });
            return;
          }
          if (err instanceof ApiError && err.code === 'unauthenticated') writeToken(null);
          setAuth({ status: 'anonymous' });
        },
      );
    void load();
    return () => {
      alive = false;
      window.removeEventListener('online', load);
    };
  }, [api]);

  const login = useCallback(
    async (email: string, name?: string, phone?: string | null, request?: string | null, next?: string | null): Promise<LoginOutcome> => {
      const res = await api.login(email, name, phone, request, next);
      if (res.status === 'needs_name') return 'needs_name';
      if (res.status === 'verification_sent') return { request: res.request };
      writeToken(res.token);
      setAuth({ status: 'connected', token: res.token, account: res.account });
      return 'done';
    },
    [api],
  );

  const logout = useCallback(async () => {
    const token = readToken();
    writeToken(null);
    setAuth({ status: 'anonymous' });
    if (!token) return;
    // Cet appareil ne reçoit plus les notifications du compte.
    await disablePush(api, token).catch(() => undefined);
    await api.logout(token).catch(() => undefined);
  }, [api]);

  const sessionExpired = useCallback(() => {
    writeToken(null);
    setAuth({ status: 'anonymous' });
  }, []);

  const value = useMemo(() => ({ auth, login, logout, sessionExpired }), [auth, login, logout, sessionExpired]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
