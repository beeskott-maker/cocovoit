import { googleCalendarUrl, icsFile, type CalendarEvent } from './calendar';

const event: CalendarEvent = {
  uid: 'leg-1@cocovoit',
  title: 'Covoiturage aller · WE, Beaujolais',
  start: '2026-11-14T07:00:00+01:00',
  durationMinutes: 30,
  location: 'Gare Part-Dieu; Lyon',
  description: 'Conducteur : Hugo\nPassagers : Julie',
  reminderMinutes: 60,
};

describe('agenda', () => {
  it('fichier .ics : 30 minutes, rappel 1 h avant, texte échappé', () => {
    const ics = icsFile(event, new Date('2026-10-26T10:00:00Z'));
    expect(ics.split('\r\n')).toEqual(
      expect.arrayContaining([
        'UID:leg-1@cocovoit',
        'DTSTAMP:20261026T100000Z',
        'DTSTART:20261114T060000Z',
        'DTEND:20261114T063000Z',
        'SUMMARY:Covoiturage aller · WE\\, Beaujolais',
        'LOCATION:Gare Part-Dieu\\; Lyon',
        'DESCRIPTION:Conducteur : Hugo\\nPassagers : Julie',
        'TRIGGER:-PT60M',
      ]),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  });

  it('lien Google Agenda pré-rempli', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('dates')).toBe('20261114T060000Z/20261114T063000Z');
    expect(url.searchParams.get('location')).toBe('Gare Part-Dieu; Lyon');
  });
});
