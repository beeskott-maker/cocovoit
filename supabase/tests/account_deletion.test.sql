-- Suppression du compte : aperçu, confirmation par l'email, transmission des voyages.
\set ON_ERROR_STOP on
set role anon;

do $$
declare
  orga uuid := (login('del-orga@example.com', 'Orga')->>'token')::uuid;
  hugo uuid := (login('del-hugo@example.com', 'Hugo')->>'token')::uuid;
  lea uuid := (login('del-lea@example.com', 'Léa')->>'token')::uuid;
  partage text;
  solo text;
  chez_hugo text;
  leg uuid;
  p json;
  failed boolean;
begin
  -- Voyage partagé organisé par Orga, avec sa voiture où Léa a une place.
  partage := create_trip(orga, 'Partagé', null, '2026-12-01', '2026-12-02');
  perform join_trip(hugo, partage);
  perform join_trip(lea, partage);
  perform save_car(orga, partage, null, 3,
    '[{"direction":"aller","departsAt":"2026-12-01T08:00:00Z","meetingPoint":null}]');
  leg := (get_trip_state(orga, partage)->'cars'->0->'legs'->0->>'id')::uuid;
  perform take_seat(lea, partage, leg);
  -- Voyage où Orga est seule.
  solo := create_trip(orga, 'Solo', null, '2026-12-05', '2026-12-06');
  -- Voyage de Hugo où Orga est passagère.
  chez_hugo := create_trip(hugo, 'Chez Hugo', null, '2026-12-10', '2026-12-11');
  perform join_trip(orga, chez_hugo);
  perform save_car(hugo, chez_hugo, null, 3,
    '[{"direction":"aller","departsAt":"2026-12-10T08:00:00Z","meetingPoint":null}]');
  leg := (get_trip_state(hugo, chez_hugo)->'cars'->0->'legs'->0->>'id')::uuid;
  perform take_seat(orga, chez_hugo, leg);

  -- Aperçu.
  p := account_deletion_preview(orga);
  assert json_array_length(p->'transferred') = 1, 'un voyage transmis';
  assert p->'transferred'->0->>'trip' = 'Partagé', 'voyage transmis';
  assert p->'transferred'->0->>'to' in ('Hugo', 'Léa'), 'à un autre participant';
  assert (p->>'deletedTrips')::jsonb = '["Solo"]'::jsonb, 'voyage solo supprimé';
  assert json_array_length(p->'cars') = 1, 'une voiture';
  assert (p->'cars'->0->>'passengers')::jsonb = '["Léa"]'::jsonb, 'Léa perd sa place';
  assert p->'seats'->0->>'driver' = 'Hugo', 'place libérée chez Hugo';

  -- Mauvais email : refusé, rien n'est supprimé.
  failed := false;
  begin
    perform delete_account(orga, 'hugo@example.com');
  exception when invalid_parameter_value then failed := true;
  end;
  assert failed, 'email différent refusé';
  assert me(orga)->>'name' = 'Orga', 'compte intact';

  -- Bon email, casse et espaces ignorés.
  perform delete_account(orga, '  DEL-Orga@Example.com ');
  failed := false;
  begin
    perform me(orga);
  exception when invalid_password then failed := true;
  end;
  assert failed, 'session fermée';

  -- Le voyage partagé reste, sans la voiture d'Orga, avec un nouvel organisateur.
  assert json_array_length(get_trip_state(hugo, partage)->'cars') = 0, 'voiture supprimée';
  assert (get_trip_state(hugo, partage)->'me'->>'isOrganizer')::boolean
      <> (get_trip_state(lea, partage)->'me'->>'isOrganizer')::boolean, 'un seul nouvel organisateur';
  -- Le voyage solo n'existe plus.
  failed := false;
  begin
    perform get_trip_state(hugo, solo);
  exception when no_data_found then failed := true;
  end;
  assert failed, 'voyage solo supprimé';
  -- La place d'Orga chez Hugo est libérée.
  assert json_array_length(get_trip_state(hugo, chez_hugo)->'cars'->0->'legs'->0->'passengers') = 0, 'place libérée';

  -- L'email peut resservir pour un nouveau compte, vierge.
  orga := (login('del-orga@example.com', 'Orga 2')->>'token')::uuid;
  assert json_array_length(my_trips(orga)) = 0, 'nouveau compte vierge';

  raise notice 'Tests suppression du compte OK';
end;
$$;
