import type { Car, Leg } from './types';

export type SeatCell =
  | { kind: 'occupied'; name: string }
  | { kind: 'me' }
  | { kind: 'free' }
  | { kind: 'take' }
  | { kind: 'leave' };

/**
 * Cases de la grille des places d'un trajet (2 colonnes) :
 * passagers, puis places libres. La dernière place libre devient le bouton
 * « Prendre 1 place », ou « Libérer ma place » si j'y suis (ajouté en plus
 * si la voiture est pleine).
 */
export function seatCells(car: Car, leg: Leg, meId: string): SeatCell[] {
  const iAmIn = leg.passengers.some((p) => p.id === meId);
  const canTake = !iAmIn && car.driver.id !== meId;
  const cells: SeatCell[] = leg.passengers.map((p) =>
    p.id === meId ? { kind: 'me' } : { kind: 'occupied', name: p.name },
  );
  const free = Math.max(0, car.seats - leg.passengers.length);
  for (let i = 0; i < free; i++) cells.push({ kind: 'free' });
  const action: SeatCell | null = iAmIn ? { kind: 'leave' } : canTake && free > 0 ? { kind: 'take' } : null;
  if (action) {
    if (free > 0) cells[cells.length - 1] = action;
    else cells.push(action);
  }
  return cells;
}

/** Places encore libres dans la voiture, sur le trajet le moins rempli. */
export function freeSeats(car: Car): number {
  if (car.legs.length === 0) return 0;
  return Math.max(...car.legs.map((l) => car.seats - l.passengers.length));
}
