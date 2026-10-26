import { googleCalendarUrl, icsFile, rdvEvent, type CalendarEvent } from './calendar';

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

  it('rendez-vous de l’aller : 30 min, rappel 1 h avant, conducteur et passagers', () => {
    const leg = {
      id: 'leg-1',
      direction: 'aller' as const,
      departsAt: '2026-11-14T07:00:00+01:00',
      meetingPoint: 'Gare Part-Dieu',
      passengers: [
        { id: 'j', name: 'Julie' },
        { id: 's', name: 'Sarah' },
      ],
    };
    expect(rdvEvent('Annecy', 'Hugo', leg, 'https://cocovoiturage.fr/#/j/abc')).toEqual({
      uid: 'leg-1@cocovoit',
      title: 'Covoiturage aller · Annecy',
      start: '2026-11-14T07:00:00+01:00',
      durationMinutes: 30,
      location: 'Gare Part-Dieu',
      description: 'Conducteur : Hugo\nPassagers : Julie, Sarah\nVoyage : https://cocovoiturage.fr/#/j/abc',
      reminderMinutes: 60,
    });
    // Sans point de RDV ni passager.
    expect(rdvEvent('Annecy', 'Hugo', { ...leg, meetingPoint: null, passengers: [] }, 'u')).toMatchObject({
      location: '',
      description: expect.stringContaining('Passagers : aucun pour l’instant'),
    });
  });
});
