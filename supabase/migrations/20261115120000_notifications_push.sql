-- Notifications push (appli installée ou navigateur compatible).
--
-- La base décide quoi envoyer et à qui : elle remplit la file push_outbox.
-- La fonction Supabase « push-send » (supabase/functions/push-send) vide cette
-- file : chiffrement Web Push et envoi aux appareils abonnés. pg_cron l'appelle
-- chaque minute quand la file n'est pas vide.
--
-- Notifications :
--   - au conducteur : quelqu'un monte dans sa voiture, quelqu'un libère sa place
--     (1 à 2 min plus tard, rien si la personne se ravise entre-temps) ;
--   - au passager : sa place est annulée (voiture supprimée, trajet retiré,
--     places réduites), le départ est modifié (heure ou point de rendez-vous) ;
--   - à tous : rappel la veille du départ, vers 18 h.

-- Adresse de la fonction d'envoi (rien n'est envoyé tant qu'elle est vide).
create table public.push_settings (
  id boolean primary key default true check (id),
  function_url text
);
insert into public.push_settings (function_url)
values ('https://luzhckdzaqczobwpwozt.supabase.co/functions/v1/push-send');

-- Clés VAPID, créées par la fonction d'envoi à son premier appel. La clé privée
-- ne sort jamais de la base et de la fonction (table fermée).
create table public.push_vapid_keys (
  id boolean primary key default true check (id),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);

