import {
  ApiError,
  type Api,
  type CarInput,
  type Direction,
  type NewTrip,
  type TripState,
} from './types';

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
interface DbParticipant {
  id: string;
  tripId: string;
  /** Absent pour un organisateur qui ne l'a pas donné. */
  email: string | null;
  name: string;
  secret: string;
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

const KEY = 'cocovoit:demo-db';
const emptyDb = (): Db => ({ trips: [], participants: [], cars: [], legs: [], bookings: [] });

/** Page de gestion des voyages en mode démo : #/x/demo, avec l'adresse ci-dessous. */
export const DEMO_ADMIN_KEY = 'demo';
export const DEMO_ADMIN_EMAIL = 'demo@example.com';

export function createLocalApi(store: KeyValueStore, newId: () => string = () => crypto.randomUUID()): Api {
  // Horodatage strictement croissant, pour garder l'ordre des réservations.
  let last = 0;
  const now = () => (last = Math.max(Date.now(), last + 1));

  function load(): Db {
    const raw = store.getItem(KEY);
    return raw ? (JSON.parse(raw) as Db) : emptyDb();
  }
  function save(db: Db) {
    store.setItem(KEY, JSON.stringify(db));
  }
  function participant(db: Db, code: string, secret: string): DbParticipant {
    const trip = db.trips.find((t) => t.code === code);
    const me = trip && db.participants.find((p) => p.tripId === trip.id && p.secret === secret);
    if (!me) throw new ApiError('Accès refusé', 'forbidden');
    return me;
  }
  function removeMyBookings(db: Db, meId: string, direction: Direction) {
    db.bookings = db.bookings.filter((b) => {
      if (b.participantId !== meId) return true;
      const leg = db.legs.find((l) => l.id === b.legId);
      return leg?.direction !== direction;
    });
  }
  function requireAdmin(key: string, email: string) {
    if (key !== DEMO_ADMIN_KEY) throw new ApiError('Accès refusé', 'forbidden');
    if (email.trim().toLowerCase() !== DEMO_ADMIN_EMAIL) {
      throw new ApiError('Adresse email non autorisée', 'unauthorized_email');
    }
  }
  // Petite latence pour que l'appli se comporte comme avec un vrai serveur.
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  return {
    mode: 'demo',

    async createTrip(t: NewTrip) {
      await tick();
      const db = load();
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
      const secret = newId();
      db.trips.push(trip);
      db.participants.push({
        id: newId(),
        tripId: trip.id,
        email: t.organizerEmail.trim() || null,
        name: t.organizerName.trim() || 'Organisateur',
        secret,
        isOrganizer: true,
      });
      save(db);
      return { code: trip.code, secret };
    },

    async getTripPreview(code) {
      await tick();
      const trip = load().trips.find((t) => t.code === code);
      if (!trip) return null;
      const { code: c, name, destination, startsOn, endsOn } = trip;
      return { code: c, name, destination, startsOn, endsOn };
    },

    async myTrips(sessions) {
      await tick();
      const db = load();
      return db.trips
        .filter((t) =>
          sessions.some((s) => s.code === t.code && db.participants.some((p) => p.tripId === t.id && p.secret === s.secret)),
        )
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name))
        .map(({ code, name, startsOn, endsOn }) => ({ code, name, startsOn, endsOn }));
    },

    async joinTrip(code, email, name) {
      await tick();
      const db = load();
      const trip = db.trips.find((t) => t.code === code);
      if (!trip) throw new ApiError('Voyage introuvable', 'not_found');
      let p = db.participants.find(
        (x) => x.tripId === trip.id && x.email?.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!p) {
        if (!name?.trim()) return { status: 'needs_name' };
        p = { id: newId(), tripId: trip.id, email: email.trim(), name: name.trim(), secret: newId(), isOrganizer: false };
        db.participants.push(p);
        save(db);
      }
      return { status: 'ok', secret: p.secret, name: p.name };
    },

