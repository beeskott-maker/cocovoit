/** Événement d'agenda : rendez-vous de covoiturage. */
export interface CalendarEvent {
  /** Identifiant stable : réimporter l'événement le met à jour au lieu de le dupliquer. */
  uid: string;
  title: string;
  /** ISO 8601 */
  start: string;
  durationMinutes: number;
  location: string;
  description: string;
  /** Rappel, en minutes avant le début. */
  reminderMinutes: number;
}

/** 2026-11-14T06:00:00Z → 20261114T060000Z */
function utc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const end = (e: CalendarEvent) => new Date(new Date(e.start).getTime() + e.durationMinutes * 60_000);

// Texte iCalendar : antislash, virgule, point-virgule et retours à la ligne échappés.
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

/** Fichier .ics (RFC 5545), lignes séparées par CRLF. */
export function icsFile(e: CalendarEvent, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coco·Voit//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(new Date(e.start))}`,
    `DTEND:${utc(end(e))}`,
    `SUMMARY:${escape(e.title)}`,
    `LOCATION:${escape(e.location)}`,
    `DESCRIPTION:${escape(e.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(e.title)}`,
    `TRIGGER:-PT${e.reminderMinutes}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Lien Google Agenda pré-rempli (le rappel suit les réglages de l'agenda). */
export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${utc(new Date(e.start))}/${utc(end(e))}`,
    location: e.location,
    details: e.description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Télécharge le fichier .ics : iPhone, iPad et Mac l'ouvrent dans Calendrier. */
export function downloadIcs(e: CalendarEvent, filename: string) {
  const url = URL.createObjectURL(new Blob([icsFile(e)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
