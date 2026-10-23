import { bookedDirections, freeSeats, freeSeatsLabel, seatCells } from './seats';
import type { Car } from './types';

const car = (passengers: string[], seats = 3): Car => ({
  id: 'c',
  seats,
  driver: { id: 'hugo', name: 'Hugo' },
  legs: [
    {
      id: 'l',
      direction: 'aller',
      departsAt: '2026-10-10T07:00:00Z',
      meetingPoint: null,
      passengers: passengers.map((id) => ({ id, name: id.toUpperCase() })),
    },
  ],
});

describe('seatCells', () => {
  it('regroupe les places libres dans une seule case, puis « Prendre 1 place »', () => {
    const c = car(['lea']);
    expect(seatCells(c, c.legs[0], 'moi')).toEqual([
      { kind: 'occupied', name: 'LEA' },
      { kind: 'free', count: 2 },
      { kind: 'take', disabled: false },
    ]);
  });
  it('affiche « Moi » et « Libérer ma place » quand je suis passager', () => {
    const c = car(['lea', 'moi']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'me', 'free', 'leave']);
    expect(seatCells(c, c.legs[0], 'moi')[2]).toEqual({ kind: 'free', count: 1 });
  });
  it('ajoute « Libérer ma place » en plus quand la voiture est pleine', () => {
    const c = car(['lea', 'moi', 'max']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'me', 'occupied', 'leave']);
  });
  it('ne propose rien au conducteur', () => {
    const c = car([]);
    expect(seatCells(c, c.legs[0], 'hugo')).toEqual([{ kind: 'free', count: 3 }]);
  });
  it('voiture pleine : pas de bouton', () => {
    const c = car(['a', 'b', 'c']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'occupied', 'occupied']);
    expect(freeSeats(c)).toBe(0);
  });

  it('accorde le libellé des places libres', () => {
    expect(freeSeatsLabel(1)).toBe('1 place libre');
    expect(freeSeatsLabel(3)).toBe('3 places libres');
  });
});

describe('une place par sens', () => {
  it('désactive « Prendre 1 place » si j\'ai déjà une place dans ce sens', () => {
    const c = car(['lea']);
    expect(seatCells(c, c.legs[0], 'moi', new Set(['aller'])).at(-1)).toEqual({ kind: 'take', disabled: true });
    expect(seatCells(c, c.legs[0], 'moi', new Set(['retour'])).at(-1)).toEqual({ kind: 'take', disabled: false });
  });

  it('liste les sens où j\'ai une place', () => {
    expect([...bookedDirections([car(['moi'])], 'moi')]).toEqual(['aller']);
    expect(bookedDirections([car(['lea'])], 'moi').size).toBe(0);
  });
});

describe('conducteur', () => {
  it("pas de « Prendre 1 place » dans les autres voitures quand je conduis", () => {
    const c = car(['lea']);
    expect(seatCells(c, c.legs[0], 'moi', new Set(), true).map((x) => x.kind)).toEqual(['occupied', 'free']);
  });
});

