import { useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import icon from '../assets/brand/icon.svg';
import logo from '../assets/brand/logo.svg';
import { useAuth } from '../lib/auth';
import { APP_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';
import '../styles/landing.css';

/** Connexion, puis « Mes voyages » avec le formulaire de création ouvert. */
const CREATE = '/voyages?creer=1';

/** Éléments qui apparaissent au défilement, avec le décalage entre éléments d'un même groupe (s). */
const REVEAL: [string, number][] = [
  ['.lp-hero .lp-text > *', 0.08],
  ['.lp-hero-art .lp-phone', 0],
  ['.lp-hero-art .lp-sticker', 0.12],
  ['main .lp-kicker', 0],
  ['main h2', 0],
  ['.lp-feature .lp-text > p:not(.lp-kicker)', 0],
  ['.lp-points li', 0.08],
  ['.lp-steps li', 0.12],
  ['.lp-panel', 0],
  ['.lp-trust > div', 0.1],
  ['.lp-final', 0],
];

/**
 * Animations discrètes : apparition au défilement et très légère parallaxe du
 * téléphone d'accroche. Rien si « Réduire les animations » est activé.
 */
function useLandingMotion(root: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const page = root.current;
    if (!page || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const els: HTMLElement[] = [];
    for (const [selector, step] of REVEAL) {
      page.querySelectorAll<HTMLElement>(selector).forEach((el, i) => {
        el.classList.add('lp-rv');
        if (step) el.style.setProperty('--d', `${(i * step).toFixed(2)}s`);
        els.push(el);
      });
    }
    page.classList.add('lp-anim');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('lp-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    const frame = requestAnimationFrame(() => els.forEach((el) => io.observe(el)));

    // Parallaxe : le téléphone d'accroche remonte un peu plus vite que la page.
    const hero = page.querySelector<HTMLElement>('.lp-hero-art');
    let ticking = false;
    const move = () => {
      ticking = false;
      if (hero) hero.style.transform = `translateY(${(-Math.min(window.scrollY, window.innerHeight) * 0.08).toFixed(1)}px)`;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(move);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [root]);
}

const ICON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const Pin = () => (
  <svg viewBox="0 0 24 24" {...ICON} strokeWidth={2.4}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" fill="currentColor" stroke="none" />
  </svg>
);
const Call = () => (
  <svg viewBox="0 0 24 24" {...ICON} strokeWidth={2.4}>
    <path d="M5 4h3.5l1.8 4.6-2.3 1.5a10.5 10.5 0 0 0 5.9 5.9l1.5-2.3L20 15.5V19a1.6 1.6 0 0 1-1.7 1.6A16 16 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4z" />
  </svg>
);
const Sms = () => (
  <svg viewBox="0 0 24 24" {...ICON} strokeWidth={2.4}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z" />
  </svg>
);

/** Carrosserie du van : tous les angles arrondis. */
const VAN_BODY = 'M30 40a20 20 0 0 1 20-20h230c18 0 30 8 38 22l34 59.5q6 11 6 22.5v28a12 12 0 0 1-12 12H42a12 12 0 0 1-12-12z';

/** Van du moodboard, sur la route du rendez-vous. */
const Van = () => (
  <svg className="lp-van" viewBox="0 0 400 200" aria-hidden="true">
    <defs>
      <clipPath id="lp-van-body">
        <path d={VAN_BODY} />
      </clipPath>
    </defs>
    <rect x="70" y="0" width="240" height="18" rx="9" fill="#E8F04A" />
    <path d={VAN_BODY} fill="#5B3CC4" />
    <rect x="50" y="45" width="78" height="50" rx="8" fill="#FFEAF3" />
    <rect x="140" y="45" width="78" height="50" rx="8" fill="#FFEAF3" />
    <path d="M238 45H292Q300 45 304 51.7L326 88.3Q330 95 322 95H238Q230 95 230 87V53Q230 45 238 45Z" fill="#FFEAF3" />
    <rect x="30" y="110" width="328" height="12" fill="#E8F04A" clipPath="url(#lp-van-body)" />
    <circle cx="95" cy="166" r="30" fill="#1B1B1B" />
    <circle cx="95" cy="166" r="12" fill="#E8F04A" />
    <circle cx="290" cy="166" r="30" fill="#1B1B1B" />
    <circle cx="290" cy="166" r="12" fill="#E8F04A" />
  </svg>
);

/** Page d'accueil des visiteurs non connectés : présentation et accès à la connexion. */
export function LandingPage() {
  useDocumentTitle(APP_TITLE);
  const root = useRef<HTMLDivElement>(null);
  useLandingMotion(root);
  const { auth } = useAuth();
  // Connecté : création directe ; sinon connexion d'abord, puis création.
  const organize = auth.status === 'connected' ? CREATE : `/identification?suite=${encodeURIComponent(CREATE)}`;

  // Défilement jusqu'aux trois étapes (pas d'ancre : l'appli route sur le # de l'URL).
  function toSteps(e: MouseEvent) {
    e.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('#etapes .lp-kicker')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="lp" ref={root}>
      <header className="lp-hero">
        <div className="lp-wrap">
          <nav className="lp-nav">
            <span className="lp-logo">
              <img src={logo} width={230} height={147} alt="Coco·Voit" />
            </span>
            {auth.status === 'connected' ? (
              <Link to="/voyages" className="lp-account">
                <span className="lp-account__avatar" aria-hidden="true">
                  {auth.account.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="lp-account__text">
                  <span className="lp-account__name">{auth.account.name}</span>
                  Mes voyages
                </span>
              </Link>
            ) : (
              // Pendant le chargement de la session, rien : pas de « Se connecter » à tort.
              auth.status === 'anonymous' && <Link to="/identification">Se connecter</Link>
            )}
          </nav>
          <div className="lp-hero-grid">
            <div className="lp-text">
              <h1>Le covoiturage entre amis, sans la logistique.</h1>
              <p className="lp-lead">
                Fini les fils de 200 messages pour savoir qui monte avec qui. Chacun voit les voitures, prend sa place et
                sait où et quand il part.
              </p>
              <div className="lp-ctas">
                <Link className="lp-btn lp-btn--rose" to={organize}>
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
            <div className="lp-hero-art">
              <span className="lp-sticker lp-s-citron lp-tl lp-st1" aria-hidden="true">
                je conduis
              </span>
              <span className="lp-sticker lp-s-rose lp-tr lp-st2" aria-hidden="true">
                place dispo
              </span>
              <span className="lp-sticker lp-s-encre lp-tr lp-st3" aria-hidden="true">
                qui ramène les chips ?
              </span>
              <div
                className="lp-phone"
                role="img"
                aria-label="La page d'un voyage : les voitures, les places prises et les places libres"
              >
                <div className="lp-screen" aria-hidden="true">
                  <div className="lp-scr-head">
                    <b>Week-end à la mer</b>
                    <span>ven. 14 → dim. 16 nov. · 3 voitures</span>
                    <div className="lp-tabs">
                      <i>Aller · ven.</i>
                      <i>Retour · dim.</i>
                    </div>
                  </div>
                  <div className="lp-car">
                    <div className="lp-car-top">
                      <b>Voiture d'Hugo</b>
                      <span className="lp-mini lp-s-rose">2 places dispo</span>
                    </div>
                    <div className="lp-rdv">
                      <Pin />
                      Gare d'Annecy · 18 h
                    </div>
                    <div className="lp-seats">
                      <span className="lp-av lp-s-rose">J</span>
                      <span className="lp-av lp-s-citron">T</span>
                      <span className="lp-av lp-av--free">+</span>
                      <span className="lp-av lp-av--free">+</span>
                    </div>
                    <div className="lp-mbtn">Je prends une place</div>
                  </div>
                  <div className="lp-car">
                    <div className="lp-car-top">
                      <b>Voiture de Léa</b>
                      <span className="lp-mini lp-s-encre">complet</span>
                    </div>
                    <div className="lp-seats">
                      <span className="lp-av lp-s-violet">C</span>
                      <span className="lp-av lp-s-rose">A</span>
                      <span className="lp-av lp-s-citron">M</span>
                    </div>
                  </div>
                  <div className="lp-car">
                    <div className="lp-car-top">
                      <b>Voiture de Sam</b>
                      <span className="lp-mini lp-s-rose">1 place dispo</span>
                    </div>
                    <div className="lp-seats">
                      <span className="lp-av lp-s-citron">N</span>
                      <span className="lp-av lp-s-violet">P</span>
                      <span className="lp-av lp-av--free">+</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="lp-wrap">
        <section id="etapes">
          <p className="lp-kicker">En trois étapes</p>
          <h2>Prêts à partir en une minute.</h2>
          <ol className="lp-steps">
            <li className="lp-s-citron">
              <span className="lp-num">1</span>
              <div>
                <strong>Créez le voyage</strong>
                <span>Un nom, des dates, une adresse : c'est tout ce qu'il faut.</span>
              </div>
            </li>
            <li className="lp-s-rose">
              <span className="lp-num">2</span>
              <div>
                <strong>Partagez le lien</strong>
                <span>Dans le groupe WhatsApp, par SMS ou par mail. Vos amis rejoignent avec leur email.</span>
              </div>
            </li>
            <li className="lp-s-violet">
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
          <div className="lp-panel lp-cocos" aria-hidden="true">
            <div className="lp-ticket">
              <div>
                <span>PLACE N°</span>
                <b>3</b>
                <span>réservée</span>
              </div>
            </div>
            <span className="lp-sticker lp-s-violet lp-tr" style={{ right: 28, bottom: 40 }}>
              +1
            </span>
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
          <div className="lp-panel lp-chat" aria-hidden="true">
            <span className="lp-chat-title">Groupe « Mer · 14 personnes »</span>
            <div className="lp-bubble lp-s-rose">On est combien finalement ?</div>
            <div className="lp-bubble lp-bubble--me lp-s-citron">Regardez le lien, tout est dedans</div>
            <div className="lp-contacts">
              {[
                ['J', 'Julie', 'lp-s-rose'],
                ['T', 'Tom', 'lp-s-citron'],
              ].map(([initial, name, color]) => (
                <div key={name} className="lp-contact">
                  <span className={`lp-av ${color}`}>{initial}</span>
                  <b>{name}</b>
                  <span className="lp-ic">
                    <Call />
                  </span>
                  <span className="lp-ic">
                    <Sms />
                  </span>
                </div>
              ))}
              <div className="lp-mbtn lp-s-violet">SMS aux passagers de l'aller</div>
            </div>
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
          <div className="lp-panel lp-road" aria-hidden="true">
            <div className="lp-rdv-card">
              <span>POINT DE RENDEZ-VOUS</span>
              <b>Gare d'Annecy · ven. 18 h</b>
              <div>
                <i>Waze</i>
                <i>Google Maps</i>
                <i>Plans</i>
              </div>
            </div>
            <span className="lp-sticker lp-s-violet lp-tl" style={{ right: 28, top: 190 }}>
              Go !
            </span>
            <Van />
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
          <div className="lp-panel lp-cocos lp-cocos--citron lp-trips" aria-hidden="true">
            <div className="lp-trip lp-trip--next">
              <span className="lp-sticker lp-s-citron lp-tr">dans 3 jours</span>
              <b>Week-end à la mer</b>
              <span>ven. 14 → dim. 16 nov. · 3 voitures</span>
            </div>
            <div className="lp-trip lp-trip--row">
              <div>
                <b>Ski à Annecy</b>
                <span>12 → 14 déc.</span>
              </div>
              <span className="lp-mini lp-s-rose">J-31</span>
            </div>
            <div className="lp-trip lp-trip--past">
              <b>Anniversaire de Tom</b>
              <span>Déjà parti · septembre</span>
            </div>
          </div>
        </section>

        <section>
          <p className="lp-kicker">Simple et discret</p>
          <h2>Rien à installer, rien à retenir.</h2>
          <div className="lp-trust">
            <div>
              <i aria-hidden="true" className="lp-s-citron">
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
              <i aria-hidden="true" className="lp-s-rose">
                <svg viewBox="0 0 24 24" {...ICON}>
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M3.8 6.6 12 12.5l8.2-5.9" />
                </svg>
              </i>
              <b>Sans mot de passe</b>
              <span>Votre email vous identifie, c'est tout.</span>
            </div>
            <div>
              <i aria-hidden="true" className="lp-s-violet">
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
              <i aria-hidden="true" className="lp-s-encre">
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
          <Link className="lp-btn lp-btn--violet" to={organize}>
            Organiser un voyage
          </Link>
          <span className="lp-go" aria-hidden="true">
            Go.
          </span>
        </div>
      </main>
      <footer className="lp-footer">
        <img src={icon} width={52} height={52} alt="" />
        Cocovoit · Le covoiturage entre amis
        <Link to="/confidentialite">Confidentialité</Link>
      </footer>
    </div>
  );
}
