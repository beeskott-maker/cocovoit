import { createContext, useContext } from 'react';
import { IS_DEV_ENV } from './env';
import { createLocalApi } from './localApi';
import { createSupabaseApi } from './supabaseApi';
import type { Api } from './types';

/** Supabase si configuré, sinon mode démo stocké dans le navigateur. */
export function createDefaultApi(): Api {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? createSupabaseApi(url, key) : createLocalApi(window.localStorage, undefined, { seedDemo: IS_DEV_ENV });
}

export const ApiContext = createContext<Api | null>(null);

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi doit être utilisé dans <ApiContext.Provider>');
  return api;
}
