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
 * « Voiture pleine »), toujours en dernier. Si la colonne de droite dépasse
 * 3 lignes, la case des places libres disparaît : le bouton suffit. Voiture
 * vide : places libres à gauche, bouton à droite.
 */
export function placeSeats(cells: SeatCell[]): PlacedCell[] {
  const passengers = cells.filter(isPassenger);
  // Voiture vide : places libres à gauche, bouton à droite, sur une ligne.
  if (passengers.length === 0) {
    return cells.map((cell, i) => ({ cell, column: i === 0 ? 1 : 2, row: 1 }));
  }
  let right = [...passengers.slice(3), ...cells.filter((c) => !isPassenger(c))];
  const hasAction = right.some((c) => c.kind === 'take' || c.kind === 'leave');
  if (right.length > 3 && hasAction) right = right.filter((c) => c.kind !== 'free');
  return [
    ...passengers.slice(0, 3).map((cell, i) => ({ cell, column: 1 as const, row: i + 1 })),
    ...right.map((cell, i) => ({ cell, column: 2 as const, row: i + 1 })),
  ];
}

/** « 1 place libre », « 3 places libres » */
export function freeSeatsLabel(count: number): string {
  return count > 1 ? `${count} places libres` : `${count} place libre`;
}

/** Places encore libres dans la voiture, sur le trajet le moins rempli. */
export function freeSeats(car: Car): number {
  if (car.legs.length === 0) return 0;
  return Math.max(...car.legs.map((l) => car.seats - l.passengers.length));
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
