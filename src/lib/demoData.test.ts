import { loginAs } from '../test/renderApp';
import { createLocalApi, memoryStore } from './localApi';
import { demoTrips } from './demoData';
import { storageKey } from './env';

describe('Données de démo', () => {
  it('respectent les règles métier', () => {
    for (const t of demoTrips()) {
      expect(t.people).toContain(t.organizer);
      const drivers = t.cars.map((c) => c.driver);
      expect(new Set(drivers).size).toBe(drivers.length);
      for (const direction of ['aller', 'retour'] as const) {
        const passengers = t.cars.flatMap((c) => c.legs[direction]?.passengers ?? []);
        // Une place par sens, jamais conducteur et passager.
        expect(new Set(passengers).size).toBe(passengers.length);
        for (const p of passengers) {
          expect(t.people).toContain(p);
          expect(drivers).not.toContain(p);
        }
      }
      for (const c of t.cars) {
        for (const leg of Object.values(c.legs)) expect(leg.passengers.length).toBeLessThanOrEqual(c.seats);
      }
    }
  });

  it('environnement de test : la première connexion ajoute la personne aux voyages de démo', async () => {
    const api = createLocalApi(memoryStore(), undefined, { seedDemo: true });
    const token = await loginAs(api, 'test@example.com', 'Testeur');
    const trips = await api.myTrips(token);
    expect(trips.map((t) => t.name).sort()).toEqual(
      demoTrips()
        .map((t) => t.name)
        .sort(),
    );
    const annecy = trips.find((t) => t.name === 'Week-end à Annecy')!;
    expect(annecy).toMatchObject({ isOrganizer: true, isDriver: true, isPassenger: false });
    const state = await api.getTripState(token, annecy.code);
    expect(state.cars).toHaveLength(2);

    // Chaque nouveau compte a ses propres voyages de démo ; un compte existant non.
    expect(await api.myTrips(await loginAs(api, 'autre@example.com', 'Autre'))).toHaveLength(trips.length);
    expect(await api.myTrips(await loginAs(api, 'test@example.com', 'Testeur'))).toHaveLength(trips.length);
  });
});

describe('Données de démo : téléphones', () => {
  it('ma voiture à Annecy : des passagers joignables, et Sarah sans numéro', async () => {
    const api = createLocalApi(memoryStore(), undefined, { seedDemo: true });
    const token = await loginAs(api, 'test@example.com', 'Testeur');
    const annecy = (await api.myTrips(token)).find((t) => t.name === 'Week-end à Annecy')!;
    const state = await api.getTripState(token, annecy.code);
    const mine = state.cars.find((c) => c.driver.id === state.me.id)!;
    const phones = mine.legs.map((l) => l.passengers.map((p) => `${p.name} ${p.phone ?? '-'}`));
    expect(phones).toEqual([
      ['Julie Bernard +33639980002', 'Sarah Dubois-Lefebvre -'],
      ['Julie Bernard +33639980002', 'Camille Fontaine +33639980004'],
    ]);
  });

  it('ancienne base démo sans numéros : ajoutés aux personnes de démo', async () => {
    const store = memoryStore();
    const api = createLocalApi(store, undefined, { seedDemo: true });
    const token = await loginAs(api, 'test@example.com', 'Testeur');
    const key = storageKey('demo-db');
    const db = JSON.parse(store.getItem(key)!);
    for (const a of db.accounts) delete a.phone;
    store.setItem(key, JSON.stringify(db));
    const annecy = (await api.myTrips(token)).find((t) => t.name === 'Week-end à Annecy')!;
    const hugo = (await api.getTripState(token, annecy.code)).cars.find((c) => c.driver.name === 'Hugo Martin')!;
    expect(hugo.driver.phone).toBe('+33639980001');
  });
});
