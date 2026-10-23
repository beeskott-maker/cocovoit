-- Cocovoit : covoiturage pour un voyage entre proches.
--
-- Modèle d'accès : pas de comptes. Un voyage est identifié par un code
-- d'invitation (dans le lien partagé) et chaque participant reçoit un secret
-- personnel stocké dans son navigateur. Les tables ne sont pas accessibles
-- directement : le client passe uniquement par les fonctions RPC ci-dessous
-- (security definer), qui vérifient le couple code + secret.

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  name text not null check (length(trim(name)) between 1 and 120),
  destination text not null check (length(trim(destination)) between 1 and 300),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text not null check (length(trim(name)) between 1 and 80),
  secret uuid not null unique default gen_random_uuid(),
  is_organizer boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index participants_trip_email_idx on public.participants (trip_id, lower(email));

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  driver_id uuid not null references public.participants (id) on delete cascade,
  seats smallint not null check (seats between 1 and 8),
  created_at timestamptz not null default now()
);
create index cars_trip_idx on public.cars (trip_id);
-- Une personne conduit au plus une voiture par voyage.
create unique index cars_driver_idx on public.cars (driver_id);

create table public.car_legs (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  direction text not null check (direction in ('aller', 'retour')),
  departs_at timestamptz not null,
  meeting_point text check (meeting_point is null or length(meeting_point) <= 300),
  unique (car_id, direction)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  leg_id uuid not null references public.car_legs (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (leg_id, participant_id)
);
create index bookings_participant_idx on public.bookings (participant_id);

-- Aucune lecture/écriture directe depuis le client.
alter table public.trips enable row level security;
alter table public.participants enable row level security;
alter table public.cars enable row level security;
alter table public.car_legs enable row level security;
alter table public.bookings enable row level security;
revoke all on public.trips, public.participants, public.cars, public.car_legs, public.bookings
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers internes
-- ---------------------------------------------------------------------------

create function public._participant(p_code text, p_secret uuid)
returns public.participants
language plpgsql stable security definer set search_path = public
as $$
declare
  v public.participants;
begin
  select p.* into v
  from participants p join trips t on t.id = p.trip_id
  where t.invite_code = p_code and p.secret = p_secret;
  if not found then
    raise exception 'Accès refusé' using errcode = '28000';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- API publique (RPC)
-- ---------------------------------------------------------------------------

create function public.create_trip(
  p_name text, p_destination text, p_starts_on date, p_ends_on date,
  p_organizer_name text, p_organizer_email text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_trip trips;
  v_secret uuid;
begin
  insert into trips (name, destination, starts_on, ends_on)
  values (trim(p_name), trim(p_destination), p_starts_on, p_ends_on)
  returning * into v_trip;

  insert into participants (trip_id, email, name, is_organizer)
  values (v_trip.id, trim(p_organizer_email), trim(p_organizer_name), true)
  returning secret into v_secret;

  return json_build_object('code', v_trip.invite_code, 'secret', v_secret);
end;
$$;

create function public.get_trip_preview(p_code text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'code', invite_code, 'name', name, 'destination', destination,
    'startsOn', starts_on, 'endsOn', ends_on)
  from trips where invite_code = p_code;
$$;

-- Rejoindre un voyage. Sans nom : renvoie le secret si l'email est déjà connu,
-- sinon {"status":"needs_name"}. Avec nom : crée le participant si besoin.
create function public.join_trip(p_code text, p_email text, p_name text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_trip_id uuid;
  v_p participants;
begin
  select id into v_trip_id from trips where invite_code = p_code;
  if v_trip_id is null then
    raise exception 'Voyage introuvable' using errcode = 'P0002';
  end if;

  select * into v_p from participants
  where trip_id = v_trip_id and lower(email) = lower(trim(p_email));

  if not found then
    if p_name is null or length(trim(p_name)) = 0 then
      return json_build_object('status', 'needs_name');
    end if;
    insert into participants (trip_id, email, name)
    values (v_trip_id, trim(p_email), trim(p_name))
    returning * into v_p;
  end if;

  return json_build_object('status', 'ok', 'secret', v_p.secret, 'name', v_p.name);
end;
$$;

create function public.get_trip_state(p_code text, p_secret uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
begin
  return (
    select json_build_object(
      'trip', json_build_object(
        'code', t.invite_code, 'name', t.name, 'destination', t.destination,
        'startsOn', t.starts_on, 'endsOn', t.ends_on),
      'me', json_build_object('id', v_me.id, 'name', v_me.name, 'isOrganizer', v_me.is_organizer),
      'cars', coalesce((
        select json_agg(json_build_object(
          'id', c.id,
          'seats', c.seats,
          'driver', json_build_object('id', d.id, 'name', d.name),
          'legs', coalesce((
            select json_agg(json_build_object(
              'id', l.id,
              'direction', l.direction,
              'departsAt', l.departs_at,
              'meetingPoint', l.meeting_point,
              'passengers', coalesce((
                select json_agg(json_build_object('id', p.id, 'name', p.name) order by b.created_at)
                from bookings b join participants p on p.id = b.participant_id
                where b.leg_id = l.id), '[]'::json)
            ) order by l.direction)
            from car_legs l where l.car_id = c.id), '[]'::json)
        ) order by c.created_at)
        from cars c join participants d on d.id = c.driver_id
        where c.trip_id = t.id), '[]'::json)
    )
    from trips t where t.id = v_me.trip_id
  );
end;
$$;

-- Crée (p_car_id null) ou met à jour la voiture du participant.
-- p_legs : [{"direction":"aller","departsAt":"...","meetingPoint":"..."}, ...]
create function public.save_car(p_code text, p_secret uuid, p_car_id uuid, p_seats int, p_legs json)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
  v_car_id uuid := p_car_id;
  v_leg json;
  v_dir text;
  v_kept text[] := '{}';
begin
  if json_array_length(p_legs) = 0 then
    raise exception 'Indiquez au moins un trajet' using errcode = '22023';
  end if;

  if v_car_id is null then
    insert into cars (trip_id, driver_id, seats)
    values (v_me.trip_id, v_me.id, p_seats)
    returning id into v_car_id;
  else
    update cars set seats = p_seats
    where id = v_car_id and driver_id = v_me.id;
    if not found then
      raise exception 'Accès refusé' using errcode = '28000';
    end if;
  end if;

  for v_leg in select * from json_array_elements(p_legs) loop
    v_dir := v_leg->>'direction';
    if v_dir = any (v_kept) then
      raise exception 'Trajet en double' using errcode = '22023';
    end if;
    v_kept := v_kept || v_dir;

    -- Le conducteur ne peut pas être passager d'une autre voiture dans le même sens.
    delete from bookings b using car_legs l
    where b.leg_id = l.id and b.participant_id = v_me.id and l.direction = v_dir;

    insert into car_legs (car_id, direction, departs_at, meeting_point)
    values (v_car_id, v_dir, (v_leg->>'departsAt')::timestamptz, nullif(trim(v_leg->>'meetingPoint'), ''))
    on conflict (car_id, direction) do update
      set departs_at = excluded.departs_at, meeting_point = excluded.meeting_point;
  end loop;

  delete from car_legs where car_id = v_car_id and direction <> all (v_kept);

  -- Si on réduit le nombre de places, les dernières réservations sautent.
  delete from bookings where id in (
    select id from (
      select b.id, row_number() over (partition by b.leg_id order by b.created_at) as rank
      from bookings b join car_legs l on l.id = b.leg_id
      where l.car_id = v_car_id
    ) ranked where rank > p_seats
  );

  return v_car_id;
end;
$$;

create function public.delete_car(p_code text, p_secret uuid, p_car_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
begin
  delete from cars where id = p_car_id and driver_id = v_me.id;
  if not found then
    raise exception 'Accès refusé' using errcode = '28000';
  end if;
end;
$$;

create function public.take_seat(p_code text, p_secret uuid, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
  v_leg car_legs;
  v_car cars;
begin
  -- Verrou sur le trajet pour éviter de dépasser le nombre de places.
  select l.* into v_leg from car_legs l where l.id = p_leg_id for update;
  select c.* into v_car from cars c where c.id = v_leg.car_id;
  if v_car.id is null or v_car.trip_id <> v_me.trip_id then
    raise exception 'Trajet introuvable' using errcode = 'P0002';
  end if;
  if v_car.driver_id = v_me.id then
    raise exception 'Vous conduisez cette voiture' using errcode = '22023';
  end if;
  if exists (
    select 1 from cars c join car_legs l on l.car_id = c.id
    where c.driver_id = v_me.id and l.direction = v_leg.direction
  ) then
    raise exception 'Vous conduisez déjà sur ce trajet' using errcode = '22023';
  end if;

  -- Une seule place par sens : on libère l'éventuelle place prise ailleurs.
  delete from bookings b using car_legs l
  where b.leg_id = l.id and b.participant_id = v_me.id
    and l.direction = v_leg.direction and l.id <> v_leg.id;

  if (select count(*) from bookings where leg_id = v_leg.id and participant_id <> v_me.id) >= v_car.seats then
    raise exception 'Plus de place disponible' using errcode = '22023';
  end if;

  insert into bookings (leg_id, participant_id) values (v_leg.id, v_me.id)
  on conflict do nothing;
end;
$$;

create function public.leave_seat(p_code text, p_secret uuid, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
begin
  delete from bookings where leg_id = p_leg_id and participant_id = v_me.id;
end;
$$;

revoke all on function public._participant(text, uuid) from public, anon, authenticated;
revoke all on function
  public.create_trip(text, text, date, date, text, text),
  public.get_trip_preview(text),
  public.join_trip(text, text, text),
  public.get_trip_state(text, uuid),
  public.save_car(text, uuid, uuid, int, json),
  public.delete_car(text, uuid, uuid),
  public.take_seat(text, uuid, uuid),
  public.leave_seat(text, uuid, uuid)
  from public;
grant execute on function
  public.create_trip(text, text, date, date, text, text),
  public.get_trip_preview(text),
  public.join_trip(text, text, text),
  public.get_trip_state(text, uuid),
  public.save_car(text, uuid, uuid, int, json),
  public.delete_car(text, uuid, uuid),
  public.take_seat(text, uuid, uuid),
  public.leave_seat(text, uuid, uuid)
  to anon, authenticated;
