import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/figma/logo.svg';
import booked from '../assets/landing/booked.webp';
import contact from '../assets/landing/contact.webp';
import home from '../assets/landing/home.webp';
import rdv from '../assets/landing/rdv.webp';
import trip from '../assets/landing/trip.webp';
import { APP_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';
import '../styles/landing.css';

/** Connexion, puis « Mes voyages » avec le formulaire de création ouvert. */
const ORGANIZE = `/identification?suite=${encodeURIComponent('/?creer=1')}`;

const ICON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Page d'accueil des visiteurs non connectés : présentation et accès à la connexion. */
export function LandingPage() {
  useDocumentTitle(APP_TITLE);

  // Défilement jusqu'aux trois étapes (pas d'ancre : l'appli route sur le # de l'URL).
  function toSteps(e: MouseEvent) {
    e.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('#etapes .lp-kicker')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="lp">
      <header className="lp-hero">
        <div className="lp-wrap">
          <nav className="lp-nav">
            <span className="lp-logo">
              <img src={logo} width={186} height={40} alt="Coco·Voit" />
            </span>
            <Link to="/identification">Se connecter</Link>
          </nav>
          <div className="lp-hero-grid">
            <div className="lp-text">
              <h1>Le covoiturage entre amis, sans la logistique.</h1>
              <p className="lp-lead">
                Fini les fils de 200 messages pour savoir qui monte avec qui. Chacun voit les voitures, prend sa place et
                sait où et quand il part.
              </p>
              <div className="lp-ctas">
                <Link className="lp-btn lp-btn--white" to={ORGANIZE}>
                  Organiser un voyage
                </Link>
                <a className="lp-btn lp-btn--ghost" href="#etapes" onClick={toSteps}>
                  Comment ça marche
                </a>
              </div>
              <ul className="lp-reassure">
                <li>Gratuit</li>
                <li>Sans appli à installer</li>
                <li>Sans mot de passe</li>
              </ul>
            </div>
            <div className="lp-hero-phone">
              <div className="lp-phone">
                <img src={trip} alt="La page d'un voyage : les voitures, les places prises et les places libres" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="lp-wrap">
        <section className="lp-first" id="etapes">
          <p className="lp-kicker">En trois étapes</p>
          <h2>Prêts à partir en une minute.</h2>
          <ol className="lp-steps">
            <li>
              <span className="lp-num">1</span>
              <div>
                <strong>Créez le voyage</strong>
                <span>Un nom, des dates, une adresse : c'est tout ce qu'il faut.</span>
              </div>
            </li>
            <li>
              <span className="lp-num">2</span>
              <div>
                <strong>Partagez le lien</strong>
                <span>Dans le groupe WhatsApp, par SMS ou par mail. Vos amis rejoignent avec leur email.</span>
              </div>
            </li>
            <li>
              <span className="lp-num">3</span>
              <div>
                <strong>Chacun trouve sa place</strong>
                <span>Les chauffeurs ajoutent leur voiture, les passagers réservent en un geste.</span>
              </div>
            </li>
          </ol>
        </section>

        <section className="lp-feature">
          <div className="lp-text">
            <p className="lp-kicker">Pour les passagers</p>
            <h2>Une place en un geste, sans rien demander à personne.</h2>
            <p>
              D'un coup d'œil, on voit qui est déjà installé et ce qu'il reste. Les voitures presque pleines passent
              devant : on remplit sans gaspiller.
            </p>
            <ul className="lp-points">
              <li>Une place à l'aller, une au retour, dans la voiture de son choix</li>
              <li>Un récapitulatif clair dès que tout est calé</li>
              <li>Un imprévu ? On libère sa place en un clic</li>
            </ul>
          </div>
          <div className="lp-phone">
            <img src={booked} alt="" />
          </div>
        </section>

        <section className="lp-feature lp-rev">
          <div className="lp-text">
            <p className="lp-kicker">Pour les chauffeurs</p>
            <h2>Votre voiture, vos règles, zéro relance.</h2>
            <p>
              Nombre de places, horaires, point de rendez-vous : vous le dites une fois, tout le monde le voit. Et vos
              passagers sont à un SMS de vous.
            </p>
            <ul className="lp-points">
              <li>Un SMS à tous les passagers de l'aller, en un bouton</li>
              <li>Les numéros de vos passagers à portée de main</li>
            </ul>
          </div>
          <div className="lp-phone">
            <img src={contact} alt="" />
          </div>
        </section>

        <section className="lp-feature">
          <div className="lp-text">
            <p className="lp-kicker">Le jour du départ</p>
            <h2>Le rendez-vous, sans se perdre ni oublier.</h2>
            <p>
              L'adresse s'ouvre directement dans Waze, Google Maps ou Plans. L'horaire s'ajoute à votre agenda, avec un
              rappel une heure avant.
            </p>
            <ul className="lp-points">
              <li>Appeler son chauffeur en un bouton si on est en retard</li>
              <li>Le point de rendez-vous toujours à portée de main</li>
            </ul>
          </div>
          <div className="lp-phone">
            <img src={rdv} alt="" />
          </div>
        </section>

        <section className="lp-feature lp-rev">
          <div className="lp-text">
            <p className="lp-kicker">Tous vos voyages</p>
            <h2>Le prochain week-end et tous les autres.</h2>
            <p>
              « Mes voyages » rassemble les sorties à venir, avec le compte à rebours et garde la trace des précédentes.
              Sur téléphone comme sur ordinateur.
            </p>
          </div>
          <div className="lp-phone">
            <img src={home} alt="" />
          </div>
        </section>

        <section>
          <p className="lp-kicker">Simple et discret</p>
          <h2>Rien à installer, rien à retenir.</h2>
          <div className="lp-trust">
            <div>
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24" {...ICON}>
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <path d="M3 8.5h18" />
                  <path d="M10.6 15.4 13.6 12.4" />
                  <path d="M12.8 11.1l.7-.7a2.1 2.1 0 0 1 3 3l-.7.7" />
                  <path d="M11.4 16.7l-.7.7a2.1 2.1 0 0 1-3-3l.7-.7" />
                </svg>
              </i>
              <b>Dans le navigateur</b>
              <span>Un lien suffit, sur téléphone ou ordinateur.</span>
            </div>
            <div>
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24" {...ICON}>
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M3.8 6.6 12 12.5l8.2-5.9" />
                </svg>
              </i>
              <b>Sans mot de passe</b>
              <span>Votre email vous identifie, c'est tout.</span>
            </div>
            <div>
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24" {...ICON}>
                  <path d="M12 3 5 5.8v5.4c0 4.3 3 7.9 7 9 4-1.1 7-4.7 7-9V5.8z" />
                  <path
                    d="M9.6 9.2c.4 2.6 2 4.4 4.6 5.1l.9-1.4-1.6-.9-.7.7c-.9-.4-1.6-1.1-2-2l.7-.7-.9-1.6z"
                    fill="currentColor"
                    strokeWidth={1}
                  />
                </svg>
              </i>
              <b>Numéros protégés</b>
              <span>Visibles seulement par ceux qui en ont besoin.</span>
            </div>
            <div>
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24" {...ICON}>
                  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                  <circle cx="12" cy="11.3" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </i>
              <b>Gratuit</b>
              <span>Sans publicité, pensé pour les amis.</span>
            </div>
          </div>
        </section>

        <div className="lp-final">
          <h2>Votre prochain week-end commence ici.</h2>
          <p>Créez le voyage, partagez le lien : le reste s'organise tout seul.</p>
          <Link className="lp-btn lp-btn--white" to={ORGANIZE}>
            Organiser un voyage
          </Link>
        </div>
      </main>
      <footer className="lp-footer">cocovoiturage.fr · Le covoiturage entre amis</footer>
    </div>
  );
}
