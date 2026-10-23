import { useEffect } from 'react';

export const APP_TITLE = 'Coco·Voit';

/**
 * Titre de l'onglet : « nom du voyage · Coco·Voit » sur les pages d'un voyage,
 * « Coco·Voit · Authentification » sur la connexion, sinon « Coco·Voit ».
 * Sans titre (données pas encore chargées), on garde « Coco·Voit ».
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
