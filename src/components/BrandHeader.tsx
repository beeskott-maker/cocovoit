import { Link } from 'react-router-dom';
import logo from '../assets/figma/logo.svg';

export function BrandHeader() {
  return (
    <header className="brand-header">
      <Link to="/" className="brand-header__logo" aria-label="Coco·Voit, accueil">
        <img src={logo} width={153} height={40} alt="coco·voit" />
      </Link>
    </header>
  );
}
