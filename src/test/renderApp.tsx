import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import { ApiContext } from '../lib/api';
import { storageKey } from '../lib/env';
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

/** Connexion (création du compte au besoin) : renvoie le jeton de session. */
export async function loginAs(api: Api, email: string, name: string): Promise<string> {
  const res = await api.login(email, name);
  if (res.status !== 'ok') throw new Error('login');
  return res.token;
}

/** Navigateur d'iPhone (jsdom se présente comme un ordinateur). */
export function onIphone() {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15');
}

/** Un participant de plus dans le voyage : renvoie son jeton. */
export async function joinAs(api: Api, code: string, email: string, name: string): Promise<string> {
  const token = await loginAs(api, email, name);
  await api.joinTrip(token, code);
  return token;
}

/** Ce navigateur est connecté avec ce jeton (comme après une connexion). */
export function signIn(token: string) {
  localStorage.setItem(storageKey('token'), token);
}

/** Un voyage organisé par Loïc, avec la voiture de Hugo (2 places, aller + retour). */
export async function seedTrip(api: Api) {
  const organizer = await loginAs(api, 'loic@example.com', 'Loïc');
  const code = await api.createTrip(organizer, {
    name: 'WE dans le Beaujolais',
    destination: '124 Venelle de Brouilly 69460 Odenas',
    startsOn: '2026-10-10',
    endsOn: '2026-10-12',
  });
  const hugo = await loginAs(api, 'hugo@example.com', 'Hugo');
  await api.joinTrip(hugo, code);
  await api.saveCar(hugo, code, {
    carId: null,
    seats: 2,
    legs: [
      { direction: 'aller', departsAt: '2026-10-10T07:00:00Z', meetingPoint: 'Gare Part-Dieu' },
      { direction: 'retour', departsAt: '2026-10-12T15:00:00Z', meetingPoint: 'Ancien RDV retour' },
    ],
  });
  return { code, organizer, hugo };
}
