import type { Car, Leg } from './types';

export type SeatCell =
  | { kind: 'occupied'; name: string }
  | { kind: 'me' }
  | { kind: 'free'; count: number }
  | { kind: 'take' }
  | { kind: 'leave' };

/**
 * Cases de la grille des places d'un trajet : une case par passager, une
 * seule case pour les places libres (avec leur nombre), puis le bouton
 * « Prendre 1 place » s'il reste de la place, ou « Libérer ma place » si j'y suis.
 */
export function seatCells(car: Car, leg: Leg, meId: string): SeatCell[] {
  const iAmIn = leg.passengers.some((p) => p.id === meId);
  const canTake = !iAmIn && car.driver.id !== meId;
  const cells: SeatCell[] = leg.passengers.map((p) =>
    p.id === meId ? { kind: 'me' } : { kind: 'occupied', name: p.name },
  );
  const free = Math.max(0, car.seats - leg.passengers.length);
  if (free > 0) cells.push({ kind: 'free', count: free });
  if (iAmIn) cells.push({ kind: 'leave' });
  else if (canTake && free > 0) cells.push({ kind: 'take' });
  return cells;
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
