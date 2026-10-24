import {
  ApiError,
  type Api,
  type CarInput,
  type Direction,
  type NewTrip,
  type TripState,
} from './types';
import { storageKey } from './env';
import { DEMO_PEOPLE, DEMO_TRIPS, ME } from './demoData';

/**
 * Implémentation de démonstration, utilisée quand Supabase n'est pas configuré.
 * Reproduit les règles des fonctions SQL (supabase/migrations) mais stocke tout
 * dans le navigateur : les données ne sont pas partagées entre appareils.
 */

interface DbTrip {
  id: string;
  code: string;
  name: string;
  destination: string | null;
  startsOn: string;
  endsOn: string;
  createdAt?: number;
}
interface DbAccount {
  id: string;
  email: string;
  name: string;
}
interface DbSession {
  token: string;
  accountId: string;
}
interface DbParticipant {
  id: string;
  tripId: string;
  accountId: string;
  isOrganizer: boolean;
}
interface DbCar {
  id: string;
  tripId: string;
  driverId: string;
  seats: number;
  createdAt: number;
}
interface DbLeg {
  id: string;
  carId: string;
  direction: Direction;
  departsAt: string;
  meetingPoint: string | null;
}
interface DbBooking {
  legId: string;
  participantId: string;
  createdAt: number;
}
interface Db {
  accounts: DbAccount[];
  sessions: DbSession[];
  trips: DbTrip[];
  participants: DbParticipant[];
  cars: DbCar[];
  legs: DbLeg[];
  bookings: DbBooking[];
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = storageKey('demo-db');
const emptyDb = (): Db => ({ accounts: [], sessions: [], trips: [], participants: [], cars: [], legs: [], bookings: [] });

/** Page de gestion des voyages en mode démo : #/x/demo, avec l'adresse ci-dessous. */
export const DEMO_ADMIN_KEY = 'demo';
export const DEMO_ADMIN_EMAIL = 'demo@example.com';

export function createLocalApi(
  store: KeyValueStore,
  newId: () => string = () => crypto.randomUUID(),
  options: { seedDemo?: boolean } = {},
): Api {
  // Horodatage strictement croissant, pour garder l'ordre des réservations.
  let last = 0;
  const now = () => (last = Math.max(Date.now(), last + 1));

  function load(): Db {
    const raw = store.getItem(KEY);
    const db = raw ? (JSON.parse(raw) as Db) : emptyDb();
    // Ancienne base démo sans comptes : on repart de zéro, comme en production.
    return db.accounts ? db : emptyDb();
  }
  function save(db: Db) {
    store.setItem(KEY, JSON.stringify(db));
  }
  function account(db: Db, token: string): DbAccount {
    const session = db.sessions.find((s) => s.token === token);
    const found = session && db.accounts.find((a) => a.id === session.accountId);
    if (!found) throw new ApiError('Session expirée, reconnectez-vous', 'unauthenticated');
    return found;
  }
  function participant(db: Db, token: string, code: string): DbParticipant {
    const me = account(db, token);
    const trip = db.trips.find((t) => t.code === code);
    if (!trip) throw new ApiError('Voyage introuvable', 'not_found');
    const p = db.participants.find((x) => x.tripId === trip.id && x.accountId === me.id);
    if (!p) throw new ApiError('Vous ne participez pas à ce voyage', 'forbidden');
    return p;
  }
  const nameOf = (db: Db, participantId: string) => {
    const p = db.participants.find((x) => x.id === participantId)!;
    return db.accounts.find((a) => a.id === p.accountId)!.name;
  };
  function requireAdmin(key: string, email: string) {
    if (key !== DEMO_ADMIN_KEY) throw new ApiError('Accès refusé', 'forbidden');
    if (email.trim().toLowerCase() !== DEMO_ADMIN_EMAIL) {
      throw new ApiError('Adresse email non autorisée', 'unauthorized_email');
    }
  }
  // Voyages de démonstration (environnement de test) : la personne connectée y
  // prend la place de « moi ».
  function seed(db: Db, meId: string) {
    const accountIds: Record<string, string> = { [ME]: meId };
    for (const [key, name] of Object.entries(DEMO_PEOPLE)) {
      const a = { id: newId(), email: `${key}@example.com`, name };
      db.accounts.push(a);
      accountIds[key] = a.id;
    }
    for (const t of DEMO_TRIPS) {
      const { name, destination, startsOn, endsOn } = t;
      const trip = { id: newId(), code: newId().replace(/-/g, '').slice(0, 16), name, destination, startsOn, endsOn, createdAt: now() };
      db.trips.push(trip);
      const pid: Record<string, string> = {};
      for (const who of t.people) {
        pid[who] = newId();
        db.participants.push({ id: pid[who], tripId: trip.id, accountId: accountIds[who], isOrganizer: who === t.organizer });
      }
      for (const c of t.cars) {
        const car = { id: newId(), tripId: trip.id, driverId: pid[c.driver], seats: c.seats, createdAt: now() };
        db.cars.push(car);
        for (const [direction, leg] of Object.entries(c.legs)) {
          const l = {
            id: newId(),
            carId: car.id,
            direction: direction as Direction,
            departsAt: leg.at,
            meetingPoint: leg.rdv ?? null,
          };
          db.legs.push(l);
          for (const who of leg.passengers) db.bookings.push({ legId: l.id, participantId: pid[who], createdAt: now() });
        }
      }
    }
  }
  // Voyage et tout ce qui s'y rattache (comme la cascade SQL).
  function removeTrip(db: Db, tripId: string) {
    const carIds = new Set(db.cars.filter((c) => c.tripId === tripId).map((c) => c.id));
    const legIds = new Set(db.legs.filter((l) => carIds.has(l.carId)).map((l) => l.id));
    db.trips = db.trips.filter((t) => t.id !== tripId);
    db.participants = db.participants.filter((p) => p.tripId !== tripId);
    db.cars = db.cars.filter((c) => !carIds.has(c.id));
    db.legs = db.legs.filter((l) => !legIds.has(l.id));
    db.bookings = db.bookings.filter((b) => !legIds.has(b.legId));
  }
  // Petite latence pour que l'appli se comporte comme avec un vrai serveur.
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  return {
    mode: 'demo',

    async login(email, name) {
      await tick();
      const db = load();
      let found = db.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (!found) {
        if (!name?.trim()) return { status: 'needs_name' };
        found = { id: newId(), email: email.trim(), name: name.trim() };
        db.accounts.push(found);
      }
      if (options.seedDemo && db.trips.length === 0) seed(db, found.id);
      const token = newId();
      db.sessions.push({ token, accountId: found.id });
      save(db);
      return { status: 'ok', token, account: { email: found.email, name: found.name } };
    },

    async me(token) {
      await tick();
      const { email, name } = account(load(), token);
      return { email, name };
    },

    async logout(token) {
      await tick();
      const db = load();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      save(db);
    },

    async createTrip(token, t: NewTrip) {
      await tick();
      const db = load();
      const me = account(db, token);
      const trip: DbTrip = {
        id: newId(),
        code: newId().replace(/-/g, '').slice(0, 16),
        name: t.name.trim(),
        destination: t.destination.trim() || null,
        startsOn: t.startsOn,
        endsOn: t.endsOn,
        createdAt: now(),
      };
      if (!trip.name) throw new ApiError('Le nom du voyage est obligatoire', 'invalid');
      if (trip.endsOn < trip.startsOn) throw new ApiError('La date de retour est avant le départ', 'invalid');
      db.trips.push(trip);
      db.participants.push({ id: newId(), tripId: trip.id, accountId: me.id, isOrganizer: true });
      save(db);
      return trip.code;
    },

    async getTripPreview(code) {
      await tick();
      const trip = load().trips.find((t) => t.code === code);
      if (!trip) return null;
      const { code: c, name, destination, startsOn, endsOn } = trip;
      return { code: c, name, destination, startsOn, endsOn };
    },

    async joinTrip(token, code) {
      await tick();
      const db = load();
      const me = account(db, token);
      const trip = db.trips.find((t) => t.code === code);
      if (!trip) throw new ApiError('Voyage introuvable', 'not_found');
      if (!db.participants.some((p) => p.tripId === trip.id && p.accountId === me.id)) {
        db.participants.push({ id: newId(), tripId: trip.id, accountId: me.id, isOrganizer: false });
        save(db);
      }
    },

    async myTrips(token) {
      await tick();
      const db = load();
      const me = account(db, token);
      return db.participants
        .filter((p) => p.accountId === me.id)
        .map((p) => {
          const t = db.trips.find((x) => x.id === p.tripId)!;
          return {
            code: t.code,
            name: t.name,
            startsOn: t.startsOn,
            endsOn: t.endsOn,
            isOrganizer: p.isOrganizer,
            isDriver: db.cars.some((c) => c.driverId === p.id),
            isPassenger: db.bookings.some((b) => b.participantId === p.id),
          };
        })
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name));
    },

