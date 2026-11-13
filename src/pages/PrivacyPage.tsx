import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { APP_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';

const CONTACT = 'contact@cocovoiturage.fr';

/** Confidentialité (#/confidentialite) : quelles données, pour quoi, qui les voit, vos droits. */
export function PrivacyPage() {
  useDocumentTitle(`${APP_TITLE} · Confidentialité`);
  // On y arrive depuis le bas de la home : la page s'ouvre en haut.
  useEffect(() => window.scrollTo(0, 0), []);
  return (
    <>
      <BrandHeader />
      <div className="page-title">
        <h1 className="display-small">Confidentialité</h1>
        <p className="body-medium">
          Quelles données personnelles Coco·Voit utilise, pourquoi, qui peut les voir et comment exercer vos droits.
        </p>
      </div>
      <main className="legal">
        <section>
          <h2>Responsable</h2>
          <p>
            Coco·Voit est un site entre amis pour organiser le covoiturage d'un voyage. Pour toute question sur vos
            données : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </section>

        <section>
          <h2>Votre compte</h2>
          <p>
            Pour vous connecter, vous indiquez votre adresse email ; la première fois, votre prénom (ou le nom que vous
            voulez montrer), et si vous le souhaitez votre numéro de téléphone. Aucun mot de passe n'est créé ni
            conservé. À la première connexion, un lien envoyé par email permet de vérifier que l'adresse est bien
            la vôtre : il est valable 24 heures, et sans clic aucun compte n'est créé.
          </p>
          <p>
            Votre session est gardée dans votre navigateur (stockage local) jusqu'à ce que vous vous déconnectiez. Le
            site n'utilise ni cookie, ni publicité, ni outil de mesure d'audience.
          </p>
        </section>

        <section>
          <h2>Vos voyages</h2>
          <p>
            Pour chaque voyage, le site enregistre son nom, sa destination et ses dates, les voitures proposées (nombre
            de places, horaires, point de rendez-vous) et les places réservées.
          </p>
        </section>

        <section>
          <h2>Qui voit quoi</h2>
          <ul>
            <li>
              Les participants d'un voyage voient son contenu : les voitures, les places et le prénom de chacun. Un
              voyage n'est accessible qu'avec son lien d'invitation et n'est pas référencé par les moteurs de
              recherche.
            </li>
            <li>
              Votre numéro de téléphone, si vous l'avez donné, n'est visible que par votre chauffeur quand vous êtes
              passager, et par les participants du voyage quand vous conduisez, pour vous joindre le jour du départ.
            </li>
            <li>Votre adresse email n'est montrée à aucun autre participant.</li>
          </ul>
        </section>

        <section>
          <h2>Hébergement et prestataires</h2>
          <ul>
            <li>Supabase : base de données, hébergée dans l'Union européenne.</li>
            <li>GitHub Pages : hébergement des pages du site, qui ne contiennent aucune donnée personnelle.</li>
            <li>Brevo : envoi des emails (vérification de l'adresse, récap d'un voyage si vous le demandez) (France).</li>
            <li>Google Fonts : polices de caractères du site.</li>
          </ul>
          <p>Les données ne sont ni vendues, ni cédées, ni utilisées à d'autres fins que le fonctionnement du site.</p>
        </section>

        <section>
          <h2>Durée de conservation</h2>
          <p>
            Un voyage est conservé jusqu'à ce que son organisateur, ou l'administrateur du site, le supprime : ses voitures et ses places sont alors
            effacées avec lui. Votre compte est conservé jusqu'à ce que vous le supprimiez, avec « Supprimer mon compte » en
            bas de Mes voyages : votre email, votre nom et votre numéro sont alors effacés, ainsi que vos voitures
            et vos places. Les voyages que vous organisez passent au participant arrivé le plus tôt, ou sont
            supprimés si vous y étiez seul·e. Les demandes de vérification d'adresse sont effacées au bout de 7 jours.
          </p>
        </section>

        <section>
          <h2>Vos droits</h2>
          <p>
            Conformément au Règlement général sur la protection des données (RGPD), vous pouvez accéder à vos données,
            les faire corriger ou supprimer, et vous opposer à leur utilisation, en écrivant à{' '}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Vous pouvez aussi adresser une réclamation à la CNIL
            (cnil.fr).
          </p>
        </section>

        <p className="legal__date">Dernière mise à jour : novembre 2026.</p>
        <Link className="btn btn--tertiary" to="/">
          Retour à l'accueil
        </Link>
      </main>
    </>
  );
}
