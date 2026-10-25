import applePlans from '../assets/maps/apple-plans.png';
import googleMaps from '../assets/maps/google-maps.png';
import waze from '../assets/maps/waze.png';

/** Applis d'itinéraire proposées. « other » : menu Android « Ouvrir avec… ». */
export type MapsAppId = 'waze' | 'google' | 'apple' | 'other';

export interface MapsApp {
  id: MapsAppId;
  name: string;
  icon: string | null;
  hint?: string;
}

const APPS: Record<MapsAppId, MapsApp> = {
  waze: { id: 'waze', name: 'Waze', icon: waze },
  google: { id: 'google', name: 'Google Maps', icon: googleMaps },
  apple: { id: 'apple', name: 'Apple Plans', icon: applePlans },
  other: { id: 'other', name: 'Autre application', icon: null, hint: 'apps installées' },
};

// iPadOS se présente comme un Mac : « Macintosh » couvre les deux.
const isApple = (ua: string) => /iPhone|iPad|iPod|Macintosh/.test(ua);
const isAndroid = (ua: string) => /Android/.test(ua);

/** Apple Plans seulement sur les appareils Apple, « Autre application » seulement sur Android. */
export function mapsApps(ua = navigator.userAgent): MapsApp[] {
  const list = [APPS.waze, APPS.google];
  if (isApple(ua)) list.push(APPS.apple);
  if (isAndroid(ua)) list.push(APPS.other);
  return list;
}

/**
 * Liens universels vers le lieu (pas le guidage) : l'appli s'ouvre sur l'adresse
 * si elle est installée, sinon sa version web.
 */
export function routeUrl(app: MapsAppId, address: string): string {
  const q = encodeURIComponent(address);
  switch (app) {
    case 'waze':
      return `https://waze.com/ul?q=${q}`;
    case 'google':
      return `https://www.google.com/maps/search/?api=1&query=${q}`;
    case 'apple':
      return `https://maps.apple.com/?q=${q}`;
    case 'other':
      return `geo:0,0?q=${q}`;
  }
}
