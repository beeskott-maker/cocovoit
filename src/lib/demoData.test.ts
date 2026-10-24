import { localToday } from './format';
import { createLocalApi, memoryStore } from './localApi';
import { demoTrips } from './demoData';

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
    const r = await api.login('test@example.com', 'Testeur');
    if (r.status !== 'ok') throw new Error('connexion');
    const trips = await api.myTrips(r.token);
    expect(trips.map((t) => t.name).sort()).toEqual(demoTrips().map((t) => t.name).sort());
    const annecy = trips.find((t) => t.name === 'Week-end à Annecy')!;
    expect(annecy).toMatchObject({ isOrganizer: true, isDriver: true, isPassenger: false });
    const state = await api.getTripState(r.token, annecy.code);
    expect(state.cars).toHaveLength(2);

    // Le voyage complet part dans 2 jours.
    const raclette = trips.find((t) => t.name === 'Soirée raclette chez Hugo')!;
    expect(raclette.isFull).toBe(true);
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    expect(raclette.startsOn).toBe(localToday(inTwoDays));

    // Chaque nouveau compte a ses propres voyages de démo ; un compte existant non.
    const r2 = await api.login('autre@example.com', 'Autre');
    if (r2.status !== 'ok') throw new Error('connexion');
    expect(await api.myTrips(r2.token)).toHaveLength(trips.length);
    const again = await api.login('test@example.com');
    if (again.status !== 'ok') throw new Error('connexion');
    expect(await api.myTrips(again.token)).toHaveLength(trips.length);
  });
});
