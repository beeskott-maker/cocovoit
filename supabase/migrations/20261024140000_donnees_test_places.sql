-- Jeu de données pour vérifier la disposition des places, à la demande de
-- Loic (compte connu d'avance, retrouvé par l'empreinte de son adresse).
--
-- Trois voyages « Test places » organisés par Loic, avec des participants
-- fictifs (adresses @example.com). Chaque conducteur fictif porte le nom du
-- cas illustré, d'où des titres comme « Voiture de 1 libre sur 2 ». Sans
-- compte Loic (base de test de la CI), rien n'est inséré. Pour nettoyer :
-- supprimer ces voyages depuis l'appli (« Supprimer ce voyage »).

do $$
declare
  v_loic uuid;
  v_names text[] := array[
    'Hortense', 'Julie', 'Thomas', 'Camille', 'Sarah', 'Antoine', 'Léa', 'Hugo', 'Emma', 'Louis',
    'Chloé', 'Paul', 'Inès', 'Jules', 'Manon', 'Arthur', 'Zoé', 'Nathan', 'Alice', 'Victor',
    'Lucie', 'Gabriel', 'Clara', 'Adam', 'Jeanne', 'Raphaël', 'Rose', 'Noé', 'Anna', 'Tom',
    'Margaux', 'Simon', 'Eva', 'Martin', 'Agathe', 'Oscar', 'Juliette', 'Basile', 'Lina', 'Elie'];
  v_trips uuid[] := '{}';
  v_n int := 0;              -- passagers fictifs déjà utilisés
  v_t timestamptz := now();  -- horodatages croissants : ordre des voitures et des places
  v_trip uuid;
  v_driver uuid;
  v_car uuid;
  v_leg uuid;
  v_part uuid;
  v_case record;
  i int;
begin
  select a.id into v_loic
  from accounts a
  join known_accounts k on k.email_hash = sha256(convert_to(lower(trim(a.email)), 'UTF8'))
  where k.name = 'Loic';
  if v_loic is null then
    raise notice 'Pas de compte Loic : jeu de test des places non inséré';
    return;
  end if;

  -- 1 : cas de base, Loic sans place (bouton « Prendre 1 place » actif).
  -- 2 : Loic passager (« Moi », « Libérer ma place », bouton grisé ailleurs).
  -- 3 : voiture conduite par Loic (pas de bouton).
  for i in 1..3 loop
    insert into trips (name, destination, starts_on, ends_on)
    values (
      (array['Test places · cas de base', 'Test places · ma place', 'Test places · ma voiture'])[i],
      'Place Bellecour, 69002 Lyon', '2026-11-21', '2026-11-22')
    returning id into v_trip;
    insert into participants (trip_id, account_id, is_organizer) values (v_trip, v_loic, true);
    v_trips := v_trips || v_trip;
  end loop;

  for v_case in
    select * from (values
      -- (ordre, voyage, conducteur, places, sens, passagers fictifs, Loic passager)
      (1, 1, '1 libre sur 2', 2, 'aller', 1, false),
      (2, 1, '1 libre sur 4', 4, 'aller', 3, false),
      (3, 1, '1 libre sur 5', 5, 'aller', 4, false),
      (4, 1, '1 libre sur 6', 6, 'aller', 5, false),
      (5, 1, '2 libres sur 6', 6, 'aller', 4, false),
      (6, 1, 'voiture vide', 4, 'aller', 0, false),
      (7, 1, 'pleine 2 sur 2', 2, 'aller', 2, false),
      (8, 1, 'pleine 4 sur 4', 4, 'aller', 4, false),
      (9, 1, 'pleine 6 sur 6', 6, 'aller', 6, false),
      (10, 2, 'ma place, 2 libres sur 4', 4, 'aller', 1, true),
      (11, 2, 'ma place, pleine 6 sur 6', 6, 'retour', 5, true),
      (12, 2, 'déjà une place à l''aller', 4, 'aller', 2, false),
      (13, 3, null, 4, 'aller', 2, false)
    ) as c (pos, trip, driver, seats, direction, taken, loic_in)
    order by pos
  loop
    v_trip := v_trips[v_case.trip];
    if v_case.driver is null then
      -- Voiture de Loic.
      select id into v_driver from participants where trip_id = v_trip and account_id = v_loic;
    else
      insert into accounts (email, name) values (format('cas.%s.test@example.com', v_case.pos), v_case.driver)
      on conflict do nothing;
      insert into participants (trip_id, account_id)
      select v_trip, id from accounts where email = format('cas.%s.test@example.com', v_case.pos)
      returning id into v_driver;
    end if;
    v_t := v_t + interval '1 second';
    insert into cars (trip_id, driver_id, seats, created_at) values (v_trip, v_driver, v_case.seats, v_t)
    returning id into v_car;
    insert into car_legs (car_id, direction, departs_at, meeting_point)
    values (
      v_car, v_case.direction,
      case v_case.direction when 'aller' then '2026-11-21 09:00:00+01' else '2026-11-22 17:00:00+01' end::timestamptz,
      case v_case.direction when 'aller' then 'Gare Part-Dieu, Lyon' end)
    returning id into v_leg;
    for i in 1..v_case.taken loop
      v_n := v_n + 1;
      insert into accounts (email, name) values (format('passager.%s.test@example.com', v_n), v_names[v_n])
      on conflict do nothing;
      insert into participants (trip_id, account_id)
      select v_trip, id from accounts where email = format('passager.%s.test@example.com', v_n)
      returning id into v_part;
      v_t := v_t + interval '1 second';
      insert into bookings (leg_id, participant_id, created_at) values (v_leg, v_part, v_t);
    end loop;
    if v_case.loic_in then
      v_t := v_t + interval '1 second';
      insert into bookings (leg_id, participant_id, created_at)
      select v_leg, id, v_t from participants where trip_id = v_trip and account_id = v_loic;
    end if;
  end loop;
end;
$$;
