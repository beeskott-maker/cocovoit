# Consignes pour Claude

## Git

- Deux branches, pas de PR :
  - `dev` : branche de travail, publiée en environnement de test sur `…/cocovoit/dev/` (mode démo, données dans le navigateur, badge « DEV »).
  - `main` : production, publiée sur `…/cocovoit/` avec Supabase.
- Développer et commiter sur `dev`. « Déploie en dev » → pousser `dev`. « Mets en prod » → fusionner `dev` dans `main` puis pousser `main`.
- **Ne pas pousser sans demande explicite** : commiter en local, puis pousser (donc déployer) seulement quand l'utilisateur le demande (« Déploie », « Go », « push »…), même si un hook réclame le push. Sans précision, demander s'il s'agit de dev ou de prod.
- Chaque push sur `main` déclenche la CI qui teste, applique les migrations Supabase et déploie (prod + dev) sur GitHub Pages. Un push sur `dev` relance cette CI de `main` sans toucher à la base.
- Avant de pousser, lancer les vérifications locales : `npm run lint && npm run typecheck && npm test && npm run build`, et `scripts/test-db.sh` si `supabase/` change.

## Base de données

- Toute modification du schéma passe par un nouveau fichier dans `supabase/migrations/` (horodatage plus récent que le dernier), appliqué par la CI (`supabase db push`). Ne pas modifier la base de prod à la main.
- Ne jamais réécrire une migration déjà appliquée : en ajouter une nouvelle.

## Mise en page

- **Alignements gauche/droite stricts** : sur un même écran, tous les blocs (titres, textes, champs, boutons, cartes, listes) partagent les mêmes marges latérales. Écrans avec le logo (`BrandHeader`) : 32 px (`.page-title`, `.form`, `.admin-list`), sauf les listes de « Mes voyages » (`.section`) : 20 px ; page voyage : 16 px (en-tête, contenu, pied de page). Seuls les éléments imbriqués dans un cadre (champs d'un trajet, contenu d'une carte) sont en retrait.
- Pour tout nouvel écran ou bloc, réutiliser ces conteneurs plutôt que de fixer un nouveau padding, et vérifier les bords gauche/droite (capture Playwright) avant de livrer.
