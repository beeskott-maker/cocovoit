/** Secrets des participants, par code de voyage, conservés dans le navigateur. */
export interface TripSession {
  code: string;
  secret: string;
  name: string;
  tripName: string;
}

const KEY = 'cocovoit:sessions';

function readAll(): Record<string, TripSession> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, TripSession>;
  } catch {
    return {};
  }
}

export function getSession(code: string): TripSession | null {
  return readAll()[code] ?? null;
}

export function listSessions(): TripSession[] {
  return Object.values(readAll());
}

export function saveSession(session: TripSession) {
  localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [session.code]: session }));
}

export function clearSession(code: string) {
  const all = readAll();
  delete all[code];
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearAllSessions() {
  localStorage.removeItem(KEY);
}
