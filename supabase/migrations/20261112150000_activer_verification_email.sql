-- Active la vérification de l'email à la première connexion : Brevo est
-- configuré (domaine cocovoiturage.fr authentifié, clé « brevo_api_key » dans
-- le Vault).
update public.email_settings set verification_enabled = true;
