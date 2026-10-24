import { useCallback, useState } from 'react';
import applePlans from '../assets/maps/apple-plans.png';
import googleMaps from '../assets/maps/google-maps.png';
import waze from '../assets/maps/waze.png';
import { storageKey } from './env';

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

/** Liens universels : l'appli s'ouvre si elle est installée, sinon sa version web. */
export function routeUrl(app: MapsAppId, address: string): string {
  const q = encodeURIComponent(address);
  switch (app) {
    case 'waze':
      return `https://waze.com/ul?q=${q}&navigate=yes`;
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${q}`;
    case 'other':
      return `geo:0,0?q=${q}`;
  }
}

const KEY = storageKey('maps-app');

function readPreference(): MapsAppId | null {
  try {
    const id = localStorage.getItem(KEY);
    return id && id in APPS ? (id as MapsAppId) : null;
  } catch {
    return null;
  }
}

/** Appli choisie avec « Toujours utiliser cette application », mémorisée dans ce navigateur. */
export function useMapsPreference() {
  const [preference, setPreference] = useState<MapsAppId | null>(readPreference);
  const save = useCallback((id: MapsAppId | null) => {
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      // Stockage indisponible : le choix vaut pour cette visite seulement.
    }
    setPreference(id);
  }, []);
  return { preference, app: preference ? APPS[preference] : null, save };
}
