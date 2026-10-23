import calendar from '../assets/figma/calendar.svg';
import globe from '../assets/figma/globe.svg';
import pin from '../assets/figma/pin.svg';
import share from '../assets/share-on-tertiary.svg';
import { directionsUrl, formatTripDates } from '../lib/format';
import type { TripPreview } from '../lib/types';

interface Props {
  trip: TripPreview;
  onShare: () => void;
}

export function TripHeader({ trip, onShare }: Props) {
  return (
    <header className="trip-header">
      <div className="trip-header__top">
        <div className="trip-header__titles">
          <p className="title-small">Votre voyage</p>
          <h1 className="title-large">{trip.name}</h1>
        </div>
        <button type="button" className="chip-go chip-go--tertiary" onClick={onShare} title="Copier le lien du voyage">
          <img src={share} alt="" width={20} height={20} />
          Partager
        </button>
      </div>
      <div>
        <div className="trip-header__row">
          <img src={calendar} alt="" width={13} height={13} />
          <p className="title-small">{formatTripDates(trip.startsOn, trip.endsOn)}</p>
        </div>
        <div className="trip-header__row">
          <img src={pin} alt="" width={11} height={13} />
          <p className="title-small">{trip.destination}</p>
          <a className="chip-go" href={directionsUrl(trip.destination)} target="_blank" rel="noreferrer">
            <img src={globe} alt="" width={20} height={20} />
            Go
          </a>
        </div>
      </div>
    </header>
  );
}
