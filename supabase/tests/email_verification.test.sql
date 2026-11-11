-- Vérification de l'email à la première connexion (envoi réel absent ici : pas de pg_net).
\set ON_ERROR_STOP on

-- Désactivée par défaut : la connexion se comporte comme avant.
set role anon;
do $$
begin
  assert login('verif-off@example.com')->>'status' = 'needs_name', 'désactivée : nom demandé';
end;
$$;
reset role;
update email_settings set verification_enabled = true;

-- Adresse inconnue : lien envoyé, pas de compte créé même avec un nom.
set role anon;
do $$
declare
  r json := login('verif-lea@example.com', null, null, null, '/j/abc');
  again json;
begin
  assert r->>'status' = 'verification_sent', 'lien envoyé';
  assert r->>'email' = 'verif-lea@example.com', 'adresse rappelée';
  assert email_verification_status((r->>'request')::uuid) = 'pending', 'en attente';
  -- Moins d'une minute après : même demande, pas de nouvel email.
  again := login('verif-lea@example.com', 'Léa');
  assert again->>'request' = r->>'request', 'pas de renvoi immédiat';
  assert again->>'status' = 'verification_sent', 'pas de compte sans vérification';
  -- Une demande non confirmée ne suffit pas.
  assert login('verif-lea@example.com', 'Léa', null, (r->>'request')::uuid)->>'status' = 'verification_sent',
    'demande non confirmée refusée';
  assert verify_email('nimporte-quoi')->>'status' = 'invalid', 'jeton inconnu';
end;
$$;
reset role;
-- Jeton connu pour le test (en vrai, il n'existe que dans l'email).
update email_verifications set token_hash = sha256(convert_to('jeton-lea', 'UTF8')) where email = 'verif-lea@example.com';

set role anon;
do $$
declare
  v json := verify_email('jeton-lea');
  req uuid := (v->>'request')::uuid;
  r json;
begin
  assert v->>'status' = 'verified', 'lien cliqué';
  assert v->>'next' = '/j/abc', 'page où reprendre';
  assert verify_email('jeton-lea')->>'status' = 'verified', 'second clic sans effet';
  assert email_verification_status(req) = 'verified', 'écran d''attente débloqué';
  -- Une demande confirmée pour une autre adresse ne sert à rien.
  assert login('autre@example.com', 'X', null, req)->>'status' = 'verification_sent', 'demande liée à son adresse';
  assert login('verif-lea@example.com', null, null, req)->>'status' = 'needs_name', 'nom demandé';
  r := login(' Verif-Lea@example.com ', 'Léa', '06 11 22 33 44', req);
  assert r->>'status' = 'ok', 'compte créé';
  assert r->'account'->>'phone' = '+33611223344', 'téléphone';
  -- Ensuite : connexion directe.
  assert login('verif-lea@example.com')->>'status' = 'ok', 'adresse connue';
end;
$$;
reset role;
-- Lien périmé.
update email_verifications set token_hash = sha256(convert_to('jeton-vieux', 'UTF8')), expires_at = now() - interval '1 minute'
where email = 'autre@example.com';

set role anon;
do $$
declare
  v json := verify_email('jeton-vieux');
  failed boolean := false;
begin
  assert v->>'status' = 'expired', 'lien expiré';
  assert v->>'email' = 'autre@example.com', 'adresse pour renvoyer';
  -- Lien expiré, plus d'une minute après : nouvelle demande.
  assert login('autre@example.com')->>'status' = 'verification_sent', 'nouveau lien';
  begin
    perform login('pas-un-email');
  exception when invalid_parameter_value then failed := true;
  end;
  assert failed, 'adresse invalide refusée';
  raise notice 'Tests vérification email OK';
end;
$$;
reset role;
update email_settings set verification_enabled = false;
