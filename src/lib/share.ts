/** Message d'invitation : le nom du voyage s'affiche dans la conversation, au-dessus de l'aperçu du lien. */
export function inviteText(tripName: string): string {
  return `Rejoins « ${tripName} » sur Coco·voit pour t'organiser en covoiturage 🚗`;
}

/**
 * Ouvre le menu de partage du téléphone avec le message d'invitation et le lien.
 * Renvoie 'shared' (partagé ou annulé par l'utilisateur) ou 'unavailable'
 * (navigateur sans menu de partage, ou partage refusé) : copier le lien à la place.
 */
export async function shareInvite(tripName: string, url: string): Promise<'shared' | 'unavailable'> {
  if (typeof navigator.share !== 'function') return 'unavailable';
  try {
    await navigator.share({ text: inviteText(tripName), url });
    return 'shared';
  } catch (err) {
    return err instanceof DOMException && err.name === 'AbortError' ? 'shared' : 'unavailable';
  }
}
