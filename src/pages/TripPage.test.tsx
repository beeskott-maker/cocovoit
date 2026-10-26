import { screen, within } from '@testing-library/react';
import { createTestApi, joinAs, onIphone, renderApp, seedTrip, signIn } from '../test/renderApp';

describe('Page voyage', () => {
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

  it('place à l’aller puis au retour : pop-in récapitulative', async () => {
    const api = createTestApi();
    const { code } = await seedTrip(api);
    signIn(await joinAs(api, code, 'julie@example.com', 'Julie'));
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

  it('voiture sans place libre : ni nombre de places ni « Complet » dans l’en-tête', async () => {
    const api = createTestApi();
    const { code, organizer, hugo } = await seedTrip(api); // voiture de Hugo, 2 places
    const state = await api.getTripState(hugo, code);
    for (const [i, leg] of state.cars[0].legs.entries()) {
      for (const email of [`a${i}@example.com`, `b${i}@example.com`]) {
        await api.takeSeat(await joinAs(api, code, email, 'Passager'), code, leg.id);
      }
    }
    signIn(organizer);
    renderApp(`/t/${code}`, api);
    const car = await screen.findByRole('region', { name: 'Voiture de Hugo' });
    expect(car.querySelector('.car__free')).toBeNull();
    expect(car).not.toHaveTextContent('Complet');
  });

  it('ordinateur : « Itinéraire » et l’adresse ouvrent directement Google Maps', async () => {
    const api = createTestApi();
    const { code, organizer } = await seedTrip(api);
    signIn(organizer);
    renderApp(`/t/${code}`, api);
    const route = await screen.findByRole('link', { name: 'Itinéraire' });
    expect(route).toHaveAttribute('href', expect.stringContaining('google.com/maps/search/?api=1&query=124%20Venelle'));
    expect(route).toHaveAttribute('target', '_blank');
    expect(route).toHaveAttribute('data-tooltip', 'Ouvrir dans Google Maps (nouvel onglet)');
    expect(screen.getByRole('link', { name: '124 Venelle de Brouilly 69460 Odenas' })).toHaveAttribute('href', route.getAttribute('href'));
  });

  it('mobile : « Itinéraire » propose les applis dans un panneau', async () => {
    onIphone();
    const api = createTestApi();
    const { code, organizer } = await seedTrip(api);
    signIn(organizer);
    const { user } = renderApp(`/t/${code}`, api);
    await user.click(await screen.findByRole('button', { name: 'Itinéraire' }));
    const sheet = screen.getByRole('dialog', { name: "Ouvrir l'itinéraire avec" });
    expect(
      within(sheet)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Waze', 'Google Maps', 'Apple Plans']);
    expect(within(sheet).getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
      'href',
      expect.stringContaining('query=124%20Venelle'),
    );

    await user.click(within(sheet).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Choisir une appli ouvre son lien et referme le panneau.
    await user.click(screen.getByRole('button', { name: 'Itinéraire' }));
    await user.click(screen.getByRole('link', { name: 'Google Maps' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

    // Ordinateur : lien direct après l'adresse, sans choix d'appli.
    expect(within(sheet).getByRole('link', { name: 'Itinéraire' })).toHaveAttribute('href', expect.stringContaining('Gare%20Part-Dieu'));
    expect(within(sheet).queryByRole('button', { name: 'Voir sur une carte' })).not.toBeInTheDocument();

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

  it('pop-in « C’est tout bon » : sans point de RDV, pas de ligne d’adresse', async () => {
    const api = createTestApi();
    const { code, hugo } = await seedTrip(api);
    const [car] = (await api.getTripState(hugo, code)).cars;
    await api.saveCar(hugo, code, {
      carId: car.id,
      seats: car.seats,
      legs: car.legs.map((l) => ({ direction: l.direction, departsAt: l.departsAt, meetingPoint: null })),
    });
    const julie = await joinAs(api, code, 'julie@example.com', 'Julie');
    await api.takeSeat(julie, code, car.legs[0].id);
    signIn(julie);
    const { user } = renderApp(`/t/${code}`, api);

    await user.click(await screen.findByRole('button', { name: 'Prendre 1 place' }));
    const aller = within(await screen.findByRole('dialog')).getByRole('region', { name: 'Aller' });
    expect(aller).not.toHaveTextContent('Gare Part-Dieu');
    expect(aller.querySelectorAll('.booked-leg__line')).toHaveLength(2); // voiture + agenda
    expect(within(aller).getByRole('link', { name: 'Ajouter à mon agenda' })).toBeInTheDocument();
  });

  it('suppression du voyage en échec : la pop-in se ferme et le message s’affiche', async () => {
    const api = createTestApi();
    const { code, organizer } = await seedTrip(api);
    vi.spyOn(api, 'deleteTrip').mockRejectedValueOnce(new Error('Connexion perdue'));
    signIn(organizer);
    const { user } = renderApp(`/t/${code}`, api);

    await user.click(await screen.findByRole('button', { name: 'Supprimer ce voyage' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Connexion perdue');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await api.myTrips(organizer)).toHaveLength(1);
  });

  it('mobile : « Point de RDV » propose les applis dans « Voir sur une carte », replié', async () => {
    onIphone();
    const api = createTestApi();
    const { code, organizer } = await seedTrip(api);
    signIn(organizer);
    const { user } = renderApp(`/t/${code}`, api);
    await user.click(await screen.findByRole('button', { name: 'Point de RDV' }));
    const sheet = screen.getByRole('dialog', { name: 'Point de rendez-vous' });
    expect(within(sheet).queryByRole('link', { name: 'Itinéraire' })).not.toBeInTheDocument();
    const toggle = within(sheet).getByRole('button', { name: 'Voir sur une carte' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(sheet).queryByRole('link', { name: 'Google Maps' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(within(sheet).getByRole('link', { name: 'Google Maps' })).toHaveAttribute('href', expect.stringContaining('Gare%20Part-Dieu'));
  });
});
