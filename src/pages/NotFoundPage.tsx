import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';

export function NotFoundPage() {
  return (
    <>
      <BrandHeader />
      <div className="page-title stack">
        <h1 className="display-small">Lien introuvable</h1>
        <p className="body-large">
          Ce lien d'invitation n'existe pas ou plus. Demandez à l'organisateur du voyage de vous le renvoyer.
        </p>
      </div>
      <div className="form">
        <Link className="btn btn--outline" to="/">
          Créer un voyage
        </Link>
      </div>
    </>
  );
}
