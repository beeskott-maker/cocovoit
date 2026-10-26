import { screen } from '@testing-library/react';
import { createTestApi, joinAs, loginAs, renderApp, seedTrip, signIn } from '../test/renderApp';

describe('« Mes voyages »', () => {
  it("« Mes voyages » vient du compte : voyages et rôles, sur n'importe quel appareil", async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    // Nouvel appareil : rien dans le navigateur, on se connecte avec son email.
    const { user } = renderApp('/', api);
    await user.type(await screen.findByLabelText('Mon email'), 'hugo@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    const link = await screen.findByRole('link', { name: /WE dans le Beaujolais/ });
    expect(link).toHaveAttribute('href', `/t/${code}`);
    expect(link).toHaveTextContent('Conducteur');
    expect(link).toHaveTextContent('sam 10 → lun 12 oct 2026');
  });

  it('avec des voyages : le formulaire se déplie sur « Créer un voyage » et se replie sur « Annuler »', async () => {
    const api = createTestApi();
    const { organizer } = await seedTrip(api);
    signIn(organizer);
    const { user } = renderApp('/', api);

    expect(await screen.findByRole('heading', { name: 'Mes voyages' })).toBeInTheDocument();
    expect(document.title).toBe('Coco·Voit · Mes voyages');
    // Organisateur prime sur conducteur et passager.
    expect(screen.getByRole('link', { name: /WE dans le Beaujolais/ })).toHaveTextContent('Organisateur');
    expect(screen.queryByRole('button', { name: 'Créer' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Créer un voyage' }));
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer un voyage' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('button', { name: 'Créer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer un voyage' })).toBeInTheDocument();
  });

  it('« Mes voyages » : sans organiser ni conduire, on est passager', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    signIn(await joinAs(api, code, 'lea@example.com', 'Léa'));
    const { user } = renderApp('/', api);
    const link = await screen.findByRole('link', { name: /WE dans le Beaujolais/ });
    expect(link).toHaveTextContent('Passager');
    expect(link).not.toHaveTextContent(/Conducteur|Organisateur/);

    // Pied de page : compte connecté et déconnexion.
    expect(screen.getByText('Connecté·e en tant que Léa')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(await screen.findByLabelText('Mon email')).toBeInTheDocument();
  });

  describe('à date fixe : lun 5 oct 2026', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 5, 12, 0));
    });
    afterEach(() => vi.useRealTimers());

    it('« Mes voyages » : compte à rebours, voyages passés à part', async () => {
      const api = createTestApi();
      const { organizer } = await seedTrip(api); // 10 → 12 oct
      await api.createTrip(organizer, { name: 'Pique-nique', destination: '', startsOn: '2026-09-01', endsOn: '2026-09-01' });
      signIn(organizer);
      renderApp('/', api);
      const link = await screen.findByRole('link', { name: /WE dans le Beaujolais/ });
      expect(link).toHaveTextContent('dans 5 jours');
      const past = screen.getByRole('region', { name: 'Passés' });
      expect(past).toHaveTextContent('Pique-nique');
      expect(screen.getByRole('link', { name: /Pique-nique/ }).querySelector('.trip-badge')).toBeNull();
    });

    it('« Mes voyages » : le plus proche en haut, et le plus récent en haut des passés', async () => {
      const api = createTestApi();
      const me = await loginAs(api, 'loic@example.com', 'Loïc');
      for (const [name, startsOn, endsOn] of [
        ['Loin', '2026-12-01', '2026-12-02'],
        ['Vieux', '2026-06-01', '2026-06-02'],
        ['Proche', '2026-10-10', '2026-10-11'],
        ['Récent', '2026-09-20', '2026-09-21'],
      ]) {
        await api.createTrip(me, { name, destination: '', startsOn, endsOn });
      }
      signIn(me);
      renderApp('/', api);
      await screen.findByRole('link', { name: /Proche/ });
      const names = (region: string) =>
        [...screen.getByRole('region', { name: region }).querySelectorAll('.trip-list__text')].map((el) => el.firstChild!.textContent);
      expect(names('Mes voyages')).toEqual(['Proche', 'Loin']);
      expect(names('Passés')).toEqual(['Récent', 'Vieux']);
    });
  });
});
