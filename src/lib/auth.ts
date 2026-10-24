import { createContext, useContext } from 'react';
import { storageKey } from './env';
import type { Account } from './types';

/**
 * Connexion au compte. Le compte (email, nom) et tout ce qui s'y rattache
 * sont en base ; le navigateur ne garde que le jeton de session.
 */
const TOKEN_KEY = storageKey('token');

/** Anciennes données (identité et accès par voyage) : remplacées par le compte. */
export function forgetLegacyStorage() {
  try {
    localStorage.removeItem('cocovoit:identity');
    localStorage.removeItem('cocovoit:sessions');
  } catch {
    // Stockage indisponible : rien à nettoyer.
  }
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible : la session ne durera que le temps de la page.
  }
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'connected'; token: string; account: Account };

export interface AuthContextValue {
  auth: AuthState;
  /** Connexion par email : « needs_name » si le compte n'existe pas encore. */
  login(email: string, name?: string): Promise<'done' | 'needs_name'>;
  logout(): Promise<void>;
  /** À appeler quand le serveur répond que la session n'est plus valide. */
  sessionExpired(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return value;
}