    async getTripState(token, code): Promise<TripState> {
      await tick();
      const db = load();
      const me = participant(db, token, code);
      const trip = db.trips.find((t) => t.id === me.tripId)!;
      return {
        trip: { code: trip.code, name: trip.name, destination: trip.destination, startsOn: trip.startsOn, endsOn: trip.endsOn },
        me: { id: me.id, name: nameOf(db, me.id), isOrganizer: me.isOrganizer },
        cars: db.cars
          .filter((c) => c.tripId === trip.id)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((c) => ({
            id: c.id,
            seats: c.seats,
            driver: { id: c.driverId, name: nameOf(db, c.driverId) },
            legs: db.legs
              .filter((l) => l.carId === c.id)
              .sort((a, b) => a.direction.localeCompare(b.direction))
              .map((l) => ({
                id: l.id,
                direction: l.direction,
                departsAt: l.departsAt,
                meetingPoint: l.meetingPoint,
                passengers: db.bookings
                  .filter((b) => b.legId === l.id)
                  .sort((a, b) => a.createdAt - b.createdAt)
                  .map((b) => ({ id: b.participantId, name: nameOf(db, b.participantId) })),
              })),
          })),
      };
    },

    async saveCar(token, code, input: CarInput) {
      await tick();
      const db = load();
      const me = participant(db, token, code);
      if (input.legs.length === 0) throw new ApiError('Indiquez au moins un trajet', 'invalid');
      if (input.seats < 1 || input.seats > 8) throw new ApiError('Entre 1 et 8 places', 'invalid');

      let car: DbCar | undefined;
      if (input.carId) {
        car = db.cars.find((c) => c.id === input.carId && c.driverId === me.id);
        if (!car) throw new ApiError('Accès refusé', 'forbidden');
        car.seats = input.seats;
      } else {
        if (db.cars.some((c) => c.driverId === me.id)) throw new ApiError('Vous avez déjà une voiture', 'invalid');
        if (db.bookings.some((b) => b.participantId === me.id)) {
          throw new ApiError('Vous avez une place de passager : libérez-la pour ajouter votre voiture', 'invalid');
        }
        car = { id: newId(), tripId: me.tripId, driverId: me.id, seats: input.seats, createdAt: now() };
        db.cars.push(car);
      }
      const carId = car.id;

      // Un conducteur n'est jamais passager : ses places sont libérées.
      db.bookings = db.bookings.filter((b) => b.participantId !== me.id);
      for (const leg of input.legs) {
        const existing = db.legs.find((l) => l.carId === carId && l.direction === leg.direction);
        const meetingPoint = leg.meetingPoint?.trim() || null;
        if (existing) Object.assign(existing, { departsAt: leg.departsAt, meetingPoint });
        else db.legs.push({ id: newId(), carId, direction: leg.direction, departsAt: leg.departsAt, meetingPoint });
      }
      const kept = new Set(input.legs.map((l) => l.direction));
      db.legs = db.legs.filter((l) => l.carId !== carId || kept.has(l.direction));
      const legIds = new Set(db.legs.map((l) => l.id));
      db.bookings = db.bookings.filter((b) => legIds.has(b.legId));

      // Places réduites : les dernières réservations sautent.
      for (const leg of db.legs.filter((l) => l.carId === carId)) {
        const onLeg = db.bookings.filter((b) => b.legId === leg.id).sort((a, b) => a.createdAt - b.createdAt);
        const dropped = new Set(onLeg.slice(car.seats));
        db.bookings = db.bookings.filter((b) => !dropped.has(b));
      }
      save(db);
      return carId;
    },

