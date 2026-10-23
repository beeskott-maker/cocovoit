import { clearAllSessions } from './session';

/** Identité de la personne (nom + email), mémorisée dans ce navigateur pour tous les voyages. */
export interface Identity {
  email: string;
  name: string;
}

const KEY = 'cocovoit:identity';

export function getIdentity(): Identity | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Identity | null;
    return value?.email && value.name ? value : null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity) {
  localStorage.setItem(KEY, JSON.stringify({ email: identity.email.trim(), name: identity.name.trim() }));
}

/** « Ce n'est pas moi » : oublie l'identité et l'accès à tous les voyages de ce navigateur. */
export function forgetIdentity() {
  localStorage.removeItem(KEY);
  clearAllSessions();
}
