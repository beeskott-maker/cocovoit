import { screen, within } from '@testing-library/react';
import { DEMO_ADMIN_KEY } from '../lib/localApi';
import { createTestApi, renderApp, seedTrip } from '../test/renderApp';

describe('Page de gestion des voyages (#/x/<clé>)', () => {
  it('liste les voyages, permet de les ouvrir et de les supprimer après confirmation', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    await api.createTrip({
      name: 'Anniversaire',
      destination: 'Annecy',
      startsOn: '2026-12-05',
      endsOn: '2026-12-06',
      organizerName: 'Zoé',
      organizerEmail: 'zoe@example.com',
    });
    const { user } = renderApp(`/x/${DEMO_ADMIN_KEY}`, api);

    expect(await screen.findByText('2 voyages')).toBeInTheDocument();
    const we = screen.getByRole('article', { name: 'WE dans le Beaujolais' });
    expect(within(we).getByText(/2 participants · 1 voiture/)).toBeInTheDocument();
    expect(within(we).getByRole('link', { name: 'Ouvrir' })).toHaveAttribute('href', `/j/${code}`);

    // Annulation : rien n'est supprimé.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    await user.click(within(we).getByRole('button', { name: 'Supprimer' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Supprimer « WE dans le Beaujolais »'));
    expect(screen.getByRole('article', { name: 'WE dans le Beaujolais' })).toBeInTheDocument();

    // Confirmation : le voyage disparaît et son lien n'existe plus.
    confirm.mockReturnValueOnce(true);
    await user.click(within(we).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('1 voyage')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'WE dans le Beaujolais' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Anniversaire' })).toBeInTheDocument();
    expect(await api.getTripPreview(code)).toBeNull();
    confirm.mockRestore();
  });

  it('affiche « Lien introuvable » avec une mauvaise clé', async () => {
    const api = createTestApi();
    await seedTrip(api);
    renderApp('/x/mauvaise-cle', api);
    expect(await screen.findByRole('heading', { name: 'Lien introuvable' })).toBeInTheDocument();
    expect(screen.queryByText('WE dans le Beaujolais')).not.toBeInTheDocument();
  });
});
