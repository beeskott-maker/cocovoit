import pin from '../assets/figma/pin-dark.svg';
import { MapsOptions } from './MapsOptions';
import { Sheet } from './Sheet';

interface Props {
  address: string;
  onClose: () => void;
}

/** Choix de l'appli d'itinéraire. */
export function MapsSheet({ address, onClose }: Props) {
  return (
    <Sheet
      title="Ouvrir l'itinéraire avec"
      onClose={onClose}
      subtitle={
        <p className="sheet__address">
          <img src={pin} alt="" width={18} height={18} />
          {address}
        </p>
      }
    >
      <MapsOptions address={address} onChoose={onClose} />
      <button type="button" className="btn btn--text sheet__cancel" onClick={onClose}>
        Annuler
      </button>
    </Sheet>
  );
}
