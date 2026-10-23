-- Tests de la page de gestion des voyages (admin_list_trips / admin_delete_trip).
\set ON_ERROR_STOP on

-- Clé de test, ajoutée en tant que propriétaire (comme le ferait une migration).
insert into public.admin_keys (key_hash) values (sha256(convert_to('cle-de-test', 'UTF8')));

set role anon;

do $$
declare
  a json;
  b json;
  lst json;
  failed boolean;
begin
  a := create_trip('Voyage A', 'Lyon', '2026-11-01', '2026-11-02', 'Ana', 'ana@example.com');
  b := create_trip('Voyage B', 'Paris', '2026-12-01', '2026-12-03', 'Ben', 'ben@example.com');
  perform join_trip(a->>'code', 'zoe@example.com', 'Zoé');

  -- Mauvaise clé ou clé absente : refus.
  failed := false;
  begin
    perform admin_list_trips('mauvaise-cle');
  exception when sqlstate '28000' then failed := true;
  end;
  assert failed, 'liste avec mauvaise clé';
  failed := false;
  begin
    perform admin_list_trips(null);
  exception when sqlstate '28000' then failed := true;
  end;
  assert failed, 'liste sans clé';
  failed := false;
  begin
    perform admin_delete_trip('mauvaise-cle', a->>'code');
  exception when sqlstate '28000' then failed := true;
  end;
  assert failed, 'suppression avec mauvaise clé';

  -- Le rôle anon ne lit pas la table des clés.
  begin
    perform 1 from public.admin_keys;
    raise exception 'anon ne devrait pas lire admin_keys';
  exception when insufficient_privilege then null;
  end;

  -- Bonne clé : liste avec compteurs.
  lst := admin_list_trips('cle-de-test');
  assert (select count(*) from json_array_elements(lst) e where e->>'code' in (a->>'code', b->>'code')) = 2, 'deux voyages listés';
  assert (select (e->>'participants')::int from json_array_elements(lst) e where e->>'code' = a->>'code') = 2, 'participants comptés';

  -- Suppression d'un voyage, en cascade.
  perform admin_delete_trip('cle-de-test', a->>'code');
  lst := admin_list_trips('cle-de-test');
  assert not exists (select 1 from json_array_elements(lst) e where e->>'code' = a->>'code'), 'voyage A supprimé';
  assert exists (select 1 from json_array_elements(lst) e where e->>'code' = b->>'code'), 'voyage B conservé';
  assert get_trip_preview(a->>'code') is null, 'lien du voyage A invalide';

  failed := false;
  begin
    perform admin_delete_trip('cle-de-test', a->>'code');
  exception when sqlstate 'P0002' then failed := true;
  end;
  assert failed, 'voyage déjà supprimé';

  raise notice 'Tests admin OK';
end;
$$;