-- Un abonnement par appareil (navigateur ou appli installée).
create table public.push_subscriptions (
  endpoint text primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_account_idx on public.push_subscriptions (account_id);

-- File d'envoi : une ligne par notification et par compte.
create table public.push_outbox (
  id bigserial primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text not null,
  body text not null,
  url text not null,
  tag text,
  created_at timestamptz not null default now()
);

-- Place libérée : avis au conducteur différé (annulé si la personne reprend la place).
create table public.seat_left_notices (
  leg_id uuid not null references public.car_legs (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  due_at timestamptz not null,
  primary key (leg_id, participant_id)
);

-- Départ modifié : avis aux passagers différé (plusieurs retouches = un seul avis).
create table public.leg_change_notices (
  leg_id uuid primary key references public.car_legs (id) on delete cascade,
  due_at timestamptz not null
);

alter table public.push_settings enable row level security;
alter table public.push_vapid_keys enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_outbox enable row level security;
alter table public.seat_left_notices enable row level security;
alter table public.leg_change_notices enable row level security;
revoke all on public.push_settings, public.push_vapid_keys, public.push_subscriptions, public.push_outbox,
  public.seat_left_notices, public.leg_change_notices from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Abonnement depuis l'appli
-- ---------------------------------------------------------------------------

-- Clé publique VAPID (null tant que la fonction d'envoi n'a jamais tourné).
create function public.push_public_key()
returns text
language sql stable security definer set search_path = public
as $$
  select public_key from push_vapid_keys;
$$;

create function public.push_subscribe(p_token uuid, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v accounts := _account(p_token);
begin
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or coalesce(length(p_p256dh), 0) not between 40 and 200
     or coalesce(length(p_auth), 0) not between 10 and 100 then
    raise exception 'Abonnement invalide' using errcode = '22023';
  end if;
  insert into push_subscriptions (endpoint, account_id, p256dh, auth)
  values (p_endpoint, v.id, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create function public.push_unsubscribe(p_token uuid, p_endpoint text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v accounts := _account(p_token);
begin
  delete from push_subscriptions where endpoint = p_endpoint and account_id = v.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Outils
-- ---------------------------------------------------------------------------

-- Met une notification en file, seulement si le compte a au moins un appareil abonné.
create function public._push_enqueue(p_account uuid, p_title text, p_body text, p_url text, p_tag text)
returns void
language sql security definer set search_path = public
as $$
  insert into push_outbox (account_id, title, body, url, tag)
  select p_account, p_title, p_body, p_url, p_tag
  where exists (select 1 from push_subscriptions where account_id = p_account);
$$;

create function public._trip_url(p_trip_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select s.site_url || '#/t/' || t.invite_code from trips t, email_settings s where t.id = p_trip_id;
$$;

-- « 8h05 », heure de Paris.
create function public._format_hour(p timestamptz)
returns text
language sql stable
as $$
  select extract(hour from p at time zone 'Europe/Paris')::int || 'h' || to_char(p at time zone 'Europe/Paris', 'MI');
$$;

create function public._direction_label(p text)
returns text
language sql immutable
as $$
  select case p when 'aller' then 'Aller' else 'Retour' end;
$$;

create function public._participant_name(p_participant_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select a.name from participants p join accounts a on a.id = p.account_id where p.id = p_participant_id;
$$;

-- « Il reste 2 places sur 4. » / « Voiture complète 🎉 »
create function public._seats_left_text(p_leg_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when c.seats - n <= 0 then 'Voiture complète 🎉'
    when c.seats - n = 1 then 'Il reste 1 place sur ' || c.seats || '.'
    else 'Il reste ' || (c.seats - n) || ' places sur ' || c.seats || '.'
  end
  from car_legs l join cars c on c.id = l.car_id,
    lateral (select count(*)::int as n from bookings b where b.leg_id = l.id) k
  where l.id = p_leg_id;
$$;

-- ---------------------------------------------------------------------------
-- Places prises et libérées (avis au conducteur, différés)
-- ---------------------------------------------------------------------------

-- Place prise : si la personne venait de libérer cette même place, rien n'a
-- changé pour le conducteur (l'avis « place libérée » est simplement retiré).
create or replace function public._queue_passenger_notice()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from seat_left_notices where leg_id = new.leg_id and participant_id = new.participant_id;
  if found then
    return null;
  end if;
  insert into passenger_notices (car_id, participant_id, due_at)
  select l.car_id, new.participant_id, now() + interval '1 minute'
  from car_legs l where l.id = new.leg_id
  on conflict (car_id, participant_id) do update set due_at = excluded.due_at;
  return null;
end;
$$;

-- Place supprimée :
--   - libérée par le passager (leave_seat) : avis « place libérée » différé au
--     conducteur, sauf si son arrivée ne lui a pas encore été annoncée ;
--   - annulée par le conducteur (places réduites) : notification au passager ;
--   - voiture ou trajet supprimés, compte ou voyage supprimés : traités ailleurs ou ignorés.
create or replace function public._cancel_passenger_notice()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_leg car_legs;
  v_car cars;
  v_trip trips;
  v_pending boolean;
begin
  select * into v_leg from car_legs where id = old.leg_id;
  select * into v_car from cars where id = v_leg.car_id;
  select * into v_trip from trips where id = v_car.trip_id;
  if v_leg.id is null or v_car.id is null or v_trip.id is null
     or not exists (select 1 from participants where id = old.participant_id) then
    return null;
  end if;

  v_pending := exists (select 1 from passenger_notices where car_id = v_car.id and participant_id = old.participant_id);
  -- Plus aucune place dans cette voiture : l'arrivée pas encore annoncée ne l'est plus.
  delete from passenger_notices n
  where n.car_id = v_car.id and n.participant_id = old.participant_id
    and not exists (select 1 from bookings b join car_legs l2 on l2.id = b.leg_id
                    where l2.car_id = v_car.id and b.participant_id = old.participant_id);

  if current_setting('cocovoit.seat_left', true) = 'on' then
    if not v_pending then
      insert into seat_left_notices (leg_id, participant_id, due_at)
      values (old.leg_id, old.participant_id, now() + interval '1 minute')
      on conflict (leg_id, participant_id) do update set due_at = excluded.due_at;
    end if;
  else
    perform _push_enqueue((select account_id from participants where id = old.participant_id),
      'Ta place a été annulée 😕',
      v_trip.name || ' · ' || _direction_label(v_leg.direction) || ' : '
        || coalesce(_participant_name(v_car.driver_id), 'le conducteur')
        || ' a réduit le nombre de places. Choisis une autre voiture.',
      _trip_url(v_trip.id), 'place-' || old.leg_id);
  end if;
  return null;
end;
$$;

-- Le passager libère sa place : marqué pour le déclencheur ci-dessus.
create or replace function public.leave_seat(p_token uuid, p_code text, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
begin
  perform set_config('cocovoit.seat_left', 'on', true);
  delete from bookings where leg_id = p_leg_id and participant_id = v_me.id;
  perform set_config('cocovoit.seat_left', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Voiture ou trajet supprimés, départ modifié (avis aux passagers)
-- ---------------------------------------------------------------------------

create function public._push_car_removed()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_trip trips;
  r record;
begin
  select * into v_trip from trips where id = old.trip_id;
  if v_trip.id is null then
    return old; -- voyage supprimé : rien à annoncer
  end if;
  for r in
    select distinct p.account_id from bookings b
      join car_legs l on l.id = b.leg_id join participants p on p.id = b.participant_id
    where l.car_id = old.id
  loop
    perform _push_enqueue(r.account_id, 'Ta place a été annulée 😕',
      v_trip.name || ' · ' || coalesce(_participant_name(old.driver_id), 'Le conducteur')
        || ' a retiré sa voiture. Choisis une autre voiture.',
      _trip_url(v_trip.id), 'voiture-' || old.id);
  end loop;
  return old;
end;
$$;

create function public._push_leg_removed()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_car cars;
  v_trip trips;
  r record;
begin
  select * into v_car from cars where id = old.car_id;
  select * into v_trip from trips where id = v_car.trip_id;
  if v_car.id is null or v_trip.id is null then
    return old; -- voiture ou voyage supprimés : déjà annoncé, ou rien à annoncer
  end if;
  for r in
    select p.account_id from bookings b join participants p on p.id = b.participant_id where b.leg_id = old.id
  loop
    perform _push_enqueue(r.account_id, 'Ta place a été annulée 😕',
      v_trip.name || ' · ' || coalesce(_participant_name(v_car.driver_id), 'Le conducteur')
        || ' ne fait plus ' || case old.direction when 'aller' then 'l''aller' else 'le retour' end
        || '. Choisis une autre voiture.',
      _trip_url(v_trip.id), 'place-' || old.id);
  end loop;
  return old;
end;
$$;

create function public._queue_leg_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.departs_at is distinct from old.departs_at or new.meeting_point is distinct from old.meeting_point then
    insert into leg_change_notices (leg_id, due_at) values (new.id, now() + interval '1 minute')
    on conflict (leg_id) do update set due_at = excluded.due_at;
  end if;
  return null;
end;
$$;

create trigger cars_push_removed before delete on public.cars
  for each row execute function public._push_car_removed();
create trigger car_legs_push_removed before delete on public.car_legs
  for each row execute function public._push_leg_removed();
create trigger car_legs_queue_change after update on public.car_legs
  for each row execute function public._queue_leg_change();

-- « 12 rue Sainte-Claire » → « RDV : 12 rue Sainte-Claire. »
create function public._meeting_text(p text)
returns text
language sql immutable
as $$
  select case when nullif(trim(p), '') is null then '' else ' RDV : ' || trim(p) || '.' end;
$$;

-- ---------------------------------------------------------------------------
-- Envoi des avis échus (chaque minute, avec pg_cron)
-- ---------------------------------------------------------------------------

create or replace function public._send_due_passenger_notices()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  n record;
  v_leg uuid;
  m json;
  v_count int := 0;
  v_trip trips;
  v_driver_account uuid;
  v_name text;
  v_body text;
begin
  -- Arrivées : email (si activé) et notification au conducteur.
  for n in
    delete from passenger_notices where due_at <= now() returning car_id, participant_id
  loop
    v_count := v_count + 1;
    select b.leg_id into v_leg from bookings b join car_legs l on l.id = b.leg_id
      where l.car_id = n.car_id and b.participant_id = n.participant_id order by l.direction limit 1;
    continue when v_leg is null;
    select t.* into v_trip from cars c join trips t on t.id = c.trip_id where c.id = n.car_id;
    select p.account_id into v_driver_account from cars c join participants p on p.id = c.driver_id where c.id = n.car_id;
    v_name := _participant_name(n.participant_id);
    if (select count(*) from bookings b join car_legs l on l.id = b.leg_id
        where l.car_id = n.car_id and b.participant_id = n.participant_id) > 1 then
      v_body := v_trip.name || ' · Aller et retour.';
    else
      v_body := v_trip.name || ' · ' || _direction_label((select direction from car_legs where id = v_leg))
        || '. ' || _seats_left_text(v_leg);
    end if;
    perform _push_enqueue(v_driver_account, v_name || ' monte dans ta voiture 🥥', v_body,
      _trip_url(v_trip.id), 'passager-' || n.car_id || '-' || n.participant_id);

    if coalesce((select passenger_notice_enabled from email_settings), false) then
      begin
        m := _new_passenger_email(v_leg, n.participant_id);
        perform _send_email(m->>'to', m->>'subject', m->>'html', m->>'text');
      exception when others then
        raise warning 'Email au conducteur non envoyé : %', sqlerrm;
      end;
    end if;
  end loop;

  -- Places libérées : une notification par passager et par voiture.
  for n in
    with due as (
      delete from seat_left_notices where due_at <= now() returning leg_id, participant_id
    )
    select l.car_id, d.participant_id, array_agg(l.direction order by l.direction) as directions,
      (array_agg(l.id order by l.direction))[1] as leg_id
    from due d join car_legs l on l.id = d.leg_id
    group by l.car_id, d.participant_id
  loop
    v_count := v_count + 1;
    select t.* into v_trip from cars c join trips t on t.id = c.trip_id where c.id = n.car_id;
    select p.account_id into v_driver_account from cars c join participants p on p.id = c.driver_id where c.id = n.car_id;
    v_name := _participant_name(n.participant_id);
    continue when v_name is null;
    if array_length(n.directions, 1) > 1 then
      perform _push_enqueue(v_driver_account, v_name || ' a libéré ses places',
        v_trip.name || ' · Aller et retour.', _trip_url(v_trip.id), 'parti-' || n.car_id || '-' || n.participant_id);
    else
      perform _push_enqueue(v_driver_account, v_name || ' a libéré sa place',
        v_trip.name || ' · ' || _direction_label(n.directions[1]) || '. ' || _seats_left_text(n.leg_id),
        _trip_url(v_trip.id), 'parti-' || n.car_id || '-' || n.participant_id);
    end if;
  end loop;

  -- Départs modifiés : notification aux passagers du trajet.
  for n in
    with due as (delete from leg_change_notices where due_at <= now() returning leg_id)
    select l.*, c.driver_id, c.trip_id from due d join car_legs l on l.id = d.leg_id join cars c on c.id = l.car_id
  loop
    v_count := v_count + 1;
    select * into v_trip from trips where id = n.trip_id;
    perform _push_enqueue(p.account_id, 'Départ modifié',
      v_trip.name || ' · ' || _direction_label(n.direction) || ' : départ à ' || _format_hour(n.departs_at)
        || ' avec ' || coalesce(_participant_name(n.driver_id), 'le conducteur') || '.' || _meeting_text(n.meeting_point),
      _trip_url(v_trip.id), 'depart-' || n.id)
    from bookings b join participants p on p.id = b.participant_id where b.leg_id = n.id;
  end loop;

  perform _push_kick();
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rappel la veille (chaque jour vers 18 h)
-- ---------------------------------------------------------------------------

create function public._push_daily_reminders()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_passengers int;
begin
  for r in
    select l.*, c.driver_id, t.id as trip_id, t.name as trip_name
    from car_legs l join cars c on c.id = l.car_id join trips t on t.id = c.trip_id
    where (l.departs_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date + 1
  loop
    select count(*) into v_passengers from bookings where leg_id = r.id;
    -- Conducteur
    perform _push_enqueue(p.account_id, 'C''est demain ! 🚗',
      r.trip_name || ' · ' || _direction_label(r.direction) || ' : départ à ' || _format_hour(r.departs_at)
        || case v_passengers when 0 then '.' when 1 then ', 1 passager.' else ', ' || v_passengers || ' passagers.' end
        || _meeting_text(r.meeting_point),
      _trip_url(r.trip_id), 'demain-' || r.id)
    from participants p where p.id = r.driver_id;
    -- Passagers
    perform _push_enqueue(p.account_id, 'C''est demain ! 🚗',
      r.trip_name || ' · ' || _direction_label(r.direction) || ' : départ à ' || _format_hour(r.departs_at)
        || ' avec ' || coalesce(_participant_name(r.driver_id), 'le conducteur') || '.' || _meeting_text(r.meeting_point),
      _trip_url(r.trip_id), 'demain-' || r.id)
    from bookings b join participants p on p.id = b.participant_id where b.leg_id = r.id;
    v_count := v_count + 1;
  end loop;
  perform _push_kick();
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fonction d'envoi (rôle service_role uniquement)
-- ---------------------------------------------------------------------------

-- Réveille la fonction d'envoi si la file n'est pas vide (pg_net, absent d'un Postgres nu).
create function public._push_kick()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_url text := (select function_url from push_settings);
begin
  if v_url is null or not exists (select 1 from push_outbox)
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'net' and p.proname = 'http_post') then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url, '{}'::jsonb, jsonb_build_object('content-type', 'application/json');
end;
$$;

create function public._push_keys()
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object('publicKey', public_key, 'privateJwk', private_jwk) from push_vapid_keys;
$$;

-- Enregistre les clés si aucune n'existe ; renvoie celles qui sont en place.
create function public._push_set_keys(p_public text, p_private jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  insert into push_vapid_keys (public_key, private_jwk) values (p_public, p_private) on conflict (id) do nothing;
  return _push_keys();
end;
$$;

-- Retire jusqu'à p_limit notifications de la file, avec les appareils à prévenir.
create function public._push_take_batch(p_limit int)
returns json
language sql security definer set search_path = public
as $$
  with taken as (
    delete from push_outbox where id in (
      select id from push_outbox order by id limit p_limit for update skip locked
    )
    returning account_id, title, body, url, tag, created_at
  )
  select coalesce(json_agg(json_build_object(
    'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
    'payload', json_build_object('title', t.title, 'body', t.body, 'url', t.url, 'tag', t.tag)
  )), '[]'::json)
  from taken t join push_subscriptions s on s.account_id = t.account_id
  where t.created_at > now() - interval '1 day';
$$;

-- Appareils qui ont refusé l'envoi (abonnement expiré ou retiré).
create function public._push_forget(p_endpoints text[])
returns void
language sql security definer set search_path = public
as $$
  delete from push_subscriptions where endpoint = any (p_endpoints);
$$;

revoke all on function
  public._push_enqueue(uuid, text, text, text, text), public._trip_url(uuid), public._format_hour(timestamptz),
  public._direction_label(text), public._participant_name(uuid), public._seats_left_text(uuid),
  public._push_car_removed(), public._push_leg_removed(), public._queue_leg_change(), public._meeting_text(text),
  public._push_daily_reminders(), public._push_kick(), public._push_keys(), public._push_set_keys(text, jsonb),
  public._push_take_batch(int), public._push_forget(text[])
  from public, anon, authenticated;
grant execute on function public._push_keys(), public._push_set_keys(text, jsonb),
  public._push_take_batch(int), public._push_forget(text[]) to service_role;
grant execute on function public.push_public_key(), public.push_subscribe(uuid, text, text, text),
  public.push_unsubscribe(uuid, text) to anon, authenticated;

-- Rappel la veille : chaque jour à 17 h UTC (18 h à Paris l'hiver, 19 h l'été).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron indisponible : pas de rappel la veille';
    return;
  end if;
  execute $sql$select cron.schedule('rappel-veille-depart', '0 17 * * *',
    'select public._push_daily_reminders()')$sql$;
end;
$$;
