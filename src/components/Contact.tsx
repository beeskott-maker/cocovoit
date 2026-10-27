import { isDesktop } from '../lib/maps';
import { formatPhone, smsUrl, telUrl } from '../lib/phone';
import { CallIcon, SmsIcon } from './PhoneIcons';
import { Sheet } from './Sheet';

/**
 * Boutons ronds Appeler et SMS (chauffeur d'une voiture). Sur ordinateur, où
 * l'on n'appelle pas, l'info-bulle donne le numéro.
 */
export function ContactButtons({ name, phone }: { name: string; phone: string }) {
  const desktop = isDesktop();
  const tip = (label: string) => (desktop ? { className: 'icon-btn tooltip', 'data-tooltip': `${label} · ${formatPhone(phone)}` } : { className: 'icon-btn' });
  return (
    <>
      <a href={telUrl(phone)} aria-label={`Appeler ${name}`} {...tip(`Appeler ${name}`)}>
        <CallIcon />
      </a>
      <a href={smsUrl([phone])} aria-label={`SMS à ${name}`} {...tip(`SMS à ${name}`)}>
        <SmsIcon />
      </a>
    </>
  );
}

/** Appeler ou écrire à un passager (vu par son chauffeur). */
export function ContactSheet({ name, phone, onClose }: { name: string; phone: string; onClose: () => void }) {
  return (
    <Sheet title={name} subtitle={<p className="sheet__phone">{formatPhone(phone)}</p>} onClose={onClose}>
      <ul className="maps-list">
        <li>
          <a className="maps-option" href={telUrl(phone)} onClick={onClose}>
            <span className="contact-option__icon">
              <CallIcon size={22} />
            </span>
            Appeler
          </a>
        </li>
        <li>
          <a className="maps-option" href={smsUrl([phone])} onClick={onClose}>
            <span className="contact-option__icon">
              <SmsIcon size={22} />
            </span>
            Envoyer un SMS
          </a>
        </li>
      </ul>
      <button type="button" className="btn btn--text sheet__cancel" onClick={onClose}>
        Annuler
      </button>
    </Sheet>
  );
}
