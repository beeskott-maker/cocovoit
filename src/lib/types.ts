export type Direction = 'aller' | 'retour';

export interface TripPreview {
  code: string;
  name: string;
  destination: string;
  /** Dates au format YYYY-MM-DD */
  startsOn: string;
  endsOn: string;
}

export interface Person {
  id: string;
  name: string;
}

export interface Leg {
  id: string;
  direction: Direction;
  /** ISO 8601 */
  departsAt: string;
  meetingPoint: string | null;
  passengers: Person[];
}

export interface Car {
  id: string;
  seats: number;
  driver: Person;
  legs: Leg[];
}

export interface TripState {
  trip: TripPreview;
  me: Person & { isOrganizer: boolean };
  cars: Car[];
}

/** Voyage tel qu'affiché dans la page de gestion des voyages. */
export interface AdminTrip extends TripPreview {
  /** ISO 8601 */
  createdAt: string;
  participants: number;
  cars: number;
}

export interface NewTrip {
  name: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  organizerName: string;
  organizerEmail: string;
}

export interface LegInput {
  direction: Direction;
  departsAt: string;
  meetingPoint: string | null;
}

export interface CarInput {
  carId: string | null;
  seats: number;
  legs: LegInput[];
}

export type JoinResult = { status: 'needs_name' } | { status: 'ok'; secret: string; name: string };

/** Erreur métier affichable telle quelle à l'utilisateur. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: 'forbidden' | 'not_found' | 'invalid' | 'unknown',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Api {
  readonly mode: 'supabase' | 'demo';
  createTrip(input: NewTrip): Promise<{ code: string; secret: string }>;
  getTripPreview(code: string): Promise<TripPreview | null>;
  joinTrip(code: string, email: string, name?: string): Promise<JoinResult>;
  getTripState(code: string, secret: string): Promise<TripState>;
  saveCar(code: string, secret: string, input: CarInput): Promise<string>;
  deleteCar(code: string, secret: string, carId: string): Promise<void>;
  takeSeat(code: string, secret: string, legId: string): Promise<void>;
  leaveSeat(code: string, secret: string, legId: string): Promise<void>;
  /** Gestion des voyages, protégée par une clé (page #/x/<clé>). */
  adminListTrips(key: string): Promise<AdminTrip[]>;
  adminDeleteTrip(key: string, code: string): Promise<void>;
}
