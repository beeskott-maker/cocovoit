# Consignes pour Claude

## Git

- Travailler **directement sur `main`** : pas de branche de fonctionnalité ni de PR, commit puis push sur `main`.
- Chaque push sur `main` déclenche la CI qui teste, applique les migrations Supabase et déploie en production (GitHub Pages). L'appli a très peu de trafic : modifier la prod en continu est assumé.
- Avant de pousser, lancer les vérifications locales : `npm run lint && npm run typecheck && npm test && npm run build`, et `scripts/test-db.sh` si `supabase/` change.

## Base de données

- Toute modification du schéma passe par un nouveau fichier dans `supabase/migrations/` (horodatage plus récent que le dernier), appliqué par la CI (`supabase db push`). Ne pas modifier la base de prod à la main.
- Ne jamais réécrire une migration déjà appliquée : en ajouter une nouvelle.
