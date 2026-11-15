-- Notifications push à ceux qui n'ont pas encore de place sur un trajet
-- (ni conducteur, ni passager dans ce sens) :
--   - nouvelle voiture : 2 min après son ajout (le temps que le conducteur
--     ajuste ses trajets), si elle a des places dans un sens qui leur manque ;
--   - 3 jours avant le premier départ d'un sens (vers 9 h), s'il reste des places.

-- « d'Hugo », « de Julie »
create function public._de(p_name text)
returns text
language sql immutable
as $$
  select case when p_name ~* '^[aeiouyhàâäéèêëîïôöûüœ]' then 'd''' else 'de ' end || p_name;
$$;

create function public._places(n int)
returns text
language sql immutable
as $$
  select n || case when n > 1 then ' places' else ' place' end;
$$;

-- Places libres d'un trajet.
create function public._free_seats(p_leg_id uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select c.seats - (select count(*)::int from bookings b where b.leg_id = l.id)
  from car_legs l join cars c on c.id = l.car_id where l.id = p_leg_id;
$$;

-- Le participant n'a pas de place dans ce sens (et ne conduit pas).
create function public._without_seat(p_participant_id uuid, p_direction text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from cars where driver_id = p_participant_id)
     and not exists (select 1 from bookings b join car_legs l on l.id = b.leg_id
                     where b.participant_id = p_participant_id and l.direction = p_direction);
$$;

-- ---------------------------------------------------------------------------
-- Nouvelle voiture
-- ---------------------------------------------------------------------------

create table public.new_car_notices (
  car_id uuid primary key references public.cars (id) on delete cascade,
  due_at timestamptz not null
);
alter table public.new_car_notices enable row level security;
revoke all on public.new_car_notices from public, anon, authenticated;

create function public._queue_new_car()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into new_car_notices (car_id, due_at) values (new.id, now() + interval '2 minutes');
  return null;
end;
$$;

create trigger cars_queue_new after insert on public.cars
  for each row execute function public._queue_new_car();

create function public._send_due_new_car_notices()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  n record;
  r record;
  v_count int := 0;
  v_driver text;
begin
  for n in
    with due as (delete from new_car_notices where due_at <= now() returning car_id)
    select c.*, t.name as trip_name from due d join cars c on c.id = d.car_id join trips t on t.id = c.trip_id
  loop
    v_count := v_count + 1;
    v_driver := coalesce(_participant_name(n.driver_id), 'Quelqu''un');
    for r in
      -- Pour chaque personne : les sens de la voiture où il lui manque une place.
      select p.account_id,
        array_agg(l.direction order by l.direction) as directions,
        min(_free_seats(l.id)) as low, max(_free_seats(l.id)) as high
      from participants p
        join car_legs l on l.car_id = n.id and l.departs_at > now() and _free_seats(l.id) > 0
      where p.trip_id = n.trip_id and p.id <> n.driver_id and _without_seat(p.id, l.direction)
      group by p.account_id
    loop
      perform _push_enqueue(r.account_id, 'Nouvelle voiture 🚗',
        n.trip_name || ' · ' || v_driver || ' propose '
          || case
               when array_length(r.directions, 1) > 1 and r.low <> r.high then 'des places à l''aller et au retour.'
               when array_length(r.directions, 1) > 1 then _places(r.low) || ' à l''aller et au retour.'
               when r.directions[1] = 'aller' then _places(r.low) || ' pour l''aller.'
               else _places(r.low) || ' pour le retour.'
             end,
        _trip_url(n.trip_id), 'voiture-' || n.id);
    end loop;
  end loop;
  perform _push_kick();
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pas encore de place, 3 jours avant le départ
-- ---------------------------------------------------------------------------

-- « il reste 2 places dans la voiture d'Hugo » / « … et 1 dans celle de Julie » /
-- « il reste 5 places dans 3 voitures » (null s'il ne reste aucune place).
create function public._seats_offer_text(p_trip_id uuid, p_direction text)
returns text
language sql stable security definer set search_path = public
as $$
  with free as (
    select _participant_name(c.driver_id) as driver, _free_seats(l.id) as n
    from cars c join car_legs l on l.car_id = c.id
    where c.trip_id = p_trip_id and l.direction = p_direction and l.departs_at > now()
  ),
  offer as (
    select driver, n, row_number() over (order by n desc, driver) as rank from free where n > 0
  )
  select case count(*)
    when 0 then null
    when 1 then 'il reste ' || _places(max(n)) || ' dans la voiture ' || _de(max(driver))
    when 2 then 'il reste ' || _places(max(n) filter (where rank = 1)) || ' dans la voiture '
      || _de(max(driver) filter (where rank = 1)) || ' et ' || max(n) filter (where rank = 2)
      || ' dans celle ' || _de(max(driver) filter (where rank = 2))
    else 'il reste ' || _places(sum(n)::int) || ' dans ' || count(*) || ' voitures'
  end
  from offer;
$$;

create function public._push_seat_reminders()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_offer text;
  v_count int := 0;
begin
  for r in
    -- Sens dont le premier départ a lieu dans 3 jours (heure de Paris).
    select t.id as trip_id, t.name as trip_name, l.direction
    from trips t join cars c on c.trip_id = t.id join car_legs l on l.car_id = c.id
    group by t.id, t.name, l.direction
    having (min(l.departs_at) at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date + 3
  loop
    v_offer := _seats_offer_text(r.trip_id, r.direction);
    continue when v_offer is null;
    perform _push_enqueue(p.account_id, 'Pas encore de place 🙋',
      r.trip_name || ' · ' || _direction_label(r.direction) || ' : ' || v_offer || '.',
      _trip_url(r.trip_id), 'sans-place-' || r.trip_id || '-' || r.direction)
    from participants p
    where p.trip_id = r.trip_id and _without_seat(p.id, r.direction);
    v_count := v_count + 1;
  end loop;
  perform _push_kick();
  return v_count;
end;
$$;

revoke all on function
  public._de(text), public._places(int), public._free_seats(uuid), public._without_seat(uuid, text),
  public._queue_new_car(), public._send_due_new_car_notices(), public._seats_offer_text(uuid, text),
  public._push_seat_reminders()
  from public, anon, authenticated;

-- Nouvelle voiture : chaque minute. Pas encore de place : chaque jour à 8 h UTC (9 h à Paris l'hiver).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron indisponible : pas de notification nouvelle voiture ni sans place';
    return;
  end if;
  execute $sql$select cron.schedule('avis-nouvelle-voiture', '* * * * *',
    'select public._send_due_new_car_notices()')$sql$;
  execute $sql$select cron.schedule('relance-sans-place', '0 8 * * *',
    'select public._push_seat_reminders()')$sql$;
end;
$$;
