import { useState } from 'react';
import { Link } from 'react-router-dom';
import carIcon from '../assets/figma/car.svg';
import check from '../assets/figma/check.svg';
import seatFree from '../assets/figma/seat-free.svg';
import seatIcon from '../assets/figma/seat.svg';
import seatMe from '../assets/figma/seat-me.svg';
import { carOf, formatDeparture } from '../lib/format';
import { freeSeats, freeSeatsLabel, placeSeats, seatCells, type SeatCell } from '../lib/seats';
import type { Car, Direction, Leg } from '../lib/types';
import { RdvSheet } from './RdvSheet';

interface Props {
  car: Car;
  meId: string;
  editHref: string;
  busyLegId: string | null;
  /** Sens dans lesquels j'ai déjà une place (dans n'importe quelle voiture). */
  myDirections: ReadonlySet<Direction>;
  /** Je conduis une voiture de ce voyage : pas de place passager pour moi. */
  iDrive: boolean;
  onTake: (leg: Leg) => void;
  onLeave: (leg: Leg) => void;
  /** Pour l'événement d'agenda du point de rendez-vous. */
  tripName: string;
  tripUrl: string;
}

export function CarCard({ car, meId, editHref, busyLegId, myDirections, iDrive, onTake, onLeave, tripName, tripUrl }: Props) {
  const mine = car.driver.id === meId;
  const carLabel = mine ? 'Ma voiture' : carOf(car.driver.name);
  const [rdvLeg, setRdvLeg] = useState<(Leg & { meetingPoint: string }) | null>(null);
  const aller = car.legs.find((leg) => leg.direction === 'aller');
  const rdv = aller?.meetingPoint ? { ...aller, meetingPoint: aller.meetingPoint } : null;
  return (
    <section className="car" aria-label={carOf(car.driver.name)}>
      <div className="car__header">
        {/* Petit saut de l'icône : il reste de la place (sauf dans ma voiture). */}
        <img
          className={!mine && freeSeats(car) > 0 ? 'car__icon car__icon--hop' : 'car__icon'}
          src={carIcon}
          alt=""
          width={24}
          height={24}
        />
        <div className="car__title-row">
          <div className="car__title-group">
            <h2 className="car__title">{carLabel}</h2>
            {mine && (
              <Link className="car__edit" to={editHref} aria-label="Modifier ma voiture">
                Modifier
              </Link>
            )}
          </div>
          {/* Sur la ligne du titre : le rendez-vous concerne le départ de la voiture. */}
          {rdv && (
            <button type="button" className="leg__rdv" onClick={() => setRdvLeg(rdv)} title={rdv.meetingPoint}>
              Point de RDV
            </button>
          )}
        </div>
      </div>
      <div className="car__legs">
        {car.legs.map((leg) => (
          <LegSeats
            key={leg.id}
            leg={leg}
            cells={seatCells(car, leg, meId, myDirections, iDrive)}
            busy={busyLegId === leg.id}
            onTake={() => onTake(leg)}
            onLeave={() => onLeave(leg)}
          />
        ))}
      </div>
      {rdvLeg && (
        <RdvSheet
          tripName={tripName}
          carLabel={carLabel}
          driverName={car.driver.name}
          leg={rdvLeg}
          tripUrl={tripUrl}
          onClose={() => setRdvLeg(null)}
        />
      )}
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
        <span className="leg__date">{formatDeparture(leg.departsAt)}</span>
      </div>
      <div
        className="seats"
        role="list"
        aria-label={`Places ${title.toLowerCase()}`}
      >
        {placeSeats(cells).map(({ cell, column, row }, i) => (
          <div role="listitem" key={i} className="seats__cell" style={{ gridColumn: column, gridRow: row }}>
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
          <img src={seatFree} alt="" />
          <span>{freeSeatsLabel(cell.count)}</span>
        </div>
      );
    case 'take':
      return (
        <button
          type="button"
          className="btn btn--primary"
          onClick={onTake}
          disabled={busy || cell.disabled}
          title={cell.disabled ? 'Vous avez déjà une place dans ce sens : libérez-la d\'abord' : undefined}
        >
          Prendre 1 place
        </button>
      );
    case 'full':
      return <p className="seat seat--full">Voiture pleine 😢</p>;
    case 'leave':
      return (
        <button type="button" className="btn btn--secondary" onClick={onLeave} disabled={busy}>
          Libérer ma place
        </button>
      );
  }
}
