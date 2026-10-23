# Cocovoit

Organiser le covoiturage d'un voyage entre proches. L'organisateur crée le voyage et partage un **lien unique**. Chaque invité indique son email et son nom, puis réserve une place dans une voiture ou propose la sienne, à l'aller comme au retour.

- Front : React + TypeScript (Vite), hébergé sur **GitHub Pages**
- Données : **Supabase** (Postgres + fonctions RPC)
- Maquettes : [Figma « Coco-voit »](https://www.figma.com/design/um67nT8I7s2tmgn7wycjvk/Coco-voit?node-id=49-682)

## Écrans

| Route | Écran |
| --- | --- |
| `#/j/:code` | **Rejoindre** (maquette Figma) : email, puis nom pour un nouvel invité. Un email déjà connu entre directement. |
| `#/t/:code` | **Votre voyage** (maquette Figma) : voitures, places aller / retour, « Prendre 1 place » / « Libérer ma place », lien vers le point de RDV, bouton « Go » (itinéraire). Le logo ouvre le menu. |
| `#/` | Accueil : créer un voyage, retrouver ses voyages. |
| `#/t/:code/inviter` | Lien d'invitation à copier ou partager. |
| `#/t/:code/voiture[/:id]` | Ajouter / modifier / supprimer sa voiture : nombre de places, trajets aller et retour (date, heure, point de RDV). |

Seuls les deux premiers écrans sont maquettés dans Figma. Les autres réutilisent les mêmes composants et tokens.

## Règles métier

- Une personne conduit au plus une voiture par voyage.
- Une seule place par sens : réserver ailleurs libère l'ancienne place.
- Le conducteur ne peut pas être passager dans le sens où il conduit.
- Si le conducteur réduit le nombre de places ou supprime un trajet, les dernières réservations sont annulées.

## Sécurité

Il n'y a pas de comptes. Le code du lien d'invitation donne accès au voyage. Chaque participant reçoit un secret personnel, stocké dans son navigateur. Les tables Supabase sont fermées (RLS, aucun droit pour `anon`) : le front passe uniquement par les fonctions RPC de [`supabase/migrations`](supabase/migrations), qui vérifient le code et le secret.

Limite connue : avec le lien, quelqu'un qui connaît l'email d'un participant peut agir à sa place. C'est acceptable pour un voyage entre proches. Une vérification par email (lien magique Supabase Auth) pourra être ajoutée plus tard.

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
