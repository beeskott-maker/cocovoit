import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApi } from '../lib/api';
import { AuthContext, forgetLegacyStorage, readToken, writeToken, type AuthState } from '../lib/auth';
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
    api.me(token).then(
      (account) => alive && setAuth({ status: 'connected', token, account }),
      (err) => {
        if (!alive) return;
        if (err instanceof ApiError && err.code === 'unauthenticated') writeToken(null);
        setAuth({ status: 'anonymous' });
      },
    );
    return () => {
      alive = false;
    };
  }, [api]);

  const login = useCallback(
    async (email: string, name?: string) => {
      const res = await api.login(email, name);
      if (res.status === 'needs_name') return 'needs_name';
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
    if (token) await api.logout(token).catch(() => undefined);
  }, [api]);

  const sessionExpired = useCallback(() => {
    writeToken(null);
    setAuth({ status: 'anonymous' });
  }, []);

  const value = useMemo(() => ({ auth, login, logout, sessionExpired }), [auth, login, logout, sessionExpired]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
