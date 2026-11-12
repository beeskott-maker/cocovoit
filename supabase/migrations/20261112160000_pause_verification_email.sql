-- Met en pause la vérification de l'email : la clé Brevo n'est pas encore lue
-- correctement depuis le Vault. Une migration la réactivera une fois corrigé.
update public.email_settings set verification_enabled = false;
