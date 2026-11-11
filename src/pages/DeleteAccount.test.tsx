import { screen, within } from '@testing-library/react';
import { createTestApi, renderApp, seedTrip, signIn } from '../test/renderApp';

describe('Suppression du compte', () => {
  it("transmet le voyage, demande l'email, puis ramène à l'accueil", async () => {
    const api = createTestApi();
    const { code, organizer, hugo } = await seedTrip(api);
    signIn(organizer);
    const { user } = renderApp('/voyages', api);

    await user.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Supprimer votre compte ?' });
    expect(await within(dialog).findByText(/Hugo devient l'organisateur/)).toBeInTheDocument();

    const confirm = within(dialog).getByRole('button', { name: 'Supprimer' });
    const field = within(dialog).getByLabelText('Retapez votre email pour confirmer');
    await user.type(field, 'hugo@example.com');
    expect(confirm).toBeDisabled();
    await user.clear(field);
    await user.type(field, ' LOIC@example.com ');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(await screen.findByRole('heading', { name: /sans la logistique/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Compte supprimé');
    // Le voyage reste, et Hugo en est l'organisateur.
    expect((await api.getTripState(hugo, code)).me.isOrganizer).toBe(true);
    await expect(api.me(organizer)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('un voyage où la personne est seule est supprimé ; son lien mène à la noix de coco', async () => {
    const api = createTestApi();
    const { organizer } = await seedTrip(api);
    const solo = await api.createTrip(organizer, { name: 'Solo', destination: '', startsOn: '2026-12-01', endsOn: '2026-12-02' });
    const preview = await api.accountDeletionPreview(organizer);
    expect(preview.deletedTrips).toEqual(['Solo']);
    await api.deleteAccount(organizer, 'loic@example.com');

    const other = await api.login('lea@example.com', 'Léa');
    signIn(other.status === 'ok' ? other.token : '');
    renderApp(`/t/${solo}`, api);
    expect(await screen.findByRole('heading', { name: 'Ce voyage est tombé du cocotier !' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes voyages' })).toHaveAttribute('href', '/voyages');
  });
});
