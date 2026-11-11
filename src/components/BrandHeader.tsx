import { Link } from 'react-router-dom';
import logo from '../assets/brand/logo.svg';

export function BrandHeader() {
  return (
    <header className="brand-header">
      <Link to="/" className="brand-header__logo" aria-label="Coco·Voit, accueil">
        <img src={logo} width={120} height={77} alt="Coco·Voit" />
      </Link>
    </header>
  );
}
