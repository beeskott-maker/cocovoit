-- Comptes connus d'avance : leur nom est fixé ici et ne se demande pas.
--
-- Seule l'empreinte SHA-256 de l'adresse (en minuscules) est stockée, comme
-- pour admin_emails. À la connexion d'une adresse connue, le compte est créé
-- s'il n'existe pas encore, avec ce nom, sans le demander ; s'il existe, son
-- nom est remis à cette valeur.

create table public.known_accounts (
  email_hash bytea primary key,
  name text not null check (length(trim(name)) > 0)
);
alter table public.known_accounts enable row level security;
revoke all on public.known_accounts from public, anon, authenticated;

-- Loic (adresse de l'administrateur).
insert into public.known_accounts (email_hash, name)
values (decode('9c030fc7e0acba56648fb3977e8e9f0051081a0023e2e1dfb1b74b6769608faa', 'hex'), 'Loic');

-- Comptes déjà créés : on applique le nom fixé.
update public.accounts a set name = k.name
from public.known_accounts k
where k.email_hash = sha256(convert_to(lower(trim(a.email)), 'UTF8'));

create or replace function public.login(p_email text, p_name text default null)
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
    insert into accounts (email, name)
    values (trim(p_email), coalesce(v_known_name, trim(p_name)))
    returning * into v;
  elsif v_known_name is not null and v.name <> v_known_name then
    update accounts set name = v_known_name where id = v.id returning * into v;
  end if;
  insert into account_sessions (account_id) values (v.id) returning token into v_token;
  return json_build_object(
    'status', 'ok',
    'token', v_token,
    'account', json_build_object('email', v.email, 'name', v.name));
end;
$$;
