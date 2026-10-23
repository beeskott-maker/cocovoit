import { useEffect } from 'react';

export const APP_TITLE = 'CocoVoit';

/**
 * Titre de l'onglet : « nom du voyage · CocoVoit » sur les pages d'un voyage,
 * « CocoVoit · Authentification » sur la connexion, sinon « CocoVoit ».
 * Sans titre (données pas encore chargées), on garde « CocoVoit ».
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title || APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [title]);
}

export const tripTitle = (name: string | null | undefined) => (name ? `${name} · ${APP_TITLE}` : null);
export const AUTH_TITLE = `${APP_TITLE} · Authentification`;
