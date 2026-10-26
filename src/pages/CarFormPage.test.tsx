import { screen, within } from '@testing-library/react';
import { createTestApi, renderApp, seedTrip, signIn } from '../test/renderApp';

describe('Ma voiture', () => {
  it('le conducteur supprime sa voiture après confirmation, en voyant qui perd sa place', async () => {
    const api = createTestApi();
    const { code, organizer, hugo } = await seedTrip(api);
    const [car] = (await api.getTripState(hugo, code)).cars;
    await api.takeSeat(organizer, code, car.legs[0].id);

    signIn(hugo);
    const { user } = renderApp(`/t/${code}/voiture/${car.id}`, api);
    await user.click(await screen.findByRole('button', { name: 'Supprimer ma voiture' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer votre voiture ?' });
    expect(dialog).toHaveTextContent('Loïc perdra sa place et pourra en reprendre une dans une autre voiture.');
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('Votre voyage')).toBeInTheDocument();
    expect((await api.getTripState(hugo, code)).cars).toEqual([]);
  });

  it('au plus 6 places passagers par voiture', async () => {
    const api = createTestApi();
    const { code, organizer } = await seedTrip(api);
    signIn(organizer);
    const { user } = renderApp(`/t/${code}/voiture`, api);
    const plus = await screen.findByRole('button', { name: 'Une place de plus' });
    while (!(plus as HTMLButtonElement).disabled) await user.click(plus);
    expect(screen.getByRole('group', { name: 'Places dispos' })).toHaveTextContent('6');
    const legs = [{ direction: 'aller' as const, departsAt: '2026-10-10T07:00:00Z', meetingPoint: null }];
    await expect(api.saveCar(organizer, code, { carId: null, seats: 7, legs })).rejects.toThrow('Entre 1 et 6 places');
  });
});
