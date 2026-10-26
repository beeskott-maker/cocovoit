import { screen, within } from '@testing-library/react';
import { createTestApi, loginAs, renderApp, seedTrip, signIn } from '../test/renderApp';

describe('Parcours organisateur et conducteur', () => {
  it("s'identifie une fois, crée un voyage, affiche le lien puis ajoute sa voiture", async () => {
    const { user } = renderApp('/');

    // Pas encore identifié : on passe par l'identification avant de créer.
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

  it('« Mes voyages » vient du compte : voyages et rôles, sur n\'importe quel appareil', async () => {
    const api = createTestApi();
    const { code, hugo } = await seedTrip(api);
    // Nouvel appareil : rien dans le navigateur, on se connecte avec son email.
    const { user } = renderApp('/', api);
    await user.type(await screen.findByLabelText('Mon email'), 'hugo@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    const link = await screen.findByRole('link', { name: /WE dans le Beaujolais/ });
    expect(link).toHaveAttribute('href', `/t/${code}`);
    expect(link).toHaveTextContent('Conducteur');
    expect(link).toHaveTextContent('sam 10 → lun 12 oct 2026');
    expect(hugo).toBeTruthy();
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

  it("l'organisateur peut supprimer le voyage après confirmation, pas les participants", async () => {
    const api = createTestApi();
    const { code, organizer, hugo } = await seedTrip(api);

    signIn(hugo);
    const first = renderApp(`/t/${code}`, api);
    expect(await screen.findByText('Votre voyage')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer ce voyage' })).not.toBeInTheDocument();
    first.unmount();

    signIn(organizer);
    const { user } = renderApp(`/t/${code}`, api);
    const remove = await screen.findByRole('button', { name: 'Supprimer ce voyage' });
    await user.click(remove);
    let dialog = screen.getByRole('alertdialog', { name: 'Supprimer le voyage ?' });
    expect(dialog).toHaveTextContent('Le voyage « WE dans le Beaujolais » sera supprimé pour tous les participants');
    // Annuler a le focus : Entrée ne supprime rien.
    expect(within(dialog).getByRole('button', { name: 'Annuler' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await api.myTrips(organizer)).toHaveLength(1);

    // Échap ferme aussi sans supprimer.
    await user.click(remove);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(remove);
    dialog = screen.getByRole('alertdialog', { name: 'Supprimer le voyage ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('heading', { name: 'Créer un voyage' })).toBeInTheDocument();
    expect(await api.myTrips(organizer)).toEqual([]);
    expect(await api.myTrips(hugo)).toEqual([]);
  });

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

  it('place à l’aller puis au retour : pop-in récapitulative', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    const julie = await loginAs(api, 'julie@example.com', 'Julie');
    await api.joinTrip(julie, code);
    signIn(julie);
    const { user } = renderApp(`/t/${code}`, api);

    // Une seule place : simple message.
    const [takeAller] = await screen.findAllByRole('button', { name: 'Prendre 1 place' });
    await user.click(takeAller);
    expect(await screen.findByRole('status')).toHaveTextContent("Place réservée pour l'aller");
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // La place du retour complète : récapitulatif.
    await user.click(screen.getByRole('button', { name: 'Prendre 1 place' }));
    const dialog = await screen.findByRole('dialog', { name: "C'est tout bon, Julie !" });
    const aller = within(dialog).getByRole('region', { name: 'Aller' });
    expect(aller).toHaveTextContent('Voiture de Hugo');
    expect(aller).toHaveTextContent('Gare Part-Dieu');
    const add = within(aller).getByRole('link', { name: 'Ajouter à mon agenda' });
    expect(new URL(add.getAttribute('href')!).searchParams.get('text')).toBe('Covoiturage aller · WE dans le Beaujolais');
    const retour = within(dialog).getByRole('region', { name: 'Retour' });
    expect(retour).toHaveTextContent('Voiture de Hugo');
    expect(retour).not.toHaveTextContent('Ancien RDV retour');
    expect(within(retour).queryByRole('link')).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('Vous pourrez libérer vos places à tout moment');

    await user.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('« Mes voyages » : sans organiser ni conduire, on est passager', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    const lea = await loginAs(api, 'lea@example.com', 'Léa');
    await api.joinTrip(lea, code);
    signIn(lea);
    const { user } = renderApp('/', api);
    const link = await screen.findByRole('link', { name: /WE dans le Beaujolais/ });
    expect(link).toHaveTextContent('Passager');
    expect(link).not.toHaveTextContent(/Conducteur|Organisateur/);

    // Pied de page : compte connecté et déconnexion.
    expect(screen.getByText('Connecté·e en tant que Léa')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(await screen.findByLabelText('Mon email')).toBeInTheDocument();
  });

  it('« Mes voyages » : compte à rebours, voyages passés à part', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0)); // lun 5 oct 2026
    try {
      const api = createTestApi();
      const { organizer } = await seedTrip(api); // 10 → 12 oct
      const old = await api.createTrip(organizer, { name: 'Pique-nique', destination: '', startsOn: '2026-09-01', endsOn: '2026-09-01' });
      signIn(organizer);
      renderApp('/', api);
      const link = await screen.findByRole('link', { name: /WE dans le Beaujolais/ });
      expect(link).toHaveTextContent('dans 5 jours');
      const past = screen.getByRole('region', { name: 'Passés' });
      expect(past).toHaveTextContent('Pique-nique');
      expect(screen.getByRole('link', { name: /Pique-nique/ }).querySelector('.trip-badge')).toBeNull();
      expect(old).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('« Mes voyages » : le plus proche en haut, et le plus récent en haut des passés', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0));
    try {
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
    } finally {
      vi.useRealTimers();
    }
  });

  it('voiture sans place libre : ni nombre de places ni « Complet » dans l’en-tête', async () => {
    const api = createTestApi();
    const { code, organizer, hugo } = await seedTrip(api); // voiture de Hugo, 2 places
    const state = await api.getTripState(hugo, code);
    for (const [i, leg] of state.cars[0].legs.entries()) {
      for (const email of [`a${i}@example.com`, `b${i}@example.com`]) {
        const t = await loginAs(api, email, 'Passager');
        await api.joinTrip(t, code);
        await api.takeSeat(t, code, leg.id);
      }
    }
    signIn(organizer);
    renderApp(`/t/${code}`, api);
    const car = await screen.findByRole('region', { name: 'Voiture de Hugo' });
    expect(car.querySelector('.car__free')).toBeNull();
    expect(car).not.toHaveTextContent('Complet');
  });

  it('« Itinéraire » propose les applis dans un panneau', async () => {
    const api = createTestApi();
    const { code, organizer } = await seedTrip(api);
    signIn(organizer);
    const { user } = renderApp(`/t/${code}`, api);
    await user.click(await screen.findByRole('button', { name: 'Itinéraire' }));
    const sheet = screen.getByRole('dialog', { name: "Ouvrir l'itinéraire avec" });
    // Ordinateur (jsdom) : pas de Waze.
    expect(within(sheet).queryByRole('link', { name: 'Waze' })).not.toBeInTheDocument();
    const google = within(sheet).getByRole('link', { name: 'Google Maps' });
    expect(google).toHaveAttribute('href', expect.stringContaining('query=124%20Venelle'));
    expect(within(sheet).queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Choisir une appli ouvre son lien et referme le panneau.
    await user.click(screen.getByRole('button', { name: 'Itinéraire' }));
    await user.click(screen.getByRole('link', { name: 'Google Maps' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  it('« Point de RDV » : récapitulatif, carte repliée, ajout à l’agenda', async () => {
    const api = createTestApi();
    const { code, organizer } = await seedTrip(api);
    signIn(organizer);
    const { user } = renderApp(`/t/${code}`, api);
    await user.click(await screen.findByRole('button', { name: 'Point de RDV' }));
    const sheet = screen.getByRole('dialog', { name: 'Point de rendez-vous' });
    expect(sheet).toHaveTextContent('Aller · WE dans le Beaujolais · Voiture de Hugo');
    expect(sheet).toHaveTextContent('Gare Part-Dieu');
    expect(sheet).toHaveTextContent(/Samedi 10 octobre à \d+h00/);

    // « Voir sur une carte » est replié par défaut.
    const toggle = within(sheet).getByRole('button', { name: 'Voir sur une carte' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(sheet).queryByRole('link', { name: 'Google Maps' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(within(sheet).getByRole('link', { name: 'Google Maps' })).toHaveAttribute('href', expect.stringContaining('Gare%20Part-Dieu'));

    // Hors appareil Apple : Google Agenda pré-rempli, ou fichier .ics.
    const add = within(sheet).getByRole('link', { name: 'Ajouter à mon agenda' });
    expect(add).toHaveClass('btn--primary');
    const url = new URL(add.getAttribute('href')!);
    expect(url.searchParams.get('text')).toBe('Covoiturage aller · WE dans le Beaujolais');
    expect(url.searchParams.get('dates')).toBe('20261010T070000Z/20261010T073000Z');
    expect(url.searchParams.get('location')).toBe('Gare Part-Dieu');
    expect(within(sheet).getByRole('button', { name: 'Autre agenda (fichier .ics)' })).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
