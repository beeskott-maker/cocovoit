const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const year = (d: Date) => d.getUTCFullYear();

const clean = (s: string) => s.replace('.', '');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-10-10", "2026-10-12" → "ven 10 → dim 12 oct 2026" */
export function formatTripDates(startsOn: string, endsOn: string): string {
  const a = new Date(`${startsOn}T00:00:00Z`);
  const b = new Date(`${endsOn}T00:00:00Z`);
  const end = `${clean(day.format(b))} ${clean(month.format(b))} ${year(b)}`;
  if (startsOn === endsOn) return end;
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && year(a) === year(b);
  const start = sameMonth
    ? clean(day.format(a))
    : `${clean(day.format(a))} ${clean(month.format(a))}${year(a) !== year(b) ? ` ${year(a)}` : ''}`;
  return `${start} → ${end}`;
}

const legDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const legTime = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit' });

/** Date ISO → "Ven 10 oct à 9h00" (fuseau du navigateur) */
export function formatDeparture(iso: string): string {
  const d = new Date(iso);
  const time = legTime.format(d).replace(':', 'h');
  return `${capitalize(clean(legDay.format(d)).replace(/\./g, ''))} à ${time}`;
}

/** Date ISO → valeur pour <input type="datetime-local"> (heure locale) */
export function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Affiche le lieu dans Google Maps (sans itinéraire). */
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/** Lien unique d'invitation (routage par hash, compatible GitHub Pages). */
export function inviteUrl(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/j/${code}`;
}

/** Date du jour de l'appareil, au format "2026-10-24". */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Où en est un voyage par rapport à aujourd'hui : à venir (« dans 5 jours »,
 * puis en semaines au-delà de 7 jours), en cours, ou passé.
 */
export function tripTiming(startsOn: string, endsOn: string, today: string): { status: 'upcoming' | 'ongoing' | 'past'; label: string } {
  if (endsOn < today) return { status: 'past', label: 'Passé' };
  if (startsOn <= today) return { status: 'ongoing', label: 'En cours' };
  const days = Math.round((Date.parse(startsOn) - Date.parse(today)) / 86_400_000);
  if (days === 1) return { status: 'upcoming', label: 'demain' };
  if (days <= 7) return { status: 'upcoming', label: `dans ${days} jours` };
  const weeks = Math.round(days / 7);
  return { status: 'upcoming', label: `dans ${weeks} semaine${weeks > 1 ? 's' : ''}` };
}
