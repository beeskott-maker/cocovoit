/**
 * Nouvelle version de l'appli : rechargement automatique.
 *
 * Le service worker sert l'appli depuis son cache (pour marcher sans réseau) et
 * récupère la nouvelle version en arrière-plan. Sans rien faire, elle ne
 * s'afficherait qu'à la visite suivante. Ici, dès que la nouvelle version prend
 * la main, la page se recharge. Si l'on a commencé à remplir un formulaire sur
 * l'écran en cours, le rechargement attend le changement d'écran, pour ne rien perdre.
 *
 * L'appli installée reste souvent ouverte en arrière-plan : à chaque retour au
 * premier plan, on vérifie s'il existe une nouvelle version.
 */
export function reloadOnNewVersion(win: Window = window) {
  const sw = win.navigator.serviceWorker;
  if (!sw) return;
  // Première visite : le service worker qui s'installe prend la main sans
  // remplacer aucune version, pas besoin de recharger.
  let controlled = !!sw.controller;

  let reloading = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    win.location.reload();
  };

  // Saisie sur l'écran en cours (oubliée au changement d'écran).
  let edited = false;
  win.document.addEventListener('input', () => (edited = true), true);

  let pending = false;
  win.addEventListener('hashchange', () => {
    if (pending) reload();
    edited = false;
  });

  sw.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    if (edited) pending = true;
    else reload();
  });

  win.document.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState !== 'visible') return;
    void sw
      .getRegistration()
      .then((reg) => reg?.update())
      .catch(() => undefined);
  });
}
