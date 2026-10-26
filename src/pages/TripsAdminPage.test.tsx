import { screen, within } from '@testing-library/react';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_KEY } from '../lib/localApi';
import { createTestApi, loginAs, renderApp, seedTrip } from '../test/renderApp';

describe('Page de gestion des voyages (#/x/<clé>)', () => {
  it('liste les voyages, permet de les ouvrir et de les supprimer après confirmation', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    await api.createTrip(await loginAs(api, 'zoe@example.com', 'Zoé'), {
      name: 'Anniversaire',
      destination: 'Annecy',
      startsOn: '2026-12-05',
      endsOn: '2026-12-06',
    });
    const { user } = renderApp(`/x/${DEMO_ADMIN_KEY}`, api);

    // Authentification par adresse email.
    expect(await screen.findByRole('heading', { name: 'Accès réservé' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mon email'), DEMO_ADMIN_EMAIL);
    await user.click(screen.getByRole('button', { name: 'Accéder' }));

    expect(await screen.findByText('2 voyages')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un voyage' })).toHaveAttribute('href', '/');
    const we = screen.getByRole('article', { name: 'WE dans le Beaujolais' });
    expect(within(we).getByText(/2 participants · 1 voiture/)).toBeInTheDocument();
    expect(within(we).getByRole('link', { name: 'Ouvrir' })).toHaveAttribute('href', `/j/${code}`);

    // Annulation : rien n'est supprimé.
    await user.click(within(we).getByRole('button', { name: 'Supprimer' }));
    let dialog = screen.getByRole('alertdialog', { name: 'Supprimer « WE dans le Beaujolais » ?' });
    expect(dialog).toHaveTextContent('2 participants');
    expect(dialog).toHaveTextContent('1 voiture');
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'WE dans le Beaujolais' })).toBeInTheDocument();

    // Confirmation : le voyage disparaît et son lien n'existe plus.
    await user.click(within(we).getByRole('button', { name: 'Supprimer' }));
    dialog = screen.getByRole('alertdialog', { name: 'Supprimer « WE dans le Beaujolais » ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('1 voyage')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'WE dans le Beaujolais' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Anniversaire' })).toBeInTheDocument();
    expect(await api.getTripPreview(code)).toBeNull();

    // L'adresse est mémorisée jusqu'à la déconnexion.
    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(screen.getByRole('heading', { name: 'Accès réservé' })).toBeInTheDocument();
  });

  it('refuse une autre adresse avec un message clair', async () => {
    const api = createTestApi();
    await seedTrip(api);
    const { user } = renderApp(`/x/${DEMO_ADMIN_KEY}`, api);
    await user.type(await screen.findByLabelText('Mon email'), 'pirate@example.com');
    await user.click(screen.getByRole('button', { name: 'Accéder' }));
    expect(await screen.findByText(/L'adresse pirate@example\.com n'est pas autorisée à accéder à cette page/)).toBeInTheDocument();
    expect(screen.getByLabelText('Mon email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('WE dans le Beaujolais')).not.toBeInTheDocument();
  });

  it("se souvient de l'adresse au retour sur la page", async () => {
    const api = createTestApi();
    await seedTrip(api);
    localStorage.setItem('cocovoit:admin-email', DEMO_ADMIN_EMAIL);
    renderApp(`/x/${DEMO_ADMIN_KEY}`, api);
    expect(await screen.findByText('1 voyage')).toBeInTheDocument();
  });

  it('affiche « Lien introuvable » avec une mauvaise clé, sans formulaire', async () => {
    const api = createTestApi();
    await seedTrip(api);
    renderApp('/x/mauvaise-cle', api);
    expect(await screen.findByRole('heading', { name: 'Lien introuvable' })).toBeInTheDocument();
    expect(screen.queryByText('WE dans le Beaujolais')).not.toBeInTheDocument();
  });
});
