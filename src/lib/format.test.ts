import { directionsUrl, formatDeparture, formatTripDates, isEmail } from './format';

describe('formatTripDates', () => {
  it('formate un week-end dans le même mois comme la maquette', () => {
    expect(formatTripDates('2026-10-10', '2026-10-12')).toBe('sam 10 → lun 12 oct 2026');
  });
  it('précise le mois de départ quand il change', () => {
    expect(formatTripDates('2026-10-30', '2026-11-02')).toBe('ven 30 oct → lun 2 nov 2026');
  });
  it('gère un voyage sur une journée', () => {
    expect(formatTripDates('2026-10-10', '2026-10-10')).toBe('sam 10 oct 2026');
  });
});

describe('formatDeparture', () => {
  it('affiche le jour et l’heure locale', () => {
    const d = new Date(2026, 9, 9, 9, 0); // ven 9 oct 2026, 9h00 heure locale
    expect(formatDeparture(d.toISOString())).toBe('Ven 9 oct à 9h00');
  });
});

describe('isEmail', () => {
  it.each([
    ['loic.pelletier@gmail.com', true],
    [' a@b.fr ', true],
    ['loic', false],
    ['loic@gmail', false],
  ])('%s → %s', (value, expected) => expect(isEmail(value)).toBe(expected));
});

describe('directionsUrl', () => {
  it('ouvre un itinéraire en voiture avec guidage, pas une simple localisation', () => {
    const url = new URL(directionsUrl('124 Venelle de Brouilly 69460 Odenas'));
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('destination')).toBe('124 Venelle de Brouilly 69460 Odenas');
    expect(url.searchParams.get('travelmode')).toBe('driving');
    expect(url.searchParams.get('dir_action')).toBe('navigate');
  });
});
