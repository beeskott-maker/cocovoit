import { useEffect, useId, useRef, useState } from 'react';
import carIcon from '../assets/figma/car-dark.svg';
import calendarIcon from '../assets/figma/calendar-dark-padded.svg';
import pin from '../assets/figma/pin-dark.svg';
import { CheerCoconut } from './Delight';
import { googleCalendarUrl, rdvEvent } from '../lib/calendar';
import { carOf, formatDeparture } from '../lib/format';
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
  /** Adresse du compte, rappelée sous le switch du récap. */
  email?: string;
  /** `recap` : le switch « Recevoir le récap par mail » était activé. */
  onClose: (recap: boolean) => void;
}

/** Pop-in affichée quand on vient d'avoir une place à l'aller et au retour. */
export function BookedDialog({ state, tripUrl, email, onClose }: Props) {
  const titleId = useId();
  const recapId = useId();
  const legs = myLegs(state);
  // Désactivé par défaut ; pris en compte à la fermeture, quelle qu'elle soit.
  const [recap, setRecap] = useState(false);
  const recapRef = useRef(recap);
  recapRef.current = recap;
  const close = () => onClose(recapRef.current);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(recapRef.current);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="confirm-layer">
      <div className="sheet-scrim" onClick={close} aria-hidden="true" />
      <div className="confirm" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <CheerCoconut />
        <h2 id={titleId} className="confirm__title">
          C'est tout bon, {state.me.name} !
        </h2>
        <div className="confirm__text">
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
                    <span>{carOf(car.driver.name)}</span>
                  </p>
                  {direction === 'aller' && leg.meetingPoint && (
                    <p className="booked-leg__line">
                      <img src={pin} alt="" width={20} height={20} />
                      {/* Texte dans un seul élément : iOS transforme les adresses en liens,
                          qui deviendraient sinon des colonnes séparées de la ligne flex. */}
                      <span>{leg.meetingPoint}</span>
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
        <label className="recap-switch" htmlFor={recapId}>
          <span className="recap-switch__text">
            Recevoir le récap par mail
            {email && <small>{email}</small>}
          </span>
          <input
            id={recapId}
            type="checkbox"
            role="switch"
            className="recap-switch__input"
            checked={recap}
            onChange={(e) => setRecap(e.target.checked)}
          />
          <span className="recap-switch__track" aria-hidden="true">
            <span className="recap-switch__thumb" />
          </span>
        </label>
        <div className="confirm__actions">
          <button type="button" className="btn btn--primary" onClick={close} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
