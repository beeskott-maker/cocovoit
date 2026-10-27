-- Numéro de téléphone : format, et qui le voit dans get_trip_state.
\set ON_ERROR_STOP on
set role anon;

do $$
declare
  orga uuid := (login('tel-orga@example.com', 'Orga')->>'token')::uuid;
  chauffeur uuid := (login('tel-chauffeur@example.com', 'Hugo', '06 12 34 56 78')->>'token')::uuid;
  passager uuid := (login('tel-passager@example.com', 'Léa', '+33 6 98 76 54 32')->>'token')::uuid;
  code text;
  aller uuid;
  st json;
  failed boolean;
begin
  assert me(chauffeur)->>'phone' = '+33612345678', 'numéro français normalisé';
  assert me(orga)->>'phone' is null, 'numéro facultatif';
  -- Le numéro passé à la connexion d'un compte existant est ignoré.
  perform login('tel-orga@example.com', null, '0611111111');
  assert me(orga)->>'phone' is null, 'pas de numéro via une simple connexion';

  assert set_phone(orga, '0033 6.11.22.33.44')->>'phone' = '+33611223344', 'set_phone';
  assert set_phone(orga, ' ')->>'phone' is null, 'numéro retiré';
  failed := false;
  begin
    perform set_phone(orga, '12345');
  exception when invalid_parameter_value then failed := true;
  end;
  assert failed, 'numéro invalide refusé';

  code := create_trip(orga, 'Tel', null, '2026-11-01', '2026-11-02');
  perform join_trip(chauffeur, code);
  perform join_trip(passager, code);
  perform save_car(chauffeur, code, null, 3,
    '[{"direction":"aller","departsAt":"2026-11-01T08:00:00Z","meetingPoint":null}]');
  aller := (get_trip_state(chauffeur, code)->'cars'->0->'legs'->0->>'id')::uuid;
  perform take_seat(passager, code, aller);

  -- Le chauffeur voit le numéro de son passager.
  st := get_trip_state(chauffeur, code);
  assert st->'cars'->0->'legs'->0->'passengers'->0->>'phone' = '+33698765432', 'chauffeur → passager';
  assert st->'me'->>'phone' = '+33612345678', 'mon numéro';
  -- Les autres voient le numéro du chauffeur, pas celui du passager.
  st := get_trip_state(orga, code);
  assert st->'cars'->0->'driver'->>'phone' = '+33612345678', 'numéro du chauffeur visible';
  assert st->'cars'->0->'legs'->0->'passengers'->0->>'phone' is null, 'numéro du passager caché';
  st := get_trip_state(passager, code);
  assert st->'cars'->0->'legs'->0->'passengers'->0->>'phone' is null, 'pas même pour lui-même dans la liste';

  raise notice 'Tests téléphone OK';
end;
$$;
