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
