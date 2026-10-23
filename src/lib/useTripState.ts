import { useCallback, useEffect, useState } from 'react';
import { useApi } from './api';
import { ApiError, type TripState } from './types';

const REFRESH_MS = 15_000;

/** Charge l'état du voyage et le rafraîchit régulièrement (et au retour sur l'onglet). */
export function useTripState(code: string, secret: string | undefined) {
  const api = useApi();
  const [state, setState] = useState<TripState | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    if (!secret) return;
    try {
      setState(await api.getTripState(code, secret));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Connexion impossible', 'unknown'));
    }
  }, [api, code, secret]);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => document.visibilityState === 'visible' && void reload(), REFRESH_MS);
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [reload]);

  return { state, error, reload };
}
