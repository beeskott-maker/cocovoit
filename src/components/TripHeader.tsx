import calendar from '../assets/figma/calendar.svg';
import globe from '../assets/figma/globe-white.svg';
import pin from '../assets/figma/pin.svg';
import share from '../assets/figma/share-primary.svg';
import { formatTripDates } from '../lib/format';
import { opensMapsDirectly } from '../lib/maps';
import type { TripPreview } from '../lib/types';
import { GoogleMapsLink } from './ExternalLink';

interface Props {
  trip: TripPreview;
  onShare: () => void;
  /** Itinéraire vers la destination : choix de l'appli (mobile). Sur ordinateur, lien direct vers Google Maps. */
  onRoute: () => void;
}

export function TripHeader({ trip, onShare, onRoute }: Props) {
  const direct = opensMapsDirectly();
  return (
    <header className="trip-header">
      <div className="trip-header__titles">
        <p className="title-small">Votre voyage</p>
        <h1 className="title-large">{trip.name}</h1>
      </div>
      <div className="trip-header__infos">
        <div className="trip-header__row">
          <img src={calendar} alt="" width={13} height={13} />
          <p className="title-small">{formatTripDates(trip.startsOn, trip.endsOn)}</p>
        </div>
        {trip.destination && (
          <div className="trip-header__row">
            <img src={pin} alt="" width={11} height={13} />
            {direct ? (
              <GoogleMapsLink address={trip.destination} className="trip-header__address title-small">
                {trip.destination}
              </GoogleMapsLink>
            ) : (
              <button type="button" className="trip-header__address title-small" onClick={onRoute}>
                {trip.destination}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="trip-header__actions">
        {trip.destination &&
          (direct ? (
            <GoogleMapsLink address={trip.destination} className="header-btn header-btn--outline">
              <img src={globe} alt="" width={20} height={20} />
              Itinéraire
            </GoogleMapsLink>
          ) : (
            <button type="button" className="header-btn header-btn--outline" onClick={onRoute}>
              <img src={globe} alt="" width={20} height={20} />
              Itinéraire
            </button>
          ))}
        <button type="button" className="header-btn header-btn--filled" onClick={onShare} title="Copier le lien du voyage">
          <img src={share} alt="" width={20} height={20} />
          Partager
        </button>
      </div>
    </header>
  );
}
