import { useState } from 'react';
import calendar from '../assets/figma/calendar-dark.svg';
import pin from '../assets/figma/pin-dark.svg';
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '../lib/calendar';
import { formatLongDeparture } from '../lib/format';
import { isApple } from '../lib/maps';
import type { Leg } from '../lib/types';
import { MapsOptions } from './MapsOptions';
import { Sheet } from './Sheet';

interface Props {
  tripName: string;
  /** « Ma voiture » ou « Voiture de Hugo ». */
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
  const passengers = leg.passengers.map((p) => p.name);
  const event: CalendarEvent = {
    uid: `${leg.id}@cocovoit`,
    title: `Covoiturage aller · ${tripName}`,
    start: leg.departsAt,
    durationMinutes: 30,
    location: leg.meetingPoint,
    description: [
      `Conducteur : ${driverName}`,
      `Passagers : ${passengers.length ? passengers.join(', ') : 'aucun pour l’instant'}`,
      `Voyage : ${tripUrl}`,
    ].join('\n'),
    reminderMinutes: 60,
  };

  return (
    <Sheet
      title="Point de rendez-vous"
      onClose={onClose}
      subtitle={<p className="sheet__context">Aller · {tripName} · {carLabel}</p>}
    >
      <div className="rdv-infos">
        <p className="rdv-info">
          <img src={calendar} alt="" width={20} height={20} />
          {formatLongDeparture(leg.departsAt)}
        </p>
        <p className="rdv-info">
          <img src={pin} alt="" width={20} height={20} />
          {leg.meetingPoint}
        </p>
      </div>
      <div className="disclosure">
        <button type="button" className="disclosure__toggle" aria-expanded={mapsOpen} onClick={() => setMapsOpen((o) => !o)}>
          Voir sur une carte
          <span className={mapsOpen ? 'disclosure__chevron disclosure__chevron--open' : 'disclosure__chevron'} aria-hidden="true" />
        </button>
        {mapsOpen && <MapsOptions address={leg.meetingPoint} onChoose={onClose} />}
      </div>
      {isApple() ? (
        // iPhone, iPad, Mac : le fichier s'ouvre dans Calendrier.
        <button type="button" className="btn btn--primary" onClick={() => downloadIcs(event, 'covoiturage-aller.ics')}>
          Ajouter à mon agenda
        </button>
      ) : (
        <div className="rdv-calendar">
          <a className="btn btn--primary" href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
            Ajouter à mon agenda
          </a>
          <button type="button" className="btn btn--text" onClick={() => downloadIcs(event, 'covoiturage-aller.ics')}>
            Autre agenda (fichier .ics)
          </button>
        </div>
      )}
      <button type="button" className="btn btn--text sheet__cancel" onClick={onClose}>
        Fermer
      </button>
    </Sheet>
  );
}
