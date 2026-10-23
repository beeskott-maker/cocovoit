-- Comptes utilisateurs stockés en base.
--
-- Une personne a un compte (email + nom). Elle se connecte avec son email,
-- sans vérification (choix assumé : priorité à la fluidité), et reçoit un
-- jeton de session : c'est la seule chose que le navigateur garde.
-- Les voyages qu'elle organise, les voitures qu'elle conduit et les places
-- qu'elle prend sont rattachés à son compte via « participants ».
--
-- Les anciennes données (sans compte) sont supprimées.

delete from public.trips;

-- ---------------------------------------------------------------------------
-- Comptes et sessions
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index accounts_email_idx on public.accounts (lower(email));

create table public.account_sessions (
  token uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index account_sessions_account_idx on public.account_sessions (account_id);

alter table public.accounts enable row level security;
alter table public.account_sessions enable row level security;
revoke all on public.accounts, public.account_sessions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Participants : rattachés à un compte (nom et email viennent du compte)
-- ---------------------------------------------------------------------------

drop index public.participants_trip_email_idx;
alter table public.participants
  drop column email,
  drop column name,
  drop column secret,
  add column account_id uuid not null references public.accounts (id) on delete cascade;
create unique index participants_trip_account_idx on public.participants (trip_id, account_id);
create index participants_account_idx on public.participants (account_id);

-- ---------------------------------------------------------------------------
-- Anciennes fonctions (code + secret par voyage)
-- ---------------------------------------------------------------------------

drop function public.create_trip(text, text, date, date, text, text);
drop function public.join_trip(text, text, text);
drop function public.get_trip_state(text, uuid);
drop function public.save_car(text, uuid, uuid, int, json);
drop function public.delete_car(text, uuid, uuid);
drop function public.take_seat(text, uuid, uuid);
drop function public.leave_seat(text, uuid, uuid);
drop function public.my_trips(json);
drop function public._participant(text, uuid);

-- ---------------------------------------------------------------------------
-- Helpers internes
-- ---------------------------------------------------------------------------

-- Compte de la session. Session inconnue : 28P01 (il faut se reconnecter).
create function public._account(p_token uuid)
returns public.accounts
language plpgsql stable security definer set search_path = public
as $$
declare
  v accounts;
begin
  select a.* into v
  from account_sessions s join accounts a on a.id = s.account_id
  where s.token = p_token;
  if not found then
    raise exception 'Session expirée, reconnectez-vous' using errcode = '28P01';
  end if;
  return v;
end;
$$;

-- Participation du compte connecté au voyage. Voyage inconnu : P0002 ;
-- compte qui n'a pas rejoint le voyage : 28000.
create function public._participant(p_token uuid, p_code text)
returns public.participants
language plpgsql stable security definer set search_path = public
as $$
declare
  v_account accounts := _account(p_token);
  v_trip_id uuid;
  v participants;
begin
  select id into v_trip_id from trips where invite_code = p_code;
  if v_trip_id is null then
    raise exception 'Voyage introuvable' using errcode = 'P0002';
  end if;
  select p.* into v from participants p where p.trip_id = v_trip_id and p.account_id = v_account.id;
  if not found then
    raise exception 'Vous ne participez pas à ce voyage' using errcode = '28000';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Connexion
-- ---------------------------------------------------------------------------

-- Connexion par email. Compte inconnu et pas de nom : {"status":"needs_name"}.
-- Avec un nom, le compte est créé. Renvoie un nouveau jeton de session.
create function public.login(p_email text, p_name text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v accounts;
  v_token uuid;
begin
  select * into v from accounts where lower(email) = lower(trim(p_email));
  if not found then
    if p_name is null or length(trim(p_name)) = 0 then
      return json_build_object('status', 'needs_name');
    end if;
    insert into accounts (email, name) values (trim(p_email), trim(p_name)) returning * into v;
  end if;
  insert into account_sessions (account_id) values (v.id) returning token into v_token;
  return json_build_object(
    'status', 'ok',
    'token', v_token,
    'account', json_build_object('email', v.email, 'name', v.name));
end;
$$;

create function public.me(p_token uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v accounts := _account(p_token);
begin
  return json_build_object('email', v.email, 'name', v.name);
end;
$$;

create function public.logout(p_token uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from account_sessions where token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- Voyages
-- ---------------------------------------------------------------------------

create function public.create_trip(
  p_token uuid, p_name text, p_destination text, p_starts_on date, p_ends_on date
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_account accounts := _account(p_token);
  v_trip trips;
begin
  insert into trips (name, destination, starts_on, ends_on)
  values (trim(p_name), nullif(trim(p_destination), ''), p_starts_on, p_ends_on)
  returning * into v_trip;
  insert into participants (trip_id, account_id, is_organizer) values (v_trip.id, v_account.id, true);
  return v_trip.invite_code;
end;
$$;

-- Rejoindre un voyage avec son compte (sans effet si on y est déjà).
create function public.join_trip(p_token uuid, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_account accounts := _account(p_token);
  v_trip_id uuid;
begin
  select id into v_trip_id from trips where invite_code = p_code;
  if v_trip_id is null then
    raise exception 'Voyage introuvable' using errcode = 'P0002';
  end if;
  insert into participants (trip_id, account_id) values (v_trip_id, v_account.id)
  on conflict (trip_id, account_id) do nothing;
end;
$$;

-- Voyages du compte : ceux qu'il organise, où il conduit ou a une place.
create function public.my_trips(p_token uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_account accounts := _account(p_token);
begin
  return coalesce((
    select json_agg(json_build_object(
      'code', t.invite_code,
      'name', t.name,
      'startsOn', t.starts_on,
      'endsOn', t.ends_on,
      'isOrganizer', p.is_organizer,
      'isDriver', exists (select 1 from cars c where c.driver_id = p.id),
      'isPassenger', exists (select 1 from bookings b where b.participant_id = p.id)
    ) order by t.starts_on, t.name)
    from participants p join trips t on t.id = p.trip_id
    where p.account_id = v_account.id), '[]'::json);
end;
$$;

create function public.get_trip_state(p_token uuid, p_code text)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
begin
  return (
    select json_build_object(
      'trip', json_build_object(
        'code', t.invite_code, 'name', t.name, 'destination', t.destination,
        'startsOn', t.starts_on, 'endsOn', t.ends_on),
      'me', (select json_build_object('id', v_me.id, 'name', a.name, 'isOrganizer', v_me.is_organizer)
             from accounts a where a.id = v_me.account_id),
      'cars', coalesce((
        select json_agg(json_build_object(
          'id', c.id,
          'seats', c.seats,
          'driver', json_build_object('id', d.id, 'name', da.name),
          'legs', coalesce((
            select json_agg(json_build_object(
              'id', l.id,
              'direction', l.direction,
              'departsAt', l.departs_at,
              'meetingPoint', l.meeting_point,
              'passengers', coalesce((
                select json_agg(json_build_object('id', p.id, 'name', pa.name) order by b.created_at)
                from bookings b
                join participants p on p.id = b.participant_id
                join accounts pa on pa.id = p.account_id
                where b.leg_id = l.id), '[]'::json)
            ) order by l.direction)
            from car_legs l where l.car_id = c.id), '[]'::json)
        ) order by c.created_at)
        from cars c
        join participants d on d.id = c.driver_id
        join accounts da on da.id = d.account_id
        where c.trip_id = t.id), '[]'::json)
    )
    from trips t where t.id = v_me.trip_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Voitures et places (mêmes règles qu'avant, identité par le compte)
-- ---------------------------------------------------------------------------

-- Crée (p_car_id null) ou met à jour la voiture du compte connecté.
-- p_legs : [{"direction":"aller","departsAt":"...","meetingPoint":"..."}, ...]
create function public.save_car(p_token uuid, p_code text, p_car_id uuid, p_seats int, p_legs json)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
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

create function public.delete_car(p_token uuid, p_code text, p_car_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
begin
  delete from cars where id = p_car_id and driver_id = v_me.id;
  if not found then
    raise exception 'Accès refusé' using errcode = '28000';
  end if;
end;
$$;

create function public.take_seat(p_token uuid, p_code text, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
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
  -- Une place par sens : il faut d'abord libérer sa place.
  if exists (
    select 1 from bookings b join car_legs l on l.id = b.leg_id
    where b.participant_id = v_me.id and l.direction = v_leg.direction and l.id <> v_leg.id
  ) then
    raise exception 'Vous avez déjà une place %', case v_leg.direction when 'aller' then 'à l''aller' else 'au retour' end
      using errcode = '22023';
  end if;

  if (select count(*) from bookings where leg_id = v_leg.id and participant_id <> v_me.id) >= v_car.seats then
    raise exception 'Plus de place disponible' using errcode = '22023';
  end if;

  insert into bookings (leg_id, participant_id) values (v_leg.id, v_me.id)
  on conflict do nothing;
end;
$$;

create function public.leave_seat(p_token uuid, p_code text, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
begin
  delete from bookings where leg_id = p_leg_id and participant_id = v_me.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke all on function public._account(uuid), public._participant(uuid, text) from public, anon, authenticated;
revoke all on function
  public.login(text, text),
  public.me(uuid),
  public.logout(uuid),
  public.create_trip(uuid, text, text, date, date),
  public.join_trip(uuid, text),
  public.my_trips(uuid),
  public.get_trip_state(uuid, text),
  public.save_car(uuid, text, uuid, int, json),
  public.delete_car(uuid, text, uuid),
  public.take_seat(uuid, text, uuid),
  public.leave_seat(uuid, text, uuid)
  from public;
grant execute on function
  public.login(text, text),
  public.me(uuid),
  public.logout(uuid),
  public.create_trip(uuid, text, text, date, date),
  public.join_trip(uuid, text),
  public.my_trips(uuid),
  public.get_trip_state(uuid, text),
  public.save_car(uuid, text, uuid, int, json),
  public.delete_car(uuid, text, uuid),
  public.take_seat(uuid, text, uuid),
  public.leave_seat(uuid, text, uuid)
  to anon, authenticated;
