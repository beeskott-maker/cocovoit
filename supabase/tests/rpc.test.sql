-- Tests des fonctions RPC, exécutés avec le rôle `anon` comme le front.
-- Lancer avec scripts/test-db.sh (une base Postgres vide suffit).
\set ON_ERROR_STOP on
set role anon;

do $$
declare
  r json;
  code text;
  orga uuid;
  hugo uuid;
  lea uuid;
  max_ uuid;
  car uuid;
  aller uuid;
  retour uuid;
  st json;
  failed boolean;
begin
  -- Les tables ne sont pas lisibles directement.
  begin
    perform 1 from public.trips;
    raise exception 'anon ne devrait pas lire trips';
  exception when insufficient_privilege then null;
  end;

  r := create_trip('WE dans le Beaujolais', '124 Venelle de Brouilly 69460 Odenas',
                   '2026-10-10', '2026-10-12', 'Loïc', 'loic@example.com');
  code := r->>'code';
  orga := (r->>'secret')::uuid;
  assert length(code) = 16, 'code invitation';

  assert (get_trip_preview(code)->>'name') = 'WE dans le Beaujolais', 'preview';
  assert get_trip_preview('inconnu') is null, 'preview inconnu';

  -- Parcours invité : email inconnu -> nom demandé.
  assert (join_trip(code, 'hugo@example.com')->>'status') = 'needs_name', 'needs_name';
  r := join_trip(code, 'hugo@example.com', 'Hugo');
  hugo := (r->>'secret')::uuid;
  -- Email déjà connu (casse différente) -> même secret, sans redemander le nom.
  assert (join_trip(code, 'HUGO@example.com')->>'secret')::uuid = hugo, 'join idempotent';
  lea := (join_trip(code, 'lea@example.com', 'Léa')->>'secret')::uuid;
  max_ := (join_trip(code, 'max@example.com', 'Max')->>'secret')::uuid;

  -- Mauvais secret refusé.
  begin
    perform get_trip_state(code, gen_random_uuid());
    raise exception 'secret invalide accepté';
  exception when sqlstate '28000' then null;
  end;

  -- Hugo propose 1 place à l'aller et au retour.
  car := save_car(code, hugo, null, 1, json_build_array(
    json_build_object('direction', 'aller', 'departsAt', '2026-10-10T09:00:00+02:00', 'meetingPoint', 'Gare Part-Dieu'),
    json_build_object('direction', 'retour', 'departsAt', '2026-10-12T17:00:00+02:00')));
  st := get_trip_state(code, lea);
  assert json_array_length(st->'cars') = 1, 'une voiture';
  assert (st->'cars'->0->'legs'->0->>'direction') = 'aller', 'aller en premier';
  aller := (st->'cars'->0->'legs'->0->>'id')::uuid;
  retour := (st->'cars'->0->'legs'->1->>'id')::uuid;

  perform take_seat(code, lea, aller);
  perform take_seat(code, lea, aller); -- idempotent

  -- Plus de place pour Max.
  failed := false;
  begin
    perform take_seat(code, max_, aller);
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'voiture pleine';

  -- Le conducteur ne peut pas réserver dans sa voiture.
  failed := false;
  begin
    perform take_seat(code, hugo, retour);
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'conducteur passager';

  -- Seul le conducteur modifie sa voiture.
  failed := false;
  begin
    perform delete_car(code, lea, car);
  exception when sqlstate '28000' then failed := true;
  end;
  assert failed, 'suppression par un autre';

  -- Max crée sa voiture. Une seule place par sens : Léa, déjà à l'aller chez
  -- Hugo, ne peut pas prendre l'aller de Max sans libérer sa place.
  perform save_car(code, max_, null, 3, json_build_array(
    json_build_object('direction', 'aller', 'departsAt', '2026-10-10T08:00:00+02:00')));
  st := get_trip_state(code, lea);
  failed := false;
  begin
    perform take_seat(code, lea, (st->'cars'->1->'legs'->0->>'id')::uuid);
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'déjà une place à l''aller';
  st := get_trip_state(code, lea);
  assert (st->'cars'->0->'legs'->0->'passengers'->0->>'name') = 'Léa', 'Léa reste chez Hugo';
  assert json_array_length(st->'cars'->1->'legs'->0->'passengers') = 0, 'personne chez Max';

  perform leave_seat(code, lea, aller);
  perform take_seat(code, lea, (st->'cars'->1->'legs'->0->>'id')::uuid);
  st := get_trip_state(code, lea);
  assert json_array_length(st->'cars'->0->'legs'->0->'passengers') = 0, 'place libérée chez Hugo';
  assert (st->'cars'->1->'legs'->0->'passengers'->0->>'name') = 'Léa', 'Léa chez Max';

  perform leave_seat(code, lea, (st->'cars'->1->'legs'->0->>'id')::uuid);
  st := get_trip_state(code, lea);
  assert json_array_length(st->'cars'->1->'legs'->0->'passengers') = 0, 'leave_seat';

  -- Hugo retire le retour : le trajet disparaît.
  perform save_car(code, hugo, car, 2, json_build_array(
    json_build_object('direction', 'aller', 'departsAt', '2026-10-10T09:30:00+02:00')));
  st := get_trip_state(code, hugo);
  assert json_array_length(st->'cars'->0->'legs') = 1, 'retour supprimé';
  assert (st->'cars'->0->>'seats')::int = 2, 'places mises à jour';
  assert (st->'me'->>'name') = 'Hugo', 'me';

  perform delete_car(code, hugo, car);
  assert json_array_length(get_trip_state(code, orga)->'cars') = 1, 'voiture supprimée';
  assert (get_trip_state(code, orga)->'me'->>'isOrganizer')::boolean, 'organisateur';

  -- Création avec seulement le nom et les dates.
  r := create_trip('Sans détails', null, '2026-11-01', '2026-11-01', '', '  ');
  st := get_trip_state(r->>'code', (r->>'secret')::uuid);
  assert (st->'trip'->>'destination') is null, 'destination facultative';
  assert (st->'me'->>'name') = 'Organisateur', 'nom par défaut';
  assert (st->'me'->>'isOrganizer')::boolean, 'organisateur sans email';
  -- Un invité peut toujours rejoindre ce voyage.
  assert (join_trip(r->>'code', 'invite@example.com', 'Invité')->>'status') = 'ok', 'invité sur voyage sans détails';

  -- Le nom du voyage reste obligatoire.
  failed := false;
  begin
    perform create_trip('  ', 'Lyon', '2026-11-01', '2026-11-02', 'A', 'a@example.com');
  exception when check_violation then failed := true;
  end;
  assert failed, 'nom du voyage obligatoire';

  -- « Mes voyages » : seuls les voyages existants avec un secret valide.
  st := my_trips(json_build_array(
    json_build_object('code', r->>'code', 'secret', r->>'secret'),
    json_build_object('code', r->>'code', 'secret', gen_random_uuid()),
    json_build_object('code', 'nexistepas', 'secret', r->>'secret')));
  assert json_array_length(st) = 1, 'un seul voyage valide';
  assert (st->0->>'name') = 'Sans détails', 'nom du voyage à jour';
  assert json_array_length(my_trips('[]'::json)) = 0, 'liste vide';

  raise notice 'Tous les tests SQL passent';
end;
$$;