    async deleteCar(token, code, carId) {
      await tick();
      const db = load();
      const me = participant(db, token, code);
      if (!db.cars.some((c) => c.id === carId && c.driverId === me.id)) throw new ApiError('Accès refusé', 'forbidden');
      const legIds = new Set(db.legs.filter((l) => l.carId === carId).map((l) => l.id));
      db.cars = db.cars.filter((c) => c.id !== carId);
      db.legs = db.legs.filter((l) => !legIds.has(l.id));
      db.bookings = db.bookings.filter((b) => !legIds.has(b.legId));
      save(db);
    },

    async deleteTrip(token, code) {
      await tick();
      const db = load();
      const me = participant(db, token, code);
      if (!me.isOrganizer) throw new ApiError("Seul l'organisateur peut supprimer ce voyage", 'forbidden');
      removeTrip(db, me.tripId);
      save(db);
    },

    async takeSeat(token, code, legId) {
      await tick();
      const db = load();
      const me = participant(db, token, code);
      const leg = db.legs.find((l) => l.id === legId);
      const car = leg && db.cars.find((c) => c.id === leg.carId);
      if (!leg || !car || car.tripId !== me.tripId) throw new ApiError('Trajet introuvable', 'not_found');
      if (car.driverId === me.id) throw new ApiError('Vous conduisez cette voiture', 'invalid');
      if (db.cars.some((c) => c.driverId === me.id)) {
        throw new ApiError('Vous conduisez une voiture : vous ne pouvez pas être passager', 'invalid');
      }

      const bookedElsewhere = db.bookings.some(
        (b) =>
          b.participantId === me.id &&
          b.legId !== leg.id &&
          db.legs.find((l) => l.id === b.legId)?.direction === leg.direction,
      );
      if (bookedElsewhere) {
        throw new ApiError(`Vous avez déjà une place ${leg.direction === 'aller' ? "à l'aller" : 'au retour'}`, 'invalid');
      }
      const others = db.bookings.filter((b) => b.legId === leg.id && b.participantId !== me.id);
      if (others.length >= car.seats) throw new ApiError('Plus de place disponible', 'invalid');
      if (!db.bookings.some((b) => b.legId === leg.id && b.participantId === me.id)) {
        db.bookings.push({ legId: leg.id, participantId: me.id, createdAt: now() });
      }
      save(db);
    },

    async leaveSeat(token, code, legId) {
      await tick();
      const db = load();
      const me = participant(db, token, code);
      db.bookings = db.bookings.filter((b) => !(b.legId === legId && b.participantId === me.id));
      save(db);
    },

    async adminListTrips(key, email) {
      await tick();
      requireAdmin(key, email);
      const db = load();
      return [...db.trips]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map((t) => ({
          code: t.code,
          name: t.name,
          destination: t.destination,
          startsOn: t.startsOn,
          endsOn: t.endsOn,
          createdAt: new Date(t.createdAt ?? 0).toISOString(),
          participants: db.participants.filter((p) => p.tripId === t.id).length,
          cars: db.cars.filter((c) => c.tripId === t.id).length,
        }));
    },

    async adminDeleteTrip(key, email, code) {
      await tick();
      requireAdmin(key, email);
      const db = load();
      const trip = db.trips.find((t) => t.code === code);
      if (!trip) throw new ApiError('Voyage introuvable', 'not_found');
      removeTrip(db, trip.id);
      save(db);
    },
  };
}

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}
