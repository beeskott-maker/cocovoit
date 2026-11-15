import { vi } from 'vitest';
import { shareInvite } from './share';

describe('partage du lien d’invitation', () => {
  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
  });

  it('ouvre le menu de partage avec le nom du voyage dans le message', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    expect(await shareInvite('Week-end Annecy', 'https://cocovoiturage.fr/#/j/abc')).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      text: "Rejoins « Week-end Annecy » sur Coco·voit pour t'organiser en covoiturage 🚗",
      url: 'https://cocovoiturage.fr/#/j/abc',
    });
  });

  it('partage annulé : rien d’autre à faire', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('', 'AbortError')) });
    expect(await shareInvite('X', 'u')).toBe('shared');
  });

  it('sans menu de partage ou partage refusé : copier le lien', async () => {
    expect(await shareInvite('X', 'u')).toBe('unavailable');
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')) });
    expect(await shareInvite('X', 'u')).toBe('unavailable');
  });
});
