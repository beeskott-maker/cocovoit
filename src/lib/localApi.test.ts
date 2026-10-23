import { createTestApi, loginAs, seedTrip } from '../test/renderApp';
import { ApiError } from './types';

async function join(api: ReturnType<typeof createTestApi>, code: string, email: string, name: string) {
  const token = await loginAs(api, email, name);
  await api.joinTrip(token, code);
  return token;
}

describe('API démo (mêmes règles que les fonctions SQL)', () => {
  it('connexion : nom demandé uniquement pour un nouvel email', async () => {
    const api = createTestApi();
    await seedTrip(api);
    expect(await api.login('new@example.com')).toEqual({ status: 'needs_name' });
    const hugo = await api.login(' HUGO@example.com ');
    expect(hugo).toMatchObject({ status: 'ok', account: { email: 'hugo@example.com', name: 'Hugo' } });
  });

  it('refuse une session inconnue ou fermée, et un compte hors du voyage', async () => {
    const api = createTestApi();
    const { code, hugo } = await seedTrip(api);
    await expect(api.getTripState('faux', code)).rejects.toMatchObject({ code: 'unauthenticated' });
    const lea = await loginAs(api, 'lea@example.com', 'Léa');
    await expect(api.getTripState(lea, code)).rejects.toMatchObject({ code: 'forbidden' });
    await api.logout(hugo);
    await expect(api.me(hugo)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('« Mes voyages » : voyages du compte avec ses rôles', async () => {
    const api = createTestApi();
    const { code, organizer, hugo } = await seedTrip(api);
    const lea = await join(api, code, 'lea@example.com', 'Léa');
    await api.takeSeat(lea, code, (await api.getTripState(lea, code)).cars[0].legs[0].id);
    expect(await api.myTrips(organizer)).toMatchObject([{ code, isOrganizer: true, isDriver: false, isPassenger: false }]);
    expect(await api.myTrips(hugo)).toMatchObject([{ code, isOrganizer: false, isDriver: true }]);
    expect(await api.myTrips(lea)).toMatchObject([{ code, isPassenger: true }]);
  });

  it('respecte le nombre de places et une place par sens', async () => {
    const api = createTestApi();
    const { code, hugo } = await seedTrip(api);
    const lea = await join(api, code, 'lea@example.com', 'Léa');
    const max = await join(api, code, 'max@example.com', 'Max');
    const zoe = await join(api, code, 'zoe@example.com', 'Zoé');

    let st = await api.getTripState(lea, code);
    const aller = st.cars[0].legs[0];
    expect(aller.direction).toBe('aller');
    await api.takeSeat(lea, code, aller.id);
    await api.takeSeat(max, code, aller.id);
    await expect(api.takeSeat(zoe, code, aller.id)).rejects.toBeInstanceOf(ApiError);
    await expect(api.takeSeat(hugo, code, aller.id)).rejects.toMatchObject({ code: 'invalid' });

    // Zoé a une place au retour chez Hugo, puis propose sa voiture (aller) :
    // un conducteur n'est jamais passager, sa place au retour est libérée.
    await api.takeSeat(zoe, code, st.cars[0].legs[1].id);

    // Zoé propose sa voiture. Léa, déjà à l'aller chez Hugo, doit libérer sa
    // place avant d'en prendre une à l'aller chez Zoé.
    await api.saveCar(zoe, code, {
      carId: null,
      seats: 3,
      legs: [{ direction: 'aller', departsAt: '2026-10-10T06:00:00Z', meetingPoint: null }],
    });
    st = await api.getTripState(lea, code);
    expect(st.cars[0].legs[1].passengers).toEqual([]);
    await expect(api.takeSeat(zoe, code, st.cars[0].legs[1].id)).rejects.toMatchObject({ code: 'invalid' });
    await expect(api.takeSeat(lea, code, st.cars[1].legs[0].id)).rejects.toMatchObject({ code: 'invalid' });
    await api.leaveSeat(lea, code, st.cars[0].legs[0].id);
    await api.takeSeat(lea, code, st.cars[1].legs[0].id);
    st = await api.getTripState(lea, code);
    expect(st.cars[0].legs[0].passengers.map((p) => p.name)).toEqual(['Max']);
    expect(st.cars[1].legs[0].passengers.map((p) => p.name)).toEqual(['Léa']);
  });

  it('réduire les places retire les dernières réservations, supprimer un trajet aussi', async () => {
    const api = createTestApi();
    const { code, hugo } = await seedTrip(api);
    const lea = await join(api, code, 'lea@example.com', 'Léa');
    const max = await join(api, code, 'max@example.com', 'Max');
    let st = await api.getTripState(hugo, code);
    const [aller, retour] = st.cars[0].legs;
    await api.takeSeat(lea, code, aller.id);
    await api.takeSeat(max, code, aller.id);
    await api.takeSeat(lea, code, retour.id);

    await api.saveCar(hugo, code, {
      carId: st.cars[0].id,
      seats: 1,
      legs: [{ direction: 'aller', departsAt: aller.departsAt, meetingPoint: 'Bellecour' }],
    });
    st = await api.getTripState(hugo, code);
    expect(st.cars[0].legs).toHaveLength(1);
    expect(st.cars[0].legs[0]).toMatchObject({ meetingPoint: 'Bellecour', passengers: [{ name: 'Léa' }] });

    await expect(api.deleteCar(lea, code, st.cars[0].id)).rejects.toMatchObject({ code: 'forbidden' });
    await api.deleteCar(hugo, code, st.cars[0].id);
    expect((await api.getTripState(hugo, code)).cars).toEqual([]);
  });
});
