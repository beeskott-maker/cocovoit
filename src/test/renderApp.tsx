import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { ApiContext } from '../lib/api';
import { createLocalApi, memoryStore } from '../lib/localApi';
import type { Api } from '../lib/types';

export function createTestApi(): Api {
  return createLocalApi(memoryStore());
}

export function renderApp(path: string, api: Api = createTestApi()) {
  const user = userEvent.setup();
  const utils = render(
    <ApiContext.Provider value={api}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </MemoryRouter>
    </ApiContext.Provider>,
  );
  return { ...utils, user, api };
}

/** Un voyage avec la voiture de Hugo (2 places, aller + retour). */
export async function seedTrip(api: Api) {
  const { code, secret: organizer } = await api.createTrip({
    name: 'WE dans le Beaujolais',
    destination: '124 Venelle de Brouilly 69460 Odenas',
    startsOn: '2026-10-10',
    endsOn: '2026-10-12',
    organizerName: 'Loïc',
    organizerEmail: 'loic@example.com',
  });
  const hugo = await api.joinTrip(code, 'hugo@example.com', 'Hugo');
  if (hugo.status !== 'ok') throw new Error('seed');
  await api.saveCar(code, hugo.secret, {
    carId: null,
    seats: 2,
    legs: [
      { direction: 'aller', departsAt: '2026-10-10T07:00:00Z', meetingPoint: 'Gare Part-Dieu' },
      { direction: 'retour', departsAt: '2026-10-12T15:00:00Z', meetingPoint: null },
    ],
  });
  return { code, organizer, hugo: hugo.secret };
}
