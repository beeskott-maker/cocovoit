import type { ReactNode } from 'react';
import { routeUrl } from '../lib/maps';

export const GOOGLE_MAPS_TOOLTIP = 'Ouvrir dans Google Maps (nouvel onglet)';

/** Icône « s'ouvre dans un nouvel onglet ». */
export function NewTabIcon() {
  return (
    <svg className="new-tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h7v2H5v14h14v-7h2v7q0 .825-.587 1.413T19 21zm4.7-5.3l-1.4-1.4L17.6 5H14V3h7v7h-2V6.4z" />
    </svg>
  );
}

/** Lien vers le lieu dans Google Maps, nouvel onglet, avec info-bulle (ordinateur). */
export function GoogleMapsLink({ address, className, children }: { address: string; className: string; children: ReactNode }) {
  return (
    <a
      className={`${className} tooltip`}
      href={routeUrl('google', address)}
      target="_blank"
      rel="noreferrer"
      data-tooltip={GOOGLE_MAPS_TOOLTIP}
      aria-description={GOOGLE_MAPS_TOOLTIP}
    >
      {children}
    </a>
  );
}
