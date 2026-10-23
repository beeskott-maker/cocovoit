-- Création de voyage : seuls le nom et les dates sont obligatoires.
-- La destination, le nom et l'email de l'organisateur deviennent facultatifs.

alter table public.trips alter column destination drop not null;
alter table public.trips drop constraint trips_destination_check;
alter table public.trips add constraint trips_destination_check
  check (destination is null or length(trim(destination)) between 1 and 300);

-- Un participant peut ne pas avoir d'email (organisateur qui ne l'a pas donné) :
-- il garde l'accès depuis son navigateur, mais ne peut pas rejoindre par email.
alter table public.participants alter column email drop not null;
alter table public.participants drop constraint participants_email_check;
alter table public.participants add constraint participants_email_check
  check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

create or replace function public.create_trip(
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
  values (trim(p_name), nullif(trim(p_destination), ''), p_starts_on, p_ends_on)
  returning * into v_trip;

  insert into participants (trip_id, email, name, is_organizer)
  values (
    v_trip.id,
    nullif(trim(p_organizer_email), ''),
    coalesce(nullif(trim(p_organizer_name), ''), 'Organisateur'),
    true
  )
  returning secret into v_secret;

  return json_build_object('code', v_trip.invite_code, 'secret', v_secret);
end;
$$;
