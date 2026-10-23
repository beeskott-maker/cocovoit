# Cocovoit

Organiser le covoiturage d'un voyage entre proches. Chacun a un **compte** (email + nom). L'organisateur crée le voyage et partage un **lien unique**. Les invités s'y connectent avec leur email, puis réservent une place dans une voiture ou proposent la leur, à l'aller comme au retour.

- Front : React + TypeScript (Vite), hébergé sur **GitHub Pages**
- Données : **Supabase** (Postgres + fonctions RPC)
- Maquettes : [Figma « Coco-voit »](https://www.figma.com/design/um67nT8I7s2tmgn7wycjvk/Coco-voit?node-id=49-682)

## Écrans

| Route | Écran |
| --- | --- |
| `#/j/:code` | **Rejoindre** (maquette Figma) : connexion par email, puis nom pour un nouveau compte. Une personne déjà connectée est ajoutée automatiquement au voyage, sans formulaire. |
| `#/t/:code` | **Votre voyage** (maquette Figma) : voitures, places aller / retour, « Prendre 1 place » / « Libérer ma place », lien vers le point de RDV, bouton « Go » (itinéraire). Le logo ouvre le menu. |
| `#/` | Accueil (connexion requise) : créer un voyage (nom, destination, dates ; l'organisateur est le compte connecté) et « Mes voyages » : les voyages du compte, avec ses rôles (organisateur, conducteur, passager), lus en base. |
| `#/identification` | Connexion : email, puis nom si le compte n'existe pas encore. Les pages réservées y renvoient quand on n'est pas connecté. |
| `#/t/:code/inviter` | Lien d'invitation à copier ou partager. |
| `#/t/:code/voiture[/:id]` | Ajouter / modifier / supprimer sa voiture : nombre de places, trajets aller et retour (date, heure, point de RDV). |
| `#/x/<clé>` | Gestion des voyages : liste de tous les voyages, ouverture, suppression (avec confirmation). Accès en deux temps : la clé de l'URL, puis l'adresse email autorisée, vérifiée par la base à chaque appel (sans envoi d'email). Ni la clé ni l'adresse ne sont dans le dépôt : seules leurs empreintes SHA-256 sont en base (`admin_keys`, `admin_emails`). En mode démo : clé `demo`, adresse `demo@example.com`. |

Seuls les deux premiers écrans sont maquettés dans Figma. Les autres réutilisent les mêmes composants et tokens.

## Comptes

Les comptes sont en base (`accounts`). On se connecte avec son email, **sans vérification** (choix assumé : priorité à la fluidité) ; un nouveau compte demande aussi le nom. La connexion crée une session (`account_sessions`) dont le jeton est la seule chose gardée par le navigateur (`localStorage`, clé `cocovoit:token`). Les voyages organisés, les voitures conduites et les places prises sont rattachés au compte (via `participants`), donc visibles depuis n'importe quel appareil. « Ce n'est pas moi » (bas de l'écran du voyage) ferme la session.

## Règles métier

- Une personne conduit au plus une voiture par voyage.
- Une seule place par sens : déjà inscrit sur un aller (ou un retour), on ne peut pas prendre de place sur un autre aller (ou retour) du voyage ; le bouton « Prendre 1 place » est désactivé tant qu'on n'a pas libéré sa place.
- Un conducteur n'est jamais passager dans son voyage (ni à l'aller ni au retour) : les boutons « Prendre 1 place » disparaissent, et proposer sa voiture libère les places qu'on avait prises.
- Si le conducteur réduit le nombre de places ou supprime un trajet, les dernières réservations sont annulées.

## Sécurité

Les tables Supabase sont fermées (RLS, aucun droit pour `anon`) : le front passe uniquement par les fonctions RPC de [`supabase/migrations`](supabase/migrations). Chaque fonction liée à une personne prend le jeton de session et vérifie que le compte participe au voyage.

Limite connue : l'email n'est pas vérifié. Quelqu'un qui connaît l'adresse d'une personne peut se connecter à son compte et voir ses voyages. C'est acceptable pour des voyages entre proches ; une vérification par code envoyé par email (Supabase Auth) pourra être ajoutée plus tard.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires + parcours (Vitest, Testing Library)
npm run lint && npm run typecheck
```

Sans variables Supabase, l'appli tourne en **mode démo**. Les données sont alors stockées dans le navigateur, avec les mêmes règles que le serveur. Pour utiliser Supabase, copier `.env.example` en `.env.local` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

Tests de la base (Postgres local requis) :

```bash
DATABASE_URL=postgresql://postgres@localhost:5432/cocovoit_test scripts/test-db.sh
```

## CI / déploiement

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) s'exécute à chaque push sur `main` et à chaque PR vers `main` :

1. **Front** : lint, typecheck, tests, build
2. **Base de données** : migrations appliquées sur un Postgres 15 vierge, puis tests SQL ([`supabase/tests`](supabase/tests))
3. Sur `main` uniquement : **migrations Supabase** (`supabase db push`), puis **déploiement GitHub Pages**

### Configuration à faire une fois

1. **GitHub Pages** : *Settings → Pages → Source : GitHub Actions*.
2. **Projet Supabase** (supabase.com, offre gratuite), puis dans *Settings → Secrets and variables → Actions* :
   - Variables : `SUPABASE_PROJECT_ID` (référence du projet), `SUPABASE_URL` (`https://<ref>.supabase.co`), `SUPABASE_ANON_KEY` (clé publique « anon »)
   - Secrets : `SUPABASE_ACCESS_TOKEN` (jeton personnel, *Account → Access tokens*), `SUPABASE_DB_PASSWORD` (mot de passe de la base)

Tant que Supabase n'est pas configuré, les migrations sont ignorées et le site déployé tourne en mode démo.
