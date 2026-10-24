-- Comptes connus d'avance : nom fixé en base, jamais demandé.
-- Lancer avec scripts/test-db.sh (une base Postgres vide suffit).
\set ON_ERROR_STOP on

-- Adresse de test ajoutée par le propriétaire de la base (anon ne peut pas).
insert into public.known_accounts (email_hash, name)
values (sha256(convert_to('connu@example.com', 'UTF8')), 'Connu');

set role anon;

do $$
declare
  r json;
begin
  begin
    perform 1 from public.known_accounts;
    raise exception 'anon ne devrait pas lire known_accounts';
  exception when insufficient_privilege then null;
  end;

  -- Première connexion : pas de nom demandé, le compte est créé avec le nom fixé.
  r := login(' Connu@Example.com ');
  assert (r->>'status') = 'ok', 'pas de needs_name pour un compte connu';
  assert (r->'account'->>'name') = 'Connu', 'nom lu en base';
  -- Un nom saisi est ignoré : le nom fixé l'emporte.
  r := login('connu@example.com', 'Autre');
  assert (r->'account'->>'name') = 'Connu', 'nom fixé conservé';
  assert (me((r->>'token')::uuid)->>'name') = 'Connu', 'me renvoie le nom fixé';
  -- Une adresse inconnue demande toujours le nom.
  assert (login('inconnu@example.com')->>'status') = 'needs_name', 'adresse inconnue';
  raise notice 'Tests comptes connus OK';
end;
$$;