    async getTripState(code, secret): Promise<TripState> {
      await tick();
      const db = load();
      const me = participant(db, code, secret);
      const trip = db.trips.find((t) => t.id === me.tripId)!;
      const nameOf = (id: string) => db.participants.find((p) => p.id === id)!.name;
      return {
        trip: { code: trip.code, name: trip.name, destination: trip.destination, startsOn: trip.startsOn, endsOn: trip.endsOn },
        me: { id: me.id, name: me.name, isOrganizer: me.isOrganizer },
        cars: db.cars
          .filter((c) => c.tripId === trip.id)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((c) => ({
            id: c.id,
            seats: c.seats,
            driver: { id: c.driverId, name: nameOf(c.driverId) },
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
                  .map((b) => ({ id: b.participantId, name: nameOf(b.participantId) })),
              })),
          })),
      };
    },

    async saveCar(code, secret, input: CarInput) {
      await tick();
      const db = load();
      const me = participant(db, code, secret);
      if (input.legs.length === 0) throw new ApiError('Indiquez au moins un trajet', 'invalid');
      if (input.seats < 1 || input.seats > 8) throw new ApiError('Entre 1 et 8 places', 'invalid');

      let car: DbCar | undefined;
      if (input.carId) {
        car = db.cars.find((c) => c.id === input.carId && c.driverId === me.id);
        if (!car) throw new ApiError('Accès refusé', 'forbidden');
        car.seats = input.seats;
      } else {
        if (db.cars.some((c) => c.driverId === me.id)) throw new ApiError('Vous avez déjà une voiture', 'invalid');
        car = { id: newId(), tripId: me.tripId, driverId: me.id, seats: input.seats, createdAt: now() };
        db.cars.push(car);
      }
      const carId = car.id;

      for (const leg of input.legs) {
        removeMyBookings(db, me.id, leg.direction);
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

    async deleteCar(code, secret, carId) {
      await tick();
      const db = load();
      const me = participant(db, code, secret);
      if (!db.cars.some((c) => c.id === carId && c.driverId === me.id)) throw new ApiError('Accès refusé', 'forbidden');
      const legIds = new Set(db.legs.filter((l) => l.carId === carId).map((l) => l.id));
      db.cars = db.cars.filter((c) => c.id !== carId);
      db.legs = db.legs.filter((l) => !legIds.has(l.id));
      db.bookings = db.bookings.filter((b) => !legIds.has(b.legId));
      save(db);
    },

    async takeSeat(code, secret, legId) {
      await tick();
      const db = load();
      const me = participant(db, code, secret);
      const leg = db.legs.find((l) => l.id === legId);
      const car = leg && db.cars.find((c) => c.id === leg.carId);
      if (!leg || !car || car.tripId !== me.tripId) throw new ApiError('Trajet introuvable', 'not_found');
      if (car.driverId === me.id) throw new ApiError('Vous conduisez cette voiture', 'invalid');
      const drivesThisWay = db.cars.some(
        (c) => c.driverId === me.id && db.legs.some((l) => l.carId === c.id && l.direction === leg.direction),
      );
      if (drivesThisWay) throw new ApiError('Vous conduisez déjà sur ce trajet', 'invalid');

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

    async leaveSeat(code, secret, legId) {
      await tick();
      const db = load();
      const me = participant(db, code, secret);
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
      const carIds = new Set(db.cars.filter((c) => c.tripId === trip.id).map((c) => c.id));
      const legIds = new Set(db.legs.filter((l) => carIds.has(l.carId)).map((l) => l.id));
      db.trips = db.trips.filter((t) => t.id !== trip.id);
      db.participants = db.participants.filter((p) => p.tripId !== trip.id);
      db.cars = db.cars.filter((c) => !carIds.has(c.id));
      db.legs = db.legs.filter((l) => !legIds.has(l.id));
      db.bookings = db.bookings.filter((b) => !legIds.has(b.legId));
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
