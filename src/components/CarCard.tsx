import { Link } from 'react-router-dom';
import armchair from '../assets/figma/armchair.svg';
import carIcon from '../assets/figma/car.svg';
import check from '../assets/figma/check.svg';
import seatIcon from '../assets/figma/seat.svg';
import seatMe from '../assets/figma/seat-me.svg';
import { formatDeparture, mapsUrl } from '../lib/format';
import { freeSeats, seatCells, type SeatCell } from '../lib/seats';
import type { Car, Leg } from '../lib/types';

interface Props {
  car: Car;
  meId: string;
  editHref: string;
  busyLegId: string | null;
  onTake: (leg: Leg) => void;
  onLeave: (leg: Leg) => void;
}

export function CarCard({ car, meId, editHref, busyLegId, onTake, onLeave }: Props) {
  const mine = car.driver.id === meId;
  const free = freeSeats(car);
  return (
    <section className="car" aria-label={`Voiture de ${car.driver.name}`}>
      <div className="car__header">
        <img src={carIcon} alt="" width={24} height={24} />
        <div className="car__title-row">
          <h2 className="car__title">{mine ? 'Ma voiture' : `Voiture de ${car.driver.name}`}</h2>
          <span
            className={free > 0 ? 'car__free' : 'car__free car__free--none'}
            title={free > 0 ? `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}` : 'Complet'}
          >
            <img src={armchair} alt="" width={24} height={24} />
            {free}
            <span className="sr-only">{free > 1 ? 'places libres' : 'place libre'}</span>
          </span>
        </div>
        {mine && (
          <Link className="car__edit" to={editHref}>
            Modifier ma voiture
          </Link>
        )}
      </div>
      <div className="car__legs">
        {car.legs.map((leg) => (
          <LegSeats
            key={leg.id}
            leg={leg}
            cells={seatCells(car, leg, meId)}
            busy={busyLegId === leg.id}
            onTake={() => onTake(leg)}
            onLeave={() => onLeave(leg)}
          />
        ))}
      </div>
    </section>
  );
}

function LegSeats({
  leg,
  cells,
  busy,
  onTake,
  onLeave,
}: {
  leg: Leg;
  cells: SeatCell[];
  busy: boolean;
  onTake: () => void;
  onLeave: () => void;
}) {
  const title = leg.direction === 'aller' ? 'Aller' : 'Retour';
  return (
    <div className="leg">
      <div className="leg__header">
        <h3 className="leg__title">{title}</h3>
        <p className="leg__meta">
          {leg.direction === 'aller' && leg.meetingPoint && (
            <a href={mapsUrl(leg.meetingPoint)} target="_blank" rel="noreferrer" title={leg.meetingPoint}>
              Point de RDV
            </a>
          )}
          <span>{formatDeparture(leg.departsAt)}</span>
        </p>
      </div>
      <div
        className="seats"
        role="list"
        aria-label={`Places ${title.toLowerCase()}`}
      >
        {cells.map((cell, i) => (
          <div role="listitem" key={i} style={{ display: 'contents' }}>
            <Seat cell={cell} busy={busy} onTake={onTake} onLeave={onLeave} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Seat({ cell, busy, onTake, onLeave }: { cell: SeatCell; busy: boolean; onTake: () => void; onLeave: () => void }) {
  switch (cell.kind) {
    case 'occupied':
      return (
        <div className="seat seat--occupied">
          <img src={seatIcon} alt="" />
          <span className="seat__name">{cell.name}</span>
        </div>
      );
    case 'me':
      return (
        <div className="seat seat--me">
          <img src={seatMe} alt="" />
          <span>Moi</span>
          <img src={check} alt="" />
        </div>
      );
    case 'free':
      return (
        <div className="seat seat--free">
          <img src={seatIcon} alt="" />
          <span>Libre</span>
        </div>
      );
    case 'take':
      return (
        <button type="button" className="btn btn--primary" onClick={onTake} disabled={busy}>
          Prendre 1 place
        </button>
      );
    case 'leave':
      return (
        <button type="button" className="btn btn--secondary" onClick={onLeave} disabled={busy}>
          Libérer ma place
        </button>
      );
  }
}
