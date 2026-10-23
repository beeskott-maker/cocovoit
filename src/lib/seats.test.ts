import { freeSeats, seatCells } from './seats';
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
  it('remplace la dernière place libre par « Prendre 1 place »', () => {
    const c = car(['lea']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'free', 'take']);
  });
  it('affiche « Moi » et « Libérer ma place » quand je suis passager', () => {
    const c = car(['lea', 'moi']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'me', 'leave']);
  });
  it('ajoute « Libérer ma place » en plus quand la voiture est pleine', () => {
    const c = car(['lea', 'moi', 'max']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'me', 'occupied', 'leave']);
  });
  it('ne propose rien au conducteur', () => {
    const c = car([]);
    expect(seatCells(c, c.legs[0], 'hugo').map((x) => x.kind)).toEqual(['free', 'free', 'free']);
  });
  it('voiture pleine : pas de bouton', () => {
    const c = car(['a', 'b', 'c']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'occupied', 'occupied']);
    expect(freeSeats(c)).toBe(0);
  });
});
