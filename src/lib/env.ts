/**
 * Environnement de l'appli : « prod » par défaut, « dev » pour la version de
 * test publiée sous /dev/ (mode démo, données dans le navigateur).
 */
export const IS_DEV_ENV = import.meta.env.VITE_APP_ENV === 'dev';

// Prod et dev partagent l'origine github.io, donc le même localStorage :
// des clés distinctes évitent que l'une déconnecte ou écrase l'autre.
export const storageKey = (name: string) => `${IS_DEV_ENV ? 'cocovoit-dev' : 'cocovoit'}:${name}`;
