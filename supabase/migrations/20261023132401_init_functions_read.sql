-- Fonctions RPC de lecture et d'inscription (voir 20261023132329_init_tables.sql).

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
