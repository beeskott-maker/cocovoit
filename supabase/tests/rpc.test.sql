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
  begin
    perform 1 from public.accounts;
    raise exception 'anon ne devrait pas lire accounts';
  exception when insufficient_privilege then null;
  end;

  -- Connexion : email inconnu -> nom demandé, puis compte créé.
  assert (login('loic@example.com')->>'status') = 'needs_name', 'needs_name';
  r := login('loic@example.com', 'Loïc');
  orga := (r->>'token')::uuid;
  assert (r->'account'->>'name') = 'Loïc', 'compte créé';
  -- Email connu (casse et espaces ignorés) : même compte, nouvelle session.
  r := login(' LOIC@example.com ');
  assert (r->>'status') = 'ok' and (r->>'token')::uuid <> orga, 'nouvelle session';
  assert (me((r->>'token')::uuid)->>'email') = 'loic@example.com', 'même compte';
  -- Déconnexion : la session ne marche plus.
  perform logout((r->>'token')::uuid);
  begin
    perform me((r->>'token')::uuid);
    raise exception 'session fermée acceptée';
  exception when sqlstate '28P01' then null;
  end;
  begin
    perform my_trips(gen_random_uuid());
    raise exception 'jeton inconnu accepté';
  exception when sqlstate '28P01' then null;
  end;

  hugo := (login('hugo@example.com', 'Hugo')->>'token')::uuid;
  lea := (login('lea@example.com', 'Léa')->>'token')::uuid;
  max_ := (login('max@example.com', 'Max')->>'token')::uuid;

  code := create_trip(orga, 'WE dans le Beaujolais', '124 Venelle de Brouilly 69460 Odenas', '2026-10-10', '2026-10-12');
  assert length(code) = 16, 'code invitation';
  assert (get_trip_preview(code)->>'name') = 'WE dans le Beaujolais', 'preview';
  assert get_trip_preview('inconnu') is null, 'preview inconnu';

  -- Pas encore dans le voyage : refusé.
  begin
    perform get_trip_state(hugo, code);
    raise exception 'non participant accepté';
  exception when sqlstate '28000' then null;
  end;
  begin
    perform join_trip(hugo, 'inconnu');
    raise exception 'voyage inconnu accepté';
  exception when sqlstate 'P0002' then null;
  end;

  perform join_trip(hugo, code);
  perform join_trip(hugo, code); -- idempotent
  perform join_trip(lea, code);
  perform join_trip(max_, code);

  -- Hugo propose 1 place à l'aller et au retour.
  car := save_car(hugo, code, null, 1, json_build_array(
    json_build_object('direction', 'aller', 'departsAt', '2026-10-10T09:00:00+02:00', 'meetingPoint', 'Gare Part-Dieu'),
    json_build_object('direction', 'retour', 'departsAt', '2026-10-12T17:00:00+02:00')));
  st := get_trip_state(lea, code);
  assert json_array_length(st->'cars') = 1, 'une voiture';
  assert (st->'cars'->0->'driver'->>'name') = 'Hugo', 'nom du conducteur depuis son compte';
  assert (st->'cars'->0->'legs'->0->>'direction') = 'aller', 'aller en premier';
  aller := (st->'cars'->0->'legs'->0->>'id')::uuid;
  retour := (st->'cars'->0->'legs'->1->>'id')::uuid;

  perform take_seat(lea, code, aller);
  perform take_seat(lea, code, aller); -- idempotent

  -- Plus de place pour Max.
  failed := false;
  begin
    perform take_seat(max_, code, aller);
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'voiture pleine';

  -- Le conducteur ne peut pas réserver dans sa voiture.
  failed := false;
  begin
    perform take_seat(hugo, code, retour);
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'conducteur passager';

  -- Max a une place au retour : il ne peut pas ajouter sa voiture sans la libérer.
  perform take_seat(max_, code, retour);
  failed := false;
  begin
    perform save_car(max_, code, null, 3, json_build_array(
      json_build_object('direction', 'aller', 'departsAt', '2026-10-10T08:00:00+02:00')));
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'passager sans voiture';
  perform leave_seat(max_, code, retour);

  -- Seul le conducteur modifie sa voiture.
  failed := false;
  begin
    perform delete_car(lea, code, car);
  exception when sqlstate '28000' then failed := true;
  end;
  assert failed, 'suppression par un autre';

  -- Max crée sa voiture. Une seule place par sens : Léa, déjà à l'aller chez
  -- Hugo, ne peut pas prendre l'aller de Max sans libérer sa place.
  perform save_car(max_, code, null, 3, json_build_array(
    json_build_object('direction', 'aller', 'departsAt', '2026-10-10T08:00:00+02:00')));
  st := get_trip_state(lea, code);
  -- Ni au retour chez Hugo : il conduit.
  failed := false;
  begin
    perform take_seat(max_, code, retour);
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'conducteur passager dans l''autre sens';
  failed := false;
  begin
    perform take_seat(lea, code, (st->'cars'->1->'legs'->0->>'id')::uuid);
  exception when sqlstate '22023' then failed := true;
  end;
  assert failed, 'déjà une place à l''aller';

  perform leave_seat(lea, code, aller);
  perform take_seat(lea, code, (st->'cars'->1->'legs'->0->>'id')::uuid);
  st := get_trip_state(lea, code);
  assert json_array_length(st->'cars'->0->'legs'->0->'passengers') = 0, 'place libérée chez Hugo';
  assert (st->'cars'->1->'legs'->0->'passengers'->0->>'name') = 'Léa', 'Léa chez Max';

  -- Mes voyages : rôles depuis le compte.
  st := my_trips(lea);
  assert json_array_length(st) = 1, 'un voyage pour Léa';
  assert (st->0->>'isPassenger')::boolean and not (st->0->>'isDriver')::boolean, 'Léa passagère';
  st := my_trips(hugo);
  assert (st->0->>'isDriver')::boolean and not (st->0->>'isOrganizer')::boolean, 'Hugo conducteur';
  st := my_trips(orga);
  assert (st->0->>'isOrganizer')::boolean, 'Loïc organisateur';

  perform leave_seat(lea, code, (get_trip_state(lea, code)->'cars'->1->'legs'->0->>'id')::uuid);
  st := get_trip_state(lea, code);
  assert json_array_length(st->'cars'->1->'legs'->0->'passengers') = 0, 'leave_seat';

  -- Hugo retire le retour : le trajet disparaît.
  perform save_car(hugo, code, car, 2, json_build_array(
    json_build_object('direction', 'aller', 'departsAt', '2026-10-10T09:30:00+02:00')));
  st := get_trip_state(hugo, code);
  assert json_array_length(st->'cars'->0->'legs') = 1, 'retour supprimé';
  assert (st->'cars'->0->>'seats')::int = 2, 'places mises à jour';
  assert (st->'me'->>'name') = 'Hugo', 'me';

  perform delete_car(hugo, code, car);
  assert json_array_length(get_trip_state(orga, code)->'cars') = 1, 'voiture supprimée';
  assert (get_trip_state(orga, code)->'me'->>'isOrganizer')::boolean, 'organisateur';

  -- Création avec seulement le nom et les dates.
  code := create_trip(orga, 'Sans détails', null, '2026-11-01', '2026-11-01');
  assert (get_trip_state(orga, code)->'trip'->>'destination') is null, 'destination facultative';
  assert json_array_length(my_trips(orga)) = 2, 'deux voyages pour Loïc';

  -- Le nom du voyage reste obligatoire.
  failed := false;
  begin
    perform create_trip(orga, '  ', 'Lyon', '2026-11-01', '2026-11-02');
  exception when check_violation then failed := true;
  end;
  assert failed, 'nom du voyage obligatoire';

  raise notice 'Tous les tests SQL passent';
end;
$$;
