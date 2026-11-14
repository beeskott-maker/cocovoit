-- Email « nouveau passager » différé de 1 à 2 minutes : une personne qui prend,
-- libère puis reprend sa place n'envoie pas un email à chaque clic au conducteur.
-- Une place prise met en attente un avis (voiture × passager) ; libérer toutes
-- ses places dans la voiture l'annule. Toutes les minutes, pg_cron envoie les
-- avis échus, avec l'état du moment (aller et retour pris dans la foulée : un
-- seul email).

create table public.passenger_notices (
  car_id uuid not null references public.cars (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  due_at timestamptz not null,
  primary key (car_id, participant_id)
);
create index passenger_notices_due_idx on public.passenger_notices (due_at);
alter table public.passenger_notices enable row level security;
revoke all on public.passenger_notices from public, anon, authenticated;

-- Contenu de l'email : une place quelconque du passager dans la voiture suffit,
-- _new_passenger_email liste tous les trajets de la voiture.
drop trigger bookings_notify_driver on public.bookings;
drop function public._notify_driver_new_passenger();

-- Place prise : avis (re)programmé dans une minute.
create function public._queue_passenger_notice()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into passenger_notices (car_id, participant_id, due_at)
  select l.car_id, new.participant_id, now() + interval '1 minute'
  from car_legs l where l.id = new.leg_id
  on conflict (car_id, participant_id) do update set due_at = excluded.due_at;
  return null;
end;
$$;

-- Place libérée : plus aucune place dans cette voiture → avis annulé.
create function public._cancel_passenger_notice()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from passenger_notices n
  using car_legs l
  where l.id = old.leg_id and n.car_id = l.car_id and n.participant_id = old.participant_id
    and not exists (select 1 from bookings b join car_legs l2 on l2.id = b.leg_id
                    where l2.car_id = l.car_id and b.participant_id = old.participant_id);
  return null;
end;
$$;

create trigger bookings_queue_passenger_notice
  after insert on public.bookings
  for each row execute function public._queue_passenger_notice();
create trigger bookings_cancel_passenger_notice
  after delete on public.bookings
  for each row execute function public._cancel_passenger_notice();

-- Envoie les avis échus (appelée chaque minute par pg_cron). Renvoie le nombre d'avis traités.
create function public._send_due_passenger_notices()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  n record;
  v_leg uuid;
  m json;
  v_count int := 0;
begin
  for n in
    delete from passenger_notices where due_at <= now() returning car_id, participant_id
  loop
    v_count := v_count + 1;
    if not coalesce((select passenger_notice_enabled from email_settings), false) then
      continue;
    end if;
    select b.leg_id into v_leg from bookings b join car_legs l on l.id = b.leg_id
      where l.car_id = n.car_id and b.participant_id = n.participant_id limit 1;
    continue when v_leg is null;
    begin
      m := _new_passenger_email(v_leg, n.participant_id);
      perform _send_email(m->>'to', m->>'subject', m->>'html', m->>'text');
    exception when others then
      raise warning 'Email au conducteur non envoyé : %', sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

revoke all on function public._queue_passenger_notice(), public._cancel_passenger_notice(),
  public._send_due_passenger_notices() from public, anon, authenticated;

-- Tâche planifiée (pg_cron, présent sur Supabase, absent d'un Postgres nu).
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron indisponible : les avis au conducteur restent en attente';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  execute $sql$select cron.schedule('envoi-avis-nouveau-passager', '* * * * *',
    'select public._send_due_passenger_notices()')$sql$;
end;
$$;
