-- Page de gestion des voyages (liste + suppression), protégée par une clé.
--
-- La clé elle-même n'est jamais stockée : seule son empreinte SHA-256 l'est.
-- La page est servie à l'URL #/x/<clé> ; une mauvaise clé est refusée.

create table public.admin_keys (
  key_hash bytea primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_keys enable row level security;
revoke all on public.admin_keys from public, anon, authenticated;

insert into public.admin_keys (key_hash)
values (decode('49b9cde65ea18ebc7613c66db0939f0dfe4f725c5efe022149b7e729dcbaeb19', 'hex'));

create function public._require_admin(p_key text)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_key is null or not exists (
    select 1 from admin_keys where key_hash = sha256(convert_to(p_key, 'UTF8'))
  ) then
    raise exception 'Accès refusé' using errcode = '28000';
  end if;
end;
$$;

create function public.admin_list_trips(p_key text)
returns json
language plpgsql stable security definer set search_path = public
as $$
begin
  perform _require_admin(p_key);
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
create function public.admin_delete_trip(p_key text, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform _require_admin(p_key);
  delete from trips where invite_code = p_code;
  if not found then
    raise exception 'Voyage introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public._require_admin(text) from public, anon, authenticated;
revoke all on function public.admin_list_trips(text), public.admin_delete_trip(text, text) from public;
grant execute on function public.admin_list_trips(text), public.admin_delete_trip(text, text) to anon, authenticated;
