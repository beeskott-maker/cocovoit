-- Authentification de la page de gestion des voyages par adresse email.
--
-- En plus de la clé de l'URL, la page demande une adresse email, vérifiée
-- ici à chaque appel. Seule l'empreinte SHA-256 de l'adresse autorisée (en
-- minuscules) est stockée. Pas d'envoi d'email : c'est un contrôle d'accès
-- simple, pas une preuve que la personne possède l'adresse.

create table public.admin_emails (
  email_hash bytea primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from public, anon, authenticated;

insert into public.admin_emails (email_hash)
values (decode('9c030fc7e0acba56648fb3977e8e9f0051081a0023e2e1dfb1b74b6769608faa', 'hex'));

-- Clé valide + adresse autorisée.
create function public._require_admin_user(p_key text, p_email text)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  perform _require_admin(p_key);
  if p_email is null or not exists (
    select 1 from admin_emails
    where email_hash = sha256(convert_to(lower(trim(p_email)), 'UTF8'))
  ) then
    raise exception 'Adresse email non autorisée' using errcode = '42501';
  end if;
end;
$$;

-- Les versions sans email sont remplacées.
drop function public.admin_list_trips(text);
drop function public.admin_delete_trip(text, text);

create function public.admin_list_trips(p_key text, p_email text)
returns json
language plpgsql stable security definer set search_path = public
as $$
begin
  perform _require_admin_user(p_key, p_email);
  return coalesce((
    select json_agg(json_build_object(
      'code', t.invite_code,
      'name', t.name,
      'destination', t.destination,
      'startsOn', t.starts_on,
      'endsOn', t.ends_on,
      'createdAt', t.created_at,
      'participants', (select count(*) from participants p where p.trip_id = t.id),
      'cars', (select count(*) from cars c where c.trip_id = t.id)
    ) order by t.created_at desc)
    from trips t), '[]'::json);
end;
$$;

-- Supprime un voyage et, en cascade, ses participants, voitures, trajets et réservations.
create function public.admin_delete_trip(p_key text, p_email text, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin_user(p_key, p_email);
  delete from trips where invite_code = p_code;
  if not found then
    raise exception 'Voyage introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public._require_admin_user(text, text) from public, anon, authenticated;
revoke all on function public.admin_list_trips(text, text), public.admin_delete_trip(text, text, text) from public;
grant execute on function public.admin_list_trips(text, text), public.admin_delete_trip(text, text, text) to anon, authenticated;
