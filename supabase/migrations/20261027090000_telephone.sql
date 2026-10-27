-- Numéro de téléphone facultatif, pour appeler ou écrire depuis la page du voyage.
--
-- Stocké au format international (+33612345678). Qui le voit :
-- - le numéro d'un chauffeur : tous les participants du voyage ;
-- - le numéro d'un passager : le chauffeur de la voiture où il a une place.

alter table public.accounts
  add column phone text check (phone ~ '^\+[1-9][0-9]{7,14}$');

-- Saisie libre (06 12 34 56 78, 0033…, +33 6…) → format international.
-- Vide : null. Numéro invalide : 22023.
create function public._phone(p_phone text)
returns text
language plpgsql immutable set search_path = public
as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[\s.()-]', '', 'g');
begin
  if v = '' then
    return null;
  end if;
  if v ~ '^00' then
    v := '+' || substr(v, 3);
  elsif v ~ '^0[1-9][0-9]{8}$' then
    v := '+33' || substr(v, 2);
  end if;
  if v !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Numéro de téléphone invalide' using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Connexion : le numéro n'est pris qu'à la création du compte.
drop function public.login(text, text);
create function public.login(p_email text, p_name text default null, p_phone text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v accounts;
  v_token uuid;
  v_known_name text;
begin
  select name into v_known_name from known_accounts
  where email_hash = sha256(convert_to(lower(trim(p_email)), 'UTF8'));

  select * into v from accounts where lower(email) = lower(trim(p_email));
  if not found then
    if v_known_name is null and (p_name is null or length(trim(p_name)) = 0) then
      return json_build_object('status', 'needs_name');
    end if;
    insert into accounts (email, name, phone)
    values (trim(p_email), coalesce(v_known_name, trim(p_name)), _phone(p_phone))
    returning * into v;
  elsif v_known_name is not null and v.name <> v_known_name then
    update accounts set name = v_known_name where id = v.id returning * into v;
  end if;
  insert into account_sessions (account_id) values (v.id) returning token into v_token;
  return json_build_object(
    'status', 'ok',
    'token', v_token,
    'account', json_build_object('email', v.email, 'name', v.name, 'phone', v.phone));
end;
$$;

create or replace function public.me(p_token uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v accounts := _account(p_token);
begin
  return json_build_object('email', v.email, 'name', v.name, 'phone', v.phone);
end;
$$;

-- Ajoute, change ou (vide) retire le numéro du compte connecté.
create function public.set_phone(p_token uuid, p_phone text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v accounts := _account(p_token);
begin
  update accounts set phone = _phone(p_phone) where id = v.id returning * into v;
  return json_build_object('email', v.email, 'name', v.name, 'phone', v.phone);
end;
$$;

create or replace function public.get_trip_state(p_token uuid, p_code text)
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
      'me', (select json_build_object('id', v_me.id, 'name', a.name, 'isOrganizer', v_me.is_organizer, 'phone', a.phone)
             from accounts a where a.id = v_me.account_id),
      'cars', coalesce((
        select json_agg(json_build_object(
          'id', c.id,
          'seats', c.seats,
          'driver', json_build_object('id', d.id, 'name', da.name, 'phone', da.phone),
          'legs', coalesce((
            select json_agg(json_build_object(
              'id', l.id,
              'direction', l.direction,
              'departsAt', l.departs_at,
              'meetingPoint', l.meeting_point,
              'passengers', coalesce((
                select json_agg(json_build_object(
                  'id', p.id,
                  'name', pa.name,
                  -- Numéro d'un passager : pour son chauffeur seulement.
                  'phone', case when c.driver_id = v_me.id then pa.phone end
                ) order by b.created_at)
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

revoke all on function public._phone(text) from public, anon, authenticated;
revoke all on function public.login(text, text, text), public.set_phone(uuid, text) from public;
grant execute on function public.login(text, text, text), public.set_phone(uuid, text) to anon, authenticated;
