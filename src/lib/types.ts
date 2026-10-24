export type Direction = 'aller' | 'retour';

export interface TripPreview {
  code: string;
  name: string;
  destination: string | null;
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

/** Compte de la personne connectée. */
export interface Account {
  email: string;
  name: string;
}

/** Connexion par email : nom demandé si le compte n'existe pas encore. */
export type LoginResult = { status: 'needs_name' } | { status: 'ok'; token: string; account: Account };

/** Erreur métier affichable telle quelle à l'utilisateur. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unauthenticated' // session inconnue ou fermée : il faut se reconnecter
      | 'forbidden'
      | 'unauthorized_email'
      | 'not_found'
      | 'invalid'
      | 'unknown',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Voyage de « Mes voyages » : ceux auxquels participe le compte. */
export interface MyTrip {
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isOrganizer: boolean;
  isDriver: boolean;
  isPassenger: boolean;
  /** Au moins un trajet, et plus aucune place libre. */
  isFull: boolean;
}

/**
 * Accès aux données. Toutes les opérations liées à une personne prennent le
 * jeton de session de son compte (`token`), obtenu à la connexion.
 */
export interface Api {
  readonly mode: 'supabase' | 'demo';
  login(email: string, name?: string): Promise<LoginResult>;
  me(token: string): Promise<Account>;
  logout(token: string): Promise<void>;
  createTrip(token: string, input: NewTrip): Promise<string>;
  getTripPreview(code: string): Promise<TripPreview | null>;
  joinTrip(token: string, code: string): Promise<void>;
  myTrips(token: string): Promise<MyTrip[]>;
  getTripState(token: string, code: string): Promise<TripState>;
  saveCar(token: string, code: string, input: CarInput): Promise<string>;
  deleteCar(token: string, code: string, carId: string): Promise<void>;
  /** Réservé à l'organisateur : supprime le voyage et tout ce qui s'y rattache. */
  deleteTrip(token: string, code: string): Promise<void>;
  takeSeat(token: string, code: string, legId: string): Promise<void>;
  leaveSeat(token: string, code: string, legId: string): Promise<void>;
  /** Gestion des voyages (page #/x/<clé>) : clé de l'URL + adresse email autorisée. */
  adminListTrips(key: string, email: string): Promise<AdminTrip[]>;
  adminDeleteTrip(key: string, email: string, code: string): Promise<void>;
}
