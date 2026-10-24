# Consignes pour Claude

## Git

- Travailler **directement sur `main`** : pas de branche de fonctionnalité ni de PR.
- **Ne pas pousser sans demande explicite** : commiter en local, puis pousser (donc déployer) seulement quand l'utilisateur le demande (« Déploie », « Go », « push »…), même si un hook réclame le push.
- Chaque push sur `main` déclenche la CI qui teste, applique les migrations Supabase et déploie en production (GitHub Pages). L'appli a très peu de trafic : modifier la prod en continu est assumé.
- Avant de pousser, lancer les vérifications locales : `npm run lint && npm run typecheck && npm test && npm run build`, et `scripts/test-db.sh` si `supabase/` change.

## Base de données

- Toute modification du schéma passe par un nouveau fichier dans `supabase/migrations/` (horodatage plus récent que le dernier), appliqué par la CI (`supabase db push`). Ne pas modifier la base de prod à la main.
- Ne jamais réécrire une migration déjà appliquée : en ajouter une nouvelle.

## Mise en page

- **Alignements gauche/droite stricts** : sur un même écran, tous les blocs (titres, textes, champs, boutons, cartes, listes) partagent les mêmes marges latérales. Écrans avec le logo (`BrandHeader`) : 32 px (`.page-title`, `.form`, `.section`, `.admin-list`) ; page voyage : 24 px (en-tête, contenu, pied de page). Seuls les éléments imbriqués dans un cadre (champs d'un trajet, contenu d'une carte) sont en retrait.
- Pour tout nouvel écran ou bloc, réutiliser ces conteneurs plutôt que de fixer un nouveau padding, et vérifier les bords gauche/droite (capture Playwright) avant de livrer.
