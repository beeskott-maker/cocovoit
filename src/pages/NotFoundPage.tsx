import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { useAuth } from '../lib/auth';
import { APP_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';

/** Noix de coco sonnée, qui se balance sous ses étoiles. */
function LostCoconut() {
  return (
    <svg className="lost__coco" viewBox="0 0 220 170" width="220" height="170" aria-hidden="true">
      <ellipse cx="110" cy="160" rx="70" ry="8" fill="#390175" opacity=".12" />
      <g className="lost__stars">
        <path d="M105 22l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#e8f04a" stroke="#390175" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="150" cy="44" r="5" fill="#ff7ab6" stroke="#390175" strokeWidth="2.5" />
        <circle cx="62" cy="50" r="4" fill="#5b3cc4" />
      </g>
      <g className="lost__bob">
        <ellipse cx="110" cy="108" rx="54" ry="46" fill="#aa614b" stroke="#390175" strokeWidth="5" />
        <path d="M70 100q-2 14 6 26M78 132q8 8 18 10" fill="none" stroke="#7f3d2e" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="114" cy="100" rx="42" ry="36" fill="#fff" stroke="#390175" strokeWidth="4.5" />
        <ellipse cx="115" cy="101" rx="34" ry="28" fill="#f7e9da" />
        <path d="M95 88l10 10m0-10l-10 10M125 88l10 10m0-10l-10 10" stroke="#390175" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="115" cy="114" rx="7" ry="8" fill="#390175" />
        <circle cx="93" cy="108" r="5" fill="#ff7ab6" opacity=".7" />
        <circle cx="138" cy="108" r="5" fill="#ff7ab6" opacity=".7" />
        <path d="M160 72q6 10 0 14q-6-4 0-14z" fill="#9fd3ff" stroke="#390175" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** Lien d'un voyage supprimé, lien incomplet ou adresse inconnue. */
export function NotFoundPage() {
  useDocumentTitle(`${APP_TITLE} · Voyage introuvable`);
  const { auth } = useAuth();
  useEffect(() => window.scrollTo(0, 0), []);
  return (
    <>
      <BrandHeader />
      <main className="lost">
        <LostCoconut />
        <h1 className="lost__title">Ce voyage est tombé du cocotier !</h1>
        <p className="body-large">
          Il a été supprimé, ou le lien est incomplet. Demandez à l'organisateur de vous renvoyer le bon lien.
        </p>
        <div className="lost__actions">
          <Link className="btn btn--primary" to="/voyages?creer=1">
            Organiser un voyage
          </Link>
          {auth.status === 'connected' ? (
            <Link className="btn btn--tertiary" to="/voyages">
              Mes voyages
            </Link>
          ) : (
            <Link className="btn btn--tertiary" to="/">
              Retour à l'accueil
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
