import { screen } from '@testing-library/react';
import { createTestApi, renderApp, seedTrip } from '../test/renderApp';

describe("Parcours d'un invité (maquette Figma)", () => {
  it('email → nom → voyage, puis réservation d’une place', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    const { user } = renderApp(`/j/${code}`, api);

    expect(await screen.findByRole('heading', { name: /Rejoindre\s*WE dans le Beaujolais/ })).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Suivant' });
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText('Mon email'), 'loic.pelletier@gmail.com');
    expect(next).toBeEnabled();
    await user.click(next);

    // Email inconnu : on demande le nom, l'email est figé.
    const nameField = await screen.findByLabelText('Mon nom');
    expect(screen.getByLabelText('Mon email')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();
    await user.type(nameField, 'Lolo');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    // Écran du voyage
    expect(await screen.findByText('Votre voyage')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Voiture de Hugo' })).toBeInTheDocument();
    expect(screen.getByText('sam 10 → lun 12 oct 2026')).toBeInTheDocument();
    // Un seul lien « Point de RDV » : celui de l'aller.
    expect(screen.getByRole('link', { name: 'Point de RDV' })).toHaveAttribute(
      'href',
      expect.stringContaining('Gare%20Part-Dieu'),
    );

    // Partager : copie le lien d'invitation.
    await user.click(screen.getByRole('button', { name: 'Partager' }));
    expect(await navigator.clipboard.readText()).toMatch(new RegExp(`#/j/${code}$`));
    expect(screen.getByRole('status')).toHaveTextContent('Lien copié');

    const [takeAller] = screen.getAllByRole('button', { name: 'Prendre 1 place' });
    await user.click(takeAller);
    expect(await screen.findByText('Moi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Libérer ma place' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Place réservée pour l'aller");

    await user.click(screen.getByRole('button', { name: 'Libérer ma place' }));
    expect(await screen.findAllByRole('button', { name: 'Prendre 1 place' })).toHaveLength(2);
  });

  it('un email déjà connu entre directement dans le voyage', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    const { user } = renderApp(`/j/${code}`, api);
    await user.type(await screen.findByLabelText('Mon email'), 'hugo@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('heading', { name: 'Ma voiture' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prendre 1 place' })).not.toBeInTheDocument();
  });

  it('affiche une erreur pour un lien inconnu', async () => {
    renderApp('/j/inconnu');
    expect(await screen.findByRole('heading', { name: 'Lien introuvable' })).toBeInTheDocument();
  });
});
