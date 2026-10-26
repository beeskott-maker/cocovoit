import { useState } from 'react';
import calendar from '../assets/figma/calendar-dark.svg';
import pin from '../assets/figma/pin-dark.svg';
import { addToDeviceCalendar, googleCalendarUrl, rdvEvent } from '../lib/calendar';
import { formatLongDeparture } from '../lib/format';
import { opensMapsDirectly } from '../lib/maps';
import type { Leg } from '../lib/types';
import { GoogleMapsLink, NewTabIcon } from './ExternalLink';
import { MapsOptions } from './MapsOptions';
import { Sheet } from './Sheet';

interface Props {
  tripName: string;
  /** « Ma voiture » ou « Voiture d'Hugo ». */
  carLabel: string;
  driverName: string;
  /** Trajet aller, avec un point de rendez-vous. */
  leg: Leg & { meetingPoint: string };
  tripUrl: string;
  onClose: () => void;
}

/** Point de rendez-vous : récapitulatif, carte (repliée) et ajout à l'agenda. */
export function RdvSheet({ tripName, carLabel, driverName, leg, tripUrl, onClose }: Props) {
  const [mapsOpen, setMapsOpen] = useState(false);
  const event = rdvEvent(tripName, driverName, leg, tripUrl);
  // Ordinateur : lien direct après l'adresse ; mobile : choix de l'appli, replié.
  const direct = opensMapsDirectly();

  return (
    <Sheet
      title="Point de rendez-vous"
      onClose={onClose}
      subtitle={
        <p className="sheet__context">
          Aller · {tripName} · {carLabel}
        </p>
      }
    >
      <div className="rdv-infos">
        <p className="rdv-info">
          <img src={calendar} alt="" width={20} height={20} />
          <span>{formatLongDeparture(leg.departsAt)}</span>
        </p>
        <p className="rdv-info">
          <img src={pin} alt="" width={20} height={20} />
          <span>
            {leg.meetingPoint}
            {direct && (
              <>
                {' '}
                <GoogleMapsLink address={leg.meetingPoint} className="rdv-maps-link">
                  Itinéraire
                  <NewTabIcon />
                </GoogleMapsLink>
              </>
            )}
          </span>
        </p>
      </div>
      {!direct && (
        <div className="disclosure">
          <button type="button" className="disclosure__toggle" aria-expanded={mapsOpen} onClick={() => setMapsOpen((o) => !o)}>
            Voir sur une carte
            <span className={mapsOpen ? 'disclosure__chevron disclosure__chevron--open' : 'disclosure__chevron'} aria-hidden="true" />
          </button>
          {mapsOpen && <MapsOptions address={leg.meetingPoint} onChoose={onClose} />}
        </div>
      )}
      <div className="rdv-calendar">
        <a className="btn btn--primary" href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
          Ajouter à mon agenda
        </a>
        {/* iPhone et iPad (Safari) : ouvre l'événement dans Calendrier ; ailleurs : télécharge le .ics. */}
        <button type="button" className="btn btn--text" onClick={() => addToDeviceCalendar(event, 'covoiturage-aller.ics')}>
          Autre agenda (fichier .ics)
        </button>
      </div>
      <button type="button" className="btn btn--text sheet__cancel" onClick={onClose}>
        Fermer
      </button>
    </Sheet>
  );
}
