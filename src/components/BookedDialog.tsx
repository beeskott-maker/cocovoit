import { useEffect, useId } from 'react';
import carIcon from '../assets/figma/car-dark.svg';
import calendarIcon from '../assets/figma/calendar-dark-padded.svg';
import pin from '../assets/figma/pin-dark.svg';
import { googleCalendarUrl, rdvEvent } from '../lib/calendar';
import { formatDeparture } from '../lib/format';
import type { Car, Direction, Leg, TripState } from '../lib/types';

/** Mes places, par sens, avec la voiture correspondante. */
function myLegs(state: TripState): Partial<Record<Direction, { car: Car; leg: Leg }>> {
  const result: Partial<Record<Direction, { car: Car; leg: Leg }>> = {};
  for (const car of state.cars) {
    for (const leg of car.legs) {
      if (leg.passengers.some((p) => p.id === state.me.id)) result[leg.direction] = { car, leg };
    }
  }
  return result;
}

interface Props {
  state: TripState;
  tripUrl: string;
  onClose: () => void;
}

/** Pop-in affichée quand on vient d'avoir une place à l'aller et au retour. */
export function BookedDialog({ state, tripUrl, onClose }: Props) {
  const titleId = useId();
  const legs = myLegs(state);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="confirm-layer">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="confirm" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="confirm__icon confirm__icon--success" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.55 18l-5.7-5.7 1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z" />
          </svg>
        </div>
        <h2 id={titleId} className="confirm__title">
          C'est tout bon, {state.me.name} !
        </h2>
        <div className="confirm__text">
          <p>Vous avez une place à l'aller et au retour.</p>
          <div className="booked-legs">
            {(['aller', 'retour'] as const).map((direction) => {
              const mine = legs[direction];
              if (!mine) return null;
              const { car, leg } = mine;
              return (
                <section key={direction} className="booked-leg" aria-label={direction === 'aller' ? 'Aller' : 'Retour'}>
                  <div className="booked-leg__head">
                    <h3>{direction === 'aller' ? 'Aller' : 'Retour'}</h3>
                    <span>{formatDeparture(leg.departsAt)}</span>
                  </div>
                  <p className="booked-leg__line">
                    <img src={carIcon} alt="" width={20} height={20} />
                    Voiture de {car.driver.name}
                  </p>
                  {direction === 'aller' && leg.meetingPoint && (
                    <p className="booked-leg__line">
                      <img src={pin} alt="" width={20} height={20} />
                      {leg.meetingPoint}
                    </p>
                  )}
                  {direction === 'aller' && (
                    <p className="booked-leg__line">
                      <img src={calendarIcon} alt="" width={20} height={20} />
                      <a
                        className="booked-leg__calendar"
                        href={googleCalendarUrl(rdvEvent(state.trip.name, car.driver.name, leg, tripUrl))}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ajouter à mon agenda
                      </a>
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </div>
        <p className="booked-note">Un empêchement ? Vous pourrez libérer vos places à tout moment depuis la page du voyage.</p>
        <div className="confirm__actions">
          <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
