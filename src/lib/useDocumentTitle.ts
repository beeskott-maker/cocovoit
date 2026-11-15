import { useEffect } from 'react';
import { IS_DEV_ENV } from './env';

export const APP_TITLE = IS_DEV_ENV ? 'Coco·voit DEV' : 'Coco·voit';

/**
 * Titre de l'onglet : « nom du voyage · Coco·voit » sur les pages d'un voyage,
 * « Coco·voit · Authentification » sur la connexion, sinon « Coco·voit ».
 * Sans titre (données pas encore chargées), on garde « Coco·voit ».
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
