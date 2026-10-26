import { bookedDirections, freeSeatsLabel, placeSeats, seatCells } from './seats';
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
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'occupied', 'occupied', 'full']);
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

describe('voiture pleine', () => {
  it('« Voiture pleine 😢 » à la place de « Prendre 1 place »', () => {
    const c = car(['lea', 'max', 'zoe']);
    expect(seatCells(c, c.legs[0], 'moi').map((x) => x.kind)).toEqual(['occupied', 'occupied', 'occupied', 'full']);
    // Ni pour le conducteur, ni pour un passager de cette voiture.
    expect(seatCells(c, c.legs[0], 'hugo').map((x) => x.kind)).toEqual(['occupied', 'occupied', 'occupied']);
    expect(seatCells(c, c.legs[0], 'lea').at(-1)).toEqual({ kind: 'leave' });
  });
});

describe('placeSeats', () => {
  // « G1 » : colonne de gauche, ligne 1 ; « D2 » : colonne de droite, ligne 2.
  const layout = (passengers: number, seats: number, me = 'moi') => {
    const c = car(Array.from({ length: passengers }, (_, i) => `p${i}`), seats);
    return placeSeats(seatCells(c, c.legs[0], me)).map(({ cell, column, row }) => `${cell.kind}:${column === 1 ? 'G' : 'D'}${row}`);
  };
  it('passagers à gauche (3 au plus), puis places libres et bouton à droite', () => {
    expect(layout(1, 2)).toEqual(['occupied:G1', 'free:D1', 'take:D2']);
    expect(layout(3, 4)).toEqual(['occupied:G1', 'occupied:G2', 'occupied:G3', 'free:D1', 'take:D2']);
    expect(layout(4, 5)).toEqual(['occupied:G1', 'occupied:G2', 'occupied:G3', 'occupied:D1', 'free:D2', 'take:D3']);
    expect(layout(4, 6).slice(3)).toEqual(['occupied:D1', 'free:D2', 'take:D3']);
  });
  it('plus de 3 lignes à droite : le bouton passe sur une 4e ligne', () => {
    expect(layout(5, 6).slice(3)).toEqual(['occupied:D1', 'occupied:D2', 'free:D3', 'take:D4']);
  });
  it('voiture vide : places libres à gauche, bouton à droite', () => {
    expect(layout(0, 4)).toEqual(['free:G1', 'take:D1']);
  });
  it('voiture pleine : « Voiture pleine » en dernier à droite', () => {
    expect(layout(2, 2)).toEqual(['occupied:G1', 'occupied:G2', 'full:D1']);
    expect(layout(6, 6).slice(3)).toEqual(['occupied:D1', 'occupied:D2', 'occupied:D3', 'full:D4']);
  });
});
