import { act, screen } from '@testing-library/react';
import type { Api } from '../lib/types';
import { createTestApi, renderApp } from '../test/renderApp';

/** Compte créé en passant par le lien de vérification (API seule). */
async function verifiedLogin(api: Api, email: string, name: string): Promise<string> {
  const sent = await api.login(email);
  if (sent.status !== 'verification_sent') throw new Error(sent.status);
  const token = await api.demoVerificationToken!(sent.request);
  await api.verifyEmail(token!);
  const res = await api.login(email, name, null, sent.request);
  if (res.status !== 'ok') throw new Error(res.status);
  return res.token;
}

describe("Vérification de l'email", () => {
  it('adresse inconnue : lien envoyé, clic, puis nom et téléphone', async () => {
    const api = createTestApi({ emailVerification: true });
    const { user } = renderApp('/identification', api);
    await user.type(await screen.findByLabelText('Mon email'), 'lea@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(await screen.findByRole('heading', { name: 'Vérifiez vos emails' })).toBeInTheDocument();
    expect(screen.getByText('lea@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Renvoyer l'email \(dans \d+ s\)/ })).toBeDisabled();
    // Pas de compte tant que le lien n'est pas cliqué.
    expect((await api.login('lea@example.com', 'Léa')).status).toBe('verification_sent');

    // Clic sur le lien (simulé en démo).
    await user.click(await screen.findByRole('button', { name: 'Ouvrir le lien (démo)' }));
    expect(await screen.findByRole('heading', { name: 'Bienvenue !' })).toBeInTheDocument();
    expect(screen.getByText('✓ Email vérifié')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mon nom'), 'Léa');
    await user.click(screen.getByRole('button', { name: "C'est parti" }));
    expect(await screen.findByRole('heading', { name: 'Créer un voyage' })).toBeInTheDocument();
  });

  it("clic sur un autre appareil : l'écran d'attente se débloque", async () => {
    const api = createTestApi({ emailVerification: true });
    const { user } = renderApp('/identification', api);
    await user.type(await screen.findByLabelText('Mon email'), 'lea@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await screen.findByRole('heading', { name: 'Vérifiez vos emails' });

    // L'autre appareil ouvre le lien.
    const sent = await api.login('lea@example.com');
    if (sent.status !== 'verification_sent') throw new Error(sent.status);
    const token = await api.demoVerificationToken!(sent.request);
    expect((await api.verifyEmail(token!)).status).toBe('verified');

    expect(await screen.findByRole('heading', { name: "C'est vérifié !" }, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.type(await screen.findByLabelText('Mon nom'), 'Léa');
    await user.click(screen.getByRole('button', { name: "C'est parti" }));
    expect(await screen.findByRole('heading', { name: 'Créer un voyage' })).toBeInTheDocument();
  });

  it('adresse connue : connexion directe, sans email', async () => {
    const api = createTestApi({ emailVerification: true });
    await verifiedLogin(api, 'hugo@example.com', 'Hugo');
    const { user } = renderApp('/identification', api);
    await user.type(await screen.findByLabelText('Mon email'), 'hugo@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('heading', { name: 'Créer un voyage' })).toBeInTheDocument();
  });

  it("lien d'invitation : après la vérification, on rejoint le voyage", async () => {
    const api = createTestApi({ emailVerification: true });
    const organizer = await verifiedLogin(api, 'loic@example.com', 'Loïc');
    const code = await api.createTrip(organizer, { name: 'WE à la mer', destination: '', startsOn: '2026-12-01', endsOn: '2026-12-02' });
    const { user } = renderApp(`/j/${code}`, api);
    await user.type(await screen.findByLabelText('Mon email'), 'lea@example.com');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(await screen.findByRole('button', { name: 'Ouvrir le lien (démo)' }));
    await user.type(await screen.findByLabelText('Mon nom'), 'Léa');
    await user.click(screen.getByRole('button', { name: "C'est parti" }));
    expect(await screen.findByRole('heading', { name: 'WE à la mer' })).toBeInTheDocument();
  });

  it('lien expiré ou invalide', async () => {
    const api = createTestApi({ emailVerification: true });
    renderApp('/verifier/nimporte-quoi', api);
    expect(await screen.findByRole('heading', { name: "Ce lien n'est pas valide" })).toBeInTheDocument();
    await act(async () => undefined);
  });
});
