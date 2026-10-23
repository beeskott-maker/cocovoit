import { createTestApi, seedTrip } from '../test/renderApp';
import { ApiError } from './types';

async function join(api: ReturnType<typeof createTestApi>, code: string, email: string, name: string) {
  const r = await api.joinTrip(code, email, name);
  if (r.status !== 'ok') throw new Error('join');
  return r.secret;
}

describe('API démo (mêmes règles que les fonctions SQL)', () => {
  it('demande le nom uniquement pour un nouvel email', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    expect(await api.joinTrip(code, 'new@example.com')).toEqual({ status: 'needs_name' });
    const hugo = await api.joinTrip(code, 'HUGO@example.com');
    expect(hugo).toMatchObject({ status: 'ok', name: 'Hugo' });
  });

  it('refuse un secret invalide', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    await expect(api.getTripState(code, 'faux')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('respecte le nombre de places et une place par sens', async () => {
    const api = createTestApi();
    const { code, hugo } = await seedTrip(api);
    const lea = await join(api, code, 'lea@example.com', 'Léa');
    const max = await join(api, code, 'max@example.com', 'Max');
    const zoe = await join(api, code, 'zoe@example.com', 'Zoé');

    let st = await api.getTripState(code, lea);
    const aller = st.cars[0].legs[0];
    expect(aller.direction).toBe('aller');
    await api.takeSeat(code, lea, aller.id);
    await api.takeSeat(code, max, aller.id);
    await expect(api.takeSeat(code, zoe, aller.id)).rejects.toBeInstanceOf(ApiError);
    await expect(api.takeSeat(code, hugo, aller.id)).rejects.toMatchObject({ code: 'invalid' });

    // Zoé propose sa voiture, Léa y change de place à l'aller.
    await api.saveCar(code, zoe, {
      carId: null,
      seats: 3,
      legs: [{ direction: 'aller', departsAt: '2026-10-10T06:00:00Z', meetingPoint: null }],
    });
    st = await api.getTripState(code, lea);
    await api.takeSeat(code, lea, st.cars[1].legs[0].id);
    st = await api.getTripState(code, lea);
    expect(st.cars[0].legs[0].passengers.map((p) => p.name)).toEqual(['Max']);
    expect(st.cars[1].legs[0].passengers.map((p) => p.name)).toEqual(['Léa']);
  });

  it('réduire les places retire les dernières réservations, supprimer un trajet aussi', async () => {
    const api = createTestApi();
    const { code, hugo } = await seedTrip(api);
    const lea = await join(api, code, 'lea@example.com', 'Léa');
    const max = await join(api, code, 'max@example.com', 'Max');
    let st = await api.getTripState(code, hugo);
    const [aller, retour] = st.cars[0].legs;
    await api.takeSeat(code, lea, aller.id);
    await api.takeSeat(code, max, aller.id);
    await api.takeSeat(code, lea, retour.id);

    await api.saveCar(code, hugo, {
      carId: st.cars[0].id,
      seats: 1,
      legs: [{ direction: 'aller', departsAt: aller.departsAt, meetingPoint: 'Bellecour' }],
    });
    st = await api.getTripState(code, hugo);
    expect(st.cars[0].legs).toHaveLength(1);
    expect(st.cars[0].legs[0]).toMatchObject({ meetingPoint: 'Bellecour', passengers: [{ name: 'Léa' }] });

    await expect(api.deleteCar(code, lea, st.cars[0].id)).rejects.toMatchObject({ code: 'forbidden' });
    await api.deleteCar(code, hugo, st.cars[0].id);
    expect((await api.getTripState(code, hugo)).cars).toEqual([]);
  });
});
