-- Tests de la page de gestion des voyages : clé de l'URL + adresse email autorisée.
\set ON_ERROR_STOP on

-- Clé et adresse de test, ajoutées en tant que propriétaire (comme une migration).
insert into public.admin_keys (key_hash) values (sha256(convert_to('cle-de-test', 'UTF8')));
insert into public.admin_emails (email_hash) values (sha256(convert_to('admin@example.com', 'UTF8')));

set role anon;

do $$
declare
  a json;
  b json;
  lst json;
  failed boolean;
  ana uuid := (login('ana@example.com', 'Ana')->>'token')::uuid;
  ben uuid := (login('ben@example.com', 'Ben')->>'token')::uuid;
  zoe uuid := (login('zoe@example.com', 'Zoé')->>'token')::uuid;
begin
  a := json_build_object('code', create_trip(ana, 'Voyage A', 'Lyon', '2026-11-01', '2026-11-02'));
  b := json_build_object('code', create_trip(ben, 'Voyage B', 'Paris', '2026-12-01', '2026-12-03'));
  perform join_trip(zoe, a->>'code');

  -- Mauvaise clé : refus, même avec la bonne adresse.
  failed := false;
  begin
    perform admin_list_trips('mauvaise-cle', 'admin@example.com');
  exception when sqlstate '28000' then failed := true;
  end;
  assert failed, 'liste avec mauvaise clé';

  -- Bonne clé, adresse absente ou non autorisée : refus explicite.
  failed := false;
  begin
    perform admin_list_trips('cle-de-test', null);
  exception when sqlstate '42501' then failed := true;
  end;
  assert failed, 'liste sans adresse';
  failed := false;
  begin
    perform admin_list_trips('cle-de-test', 'pirate@example.com');
  exception when sqlstate '42501' then failed := true;
  end;
  assert failed, 'liste avec une autre adresse';
  failed := false;
  begin
    perform admin_delete_trip('cle-de-test', 'pirate@example.com', a->>'code');
  exception when sqlstate '42501' then failed := true;
  end;
  assert failed, 'suppression avec une autre adresse';

  -- Les tables de clés et d'adresses restent illisibles.
  begin
    perform 1 from public.admin_keys;
    raise exception 'anon ne devrait pas lire admin_keys';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.admin_emails;
    raise exception 'anon ne devrait pas lire admin_emails';
  exception when insufficient_privilege then null;
  end;

  -- Clé + adresse autorisée (casse et espaces ignorés) : liste et suppression.
  lst := admin_list_trips('cle-de-test', ' Admin@Example.com ');
  assert (select count(*) from json_array_elements(lst) e where e->>'code' in (a->>'code', b->>'code')) = 2, 'deux voyages listés';
  assert (select (e->>'participants')::int from json_array_elements(lst) e where e->>'code' = a->>'code') = 2, 'participants comptés';

  perform admin_delete_trip('cle-de-test', 'admin@example.com', a->>'code');
  lst := admin_list_trips('cle-de-test', 'admin@example.com');
  assert not exists (select 1 from json_array_elements(lst) e where e->>'code' = a->>'code'), 'voyage A supprimé';
  assert exists (select 1 from json_array_elements(lst) e where e->>'code' = b->>'code'), 'voyage B conservé';
  assert get_trip_preview(a->>'code') is null, 'lien du voyage A invalide';

  failed := false;
  begin
    perform admin_delete_trip('cle-de-test', 'admin@example.com', a->>'code');
  exception when sqlstate 'P0002' then failed := true;
  end;
  assert failed, 'voyage déjà supprimé';

  raise notice 'Tests admin OK';
end;
$$;
