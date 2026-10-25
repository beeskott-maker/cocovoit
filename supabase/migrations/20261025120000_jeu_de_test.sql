-- Remise à zéro des voyages à venir, à la demande de Loic, puis jeu de test.
--
-- 1. Supprime tous les voyages pas encore terminés (retour aujourd'hui ou plus
--    tard) ; les voyages passés sont gardés. Supprime aussi les comptes fictifs
--    du jeu « Test places » (adresses *.test@example.com).
-- 2. Insère pour Loic (compte connu d'avance, retrouvé par l'empreinte de son
--    adresse) trois voyages à venir plausibles, avec des participants fictifs
--    (adresses @example.com) : le même jeu que la version de test
--    (src/lib/demoData.ts, sans le voyage passé). Sans compte Loic (base de
--    test de la CI), seule la suppression a lieu.

delete from trips where ends_on >= current_date;
delete from accounts where email like 'cas.%.test@example.com' or email like 'passager.%.test@example.com';

do $$
declare
  v_loic uuid;
  v_trip uuid;
  v_car uuid;
  v_leg uuid;
begin
  select a.id into v_loic
  from accounts a
  join known_accounts k on k.email_hash = sha256(convert_to(lower(trim(a.email)), 'UTF8'))
  where k.name = 'Loic';
  if v_loic is null then
    raise notice 'Pas de compte Loic : jeu de test non inséré';
    return;
  end if;

  insert into accounts (email, name)
  select v.email, v.name
  from (values
    ('hugo@example.com', 'Hugo'),
    ('julie@example.com', 'Julie'),
    ('sarah@example.com', 'Sarah'),
    ('thomas@example.com', 'Thomas'),
    ('camille@example.com', 'Camille'),
    ('antoine@example.com', 'Antoine')
  ) as v (email, name)
  where not exists (select 1 from accounts a where lower(a.email) = v.email);

  -- Week-end à Annecy
  insert into trips (name, destination, starts_on, ends_on)
  values ('Week-end à Annecy', '12 rue Sainte-Claire, 74000 Annecy', '2026-11-14', '2026-11-15')
  returning id into v_trip;
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, v_loic, true);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'hugo@example.com'), false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'julie@example.com'), false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'sarah@example.com'), false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'thomas@example.com'), false);
  insert into cars (trip_id, driver_id, seats)
  values (v_trip, (select id from participants where trip_id = v_trip and account_id = v_loic), 3)
  returning id into v_car;
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'aller', '2026-11-14T08:00:00+01:00', 'Gare Part-Dieu, Lyon')
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'julie@example.com')));
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'sarah@example.com')));
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'retour', '2026-11-15T17:00:00+01:00', null)
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'julie@example.com')));
  insert into cars (trip_id, driver_id, seats)
  values (v_trip, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'hugo@example.com')), 4)
  returning id into v_car;
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'aller', '2026-11-14T09:30:00+01:00', 'Place Bellecour, Lyon')
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'thomas@example.com')));
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'retour', '2026-11-15T18:00:00+01:00', null)
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'thomas@example.com')));
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'sarah@example.com')));

  -- Ski à Val Thorens
  insert into trips (name, destination, starts_on, ends_on)
  values ('Ski à Val Thorens', 'Résidence Le Hameau du Kashmir, 73440 Val Thorens', '2027-01-23', '2027-01-30')
  returning id into v_trip;
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'julie@example.com'), true);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, v_loic, false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'thomas@example.com'), false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'camille@example.com'), false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'antoine@example.com'), false);
  insert into cars (trip_id, driver_id, seats)
  values (v_trip, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'thomas@example.com')), 4)
  returning id into v_car;
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'aller', '2027-01-23T07:00:00+01:00', 'Parking du métro Vaulx-en-Velin La Soie')
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = v_loic));
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'julie@example.com')));
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'retour', '2027-01-30T14:00:00+01:00', null)
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = v_loic));
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'julie@example.com')));
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'camille@example.com')));
  insert into cars (trip_id, driver_id, seats)
  values (v_trip, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'antoine@example.com')), 3)
  returning id into v_car;
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'aller', '2027-01-23T08:00:00+01:00', 'Gare de Chambéry')
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'camille@example.com')));

  -- Anniversaire de Camille
  insert into trips (name, destination, starts_on, ends_on)
  values ('Anniversaire de Camille', '24 rue de Marseille, 69007 Lyon', '2026-12-05', '2026-12-06')
  returning id into v_trip;
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'camille@example.com'), true);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, v_loic, false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'hugo@example.com'), false);
  insert into participants (trip_id, account_id, is_organizer) values (v_trip, (select id from accounts where email = 'sarah@example.com'), false);
  insert into cars (trip_id, driver_id, seats)
  values (v_trip, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'sarah@example.com')), 2)
  returning id into v_car;
  insert into car_legs (car_id, direction, departs_at, meeting_point)
  values (v_car, 'aller', '2026-12-05T19:00:00+01:00', 'Métro Saxe-Gambetta')
  returning id into v_leg;
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = v_loic));
  insert into bookings (leg_id, participant_id)
  values (v_leg, (select id from participants where trip_id = v_trip and account_id = (select id from accounts where email = 'hugo@example.com')));
end;
$$;
