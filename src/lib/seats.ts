import type { Car, Direction, Leg } from './types';

export type SeatCell =
  | { kind: 'occupied'; name: string }
  | { kind: 'me' }
  | { kind: 'free'; count: number }
  | { kind: 'take'; disabled: boolean }
  | { kind: 'full' }
  | { kind: 'leave' };

/**
 * Cases de la grille des places d'un trajet : une case par passager, une
 * seule case pour les places libres (avec leur nombre), puis le bouton
 * « Prendre 1 place » s'il reste de la place, ou « Libérer ma place » si j'y suis.
 * Le bouton « Prendre 1 place » est désactivé si j'ai déjà une place dans ce
 * sens (aller ou retour) dans une autre voiture, et absent si je conduis une
 * voiture de ce voyage : un conducteur n'est jamais passager. Si le trajet est
 * complet, « Voiture pleine 😢 » prend la place du bouton.
 */
export function seatCells(
  car: Car,
  leg: Leg,
  meId: string,
  myDirections: ReadonlySet<Direction> = new Set(),
  iDrive = car.driver.id === meId,
): SeatCell[] {
  const iAmIn = leg.passengers.some((p) => p.id === meId);
  const canTake = !iAmIn && !iDrive;
  const cells: SeatCell[] = leg.passengers.map((p) =>
    p.id === meId ? { kind: 'me' } : { kind: 'occupied', name: p.name },
  );
  const free = Math.max(0, car.seats - leg.passengers.length);
  if (free > 0) cells.push({ kind: 'free', count: free });
  if (iAmIn) cells.push({ kind: 'leave' });
  else if (canTake) cells.push(free > 0 ? { kind: 'take', disabled: myDirections.has(leg.direction) } : { kind: 'full' });
  return cells;
}

export interface PlacedCell {
  cell: SeatCell;
  /** Colonne (1 ou 2) et ligne (à partir de 1) dans la grille. */
  column: 1 | 2;
  row: number;
}

const isPassenger = (c: SeatCell) => c.kind === 'occupied' || c.kind === 'me';

/**
 * Place les cases sur deux colonnes : à gauche, les passagers (3 au plus) ; à
 * droite, les passagers suivants, puis les places libres, puis le bouton (ou
 * « Voiture pleine »), toujours en dernier, quitte à passer sur une 4e ligne.
 * Voiture vide : places libres à gauche, bouton à droite.
 */
export function placeSeats(cells: SeatCell[]): PlacedCell[] {
  const passengers = cells.filter(isPassenger);
  // Voiture vide : places libres à gauche, bouton à droite, sur une ligne.
  if (passengers.length === 0) {
    return cells.map((cell, i) => ({ cell, column: i === 0 ? 1 : 2, row: 1 }));
  }
  const right = [...passengers.slice(3), ...cells.filter((c) => !isPassenger(c))];
  return [
    ...passengers.slice(0, 3).map((cell, i) => ({ cell, column: 1 as const, row: i + 1 })),
    ...right.map((cell, i) => ({ cell, column: 2 as const, row: i + 1 })),
  ];
}

/** « 1 place libre », « 3 places libres » */
export function freeSeatsLabel(count: number): string {
  return count > 1 ? `${count} places libres` : `${count} place libre`;
}

/** Sens (aller, retour) dans lesquels j'ai déjà une place de passager. */
export function bookedDirections(cars: Car[], meId: string): Set<Direction> {
  const directions = new Set<Direction>();
  for (const car of cars) {
    for (const leg of car.legs) {
      if (leg.passengers.some((p) => p.id === meId)) directions.add(leg.direction);
    }
  }
  return directions;
}

/** Places libres, aller et retour cumulés. */
export const freeSeats = (car: Car) => car.legs.reduce((n, leg) => n + Math.max(car.seats - leg.passengers.length, 0), 0);
const fillRate = (car: Car) => car.legs.reduce((n, leg) => n + leg.passengers.length, 0) / (car.seats * car.legs.length || 1);
const firstDeparture = (car: Car) => Math.min(...car.legs.map((leg) => new Date(leg.departsAt).getTime()));

/**
 * Ordre des voitures : la mienne d'abord ; puis celles qui ont des places
 * libres, les plus près d'être pleines en tête (places libres sur l'aller et
 * le retour, puis taux de remplissage) ; les complètes à la fin. À égalité,
 * la première à partir, puis l'ordre d'ajout.
 */
export function sortCars(cars: Car[], meId: string): Car[] {
  const key = (car: Car) => {
    const free = freeSeats(car);
    return [car.driver.id === meId ? 0 : 1, free === 0 ? 1 : 0, free, -fillRate(car), firstDeparture(car)];
  };
  return cars
    .map((car, index) => ({ car, key: [...key(car), index] }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
      return 0;
    })
    .map(({ car }) => car);
}

/**
 * Applique un ordre déjà calculé (identifiants) : les voitures connues gardent
 * leur place, les nouvelles s'ajoutent à la fin, les supprimées disparaissent.
 */
export function keepOrder(cars: Car[], order: readonly string[]): Car[] {
  const rank = (car: Car) => {
    const i = order.indexOf(car.id);
    return i === -1 ? order.length : i;
  };
  return [...cars].sort((a, b) => rank(a) - rank(b));
}
