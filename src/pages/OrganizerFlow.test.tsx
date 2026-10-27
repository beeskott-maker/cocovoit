import { screen } from '@testing-library/react';
import { createTestApi, loginAs, renderApp, signIn } from '../test/renderApp';

describe('Parcours organisateur', () => {
  it("s'identifie une fois, crée un voyage, affiche le lien puis ajoute sa voiture", async () => {
    const { user } = renderApp('/');

    // Visiteur : page de présentation, puis identification avant de créer.
    expect(await screen.findByRole('heading', { name: /sans la logistique/ })).toBeInTheDocument();
    await user.click(screen.getAllByRole('link', { name: 'Organiser un voyage' })[0]);
    expect(await screen.findByRole('heading', { name: 'Qui êtes-vous ?' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mon email'), 'loic@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.type(await screen.findByLabelText('Mon nom'), 'Loïc');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    // Formulaire de création, sans nom ni email.
    expect(await screen.findByRole('heading', { name: 'Créer un voyage' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Mon nom')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mon email')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Nom du voyage/), 'WE dans le Beaujolais');
    await user.type(screen.getByLabelText('Destination'), '124 Venelle de Brouilly 69460 Odenas');
    await user.type(screen.getByLabelText(/Départ le/), '2026-10-10');
    await user.type(screen.getByLabelText(/Retour le/), '2026-10-12');
    await user.click(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByRole('heading', { name: 'Voyage créé !' })).toBeInTheDocument();
    expect(screen.getByText(/#\/j\/[0-9a-f]{16}$/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Voir le voyage' }));

    expect(await screen.findByText("Personne n'a encore proposé de voiture.")).toBeInTheDocument();
    expect(screen.getByText(/Connecté·e en tant que/)).toHaveTextContent('Loïc');
    // Aucune voiture : bouton principal.
    expect(screen.getByRole('link', { name: 'Ajouter ma voiture' })).toHaveClass('btn--primary');
    await user.click(screen.getByRole('link', { name: 'Ajouter ma voiture' }));

    expect(await screen.findByRole('heading', { name: 'Ajouter ma voiture' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Une place de plus' }));
    // Point de RDV seulement pour l'aller.
    expect(screen.getAllByLabelText('Point de RDV')).toHaveLength(1);
    await user.click(screen.getByRole('checkbox', { name: 'Je fais le retour' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter ma voiture' }));

    expect(await screen.findByRole('heading', { name: 'Ma voiture' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aller' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Retour' })).not.toBeInTheDocument();
    expect(screen.getByText('4 places libres')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ajouter ma voiture' })).not.toBeInTheDocument();
  });

  it('déjà connecté : ne demande que le nom du voyage et les dates', async () => {
    const api = createTestApi();
    signIn(await loginAs(api, 'loic@example.com', 'Loïc'));
    const { user, container } = renderApp('/', api);

    // Astérisque rouge sur les trois champs obligatoires, et eux seuls.
    expect(await screen.findByRole('heading', { name: 'Créer un voyage' })).toBeInTheDocument();
    const requiredLabels = [...container.querySelectorAll('.text-field__required')].map((el) =>
      el.parentElement!.textContent!.replace('*', '').trim(),
    );
    expect(requiredLabels).toEqual(['Nom du voyage', 'Départ le', 'Retour le']);
    expect(screen.getByLabelText(/Nom du voyage/)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Destination')).not.toHaveAttribute('aria-required');

    const create = screen.getByRole('button', { name: 'Créer' });
    await user.type(screen.getByLabelText(/Nom du voyage/), 'Pique-nique');
    await user.type(screen.getByLabelText(/Départ le/), '2026-11-01');
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText(/Retour le/), '2026-11-01');
    await user.click(create);

    expect(await screen.findByRole('heading', { name: 'Voyage créé !' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Voir le voyage' }));
    expect(await screen.findByRole('heading', { name: 'Pique-nique' })).toBeInTheDocument();
    // Sans destination : ni adresse ni bouton Itinéraire. L'organisateur est la personne identifiée.
    expect(screen.queryByRole('button', { name: 'Itinéraire' })).not.toBeInTheDocument();
    expect(screen.getByText(/Connecté·e en tant que/)).toHaveTextContent('Loïc');
  });
});
