import type { Car, Leg } from './types';

export type SeatCell =
  | { kind: 'occupied'; name: string }
  | { kind: 'me' }
  | { kind: 'free' }
  | { kind: 'take' }
  | { kind: 'leave' };

/**
 * Cases de la grille des places d'un trajet (2 colonnes) :
 * une case par place (passagers, puis places libres), suivie du bouton
 * « Prendre 1 place » s'il reste de la place, ou « Libérer ma place » si j'y suis.
 */
export function seatCells(car: Car, leg: Leg, meId: string): SeatCell[] {
  const iAmIn = leg.passengers.some((p) => p.id === meId);
  const canTake = !iAmIn && car.driver.id !== meId;
  const cells: SeatCell[] = leg.passengers.map((p) =>
    p.id === meId ? { kind: 'me' } : { kind: 'occupied', name: p.name },
  );
  const free = Math.max(0, car.seats - leg.passengers.length);
  for (let i = 0; i < free; i++) cells.push({ kind: 'free' });
  if (iAmIn) cells.push({ kind: 'leave' });
  else if (canTake && free > 0) cells.push({ kind: 'take' });
  return cells;
}

/** Places encore libres dans la voiture, sur le trajet le moins rempli. */
export function freeSeats(car: Car): number {
  if (car.legs.length === 0) return 0;
  return Math.max(...car.legs.map((l) => car.seats - l.passengers.length));
}
