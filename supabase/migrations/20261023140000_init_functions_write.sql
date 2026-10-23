-- Fonctions RPC de modification (voitures, places) et droits d'exécution.

-- Crée (p_car_id null) ou met à jour la voiture du participant.
-- p_legs : [{"direction":"aller","departsAt":"...","meetingPoint":"..."}, ...]
create function public.save_car(p_code text, p_secret uuid, p_car_id uuid, p_seats int, p_legs json)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
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

create function public.delete_car(p_code text, p_secret uuid, p_car_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
begin
  delete from cars where id = p_car_id and driver_id = v_me.id;
  if not found then
    raise exception 'Accès refusé' using errcode = '28000';
  end if;
end;
$$;

create function public.take_seat(p_code text, p_secret uuid, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
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

  -- Une seule place par sens : on libère l'éventuelle place prise ailleurs.
  delete from bookings b using car_legs l
  where b.leg_id = l.id and b.participant_id = v_me.id
    and l.direction = v_leg.direction and l.id <> v_leg.id;

  if (select count(*) from bookings where leg_id = v_leg.id and participant_id <> v_me.id) >= v_car.seats then
    raise exception 'Plus de place disponible' using errcode = '22023';
  end if;

  insert into bookings (leg_id, participant_id) values (v_leg.id, v_me.id)
  on conflict do nothing;
end;
$$;

create function public.leave_seat(p_code text, p_secret uuid, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_code, p_secret);
begin
  delete from bookings where leg_id = p_leg_id and participant_id = v_me.id;
end;
$$;

revoke all on function public._participant(text, uuid) from public, anon, authenticated;
revoke all on function
  public.create_trip(text, text, date, date, text, text),
  public.get_trip_preview(text),
  public.join_trip(text, text, text),
  public.get_trip_state(text, uuid),
  public.save_car(text, uuid, uuid, int, json),
  public.delete_car(text, uuid, uuid),
  public.take_seat(text, uuid, uuid),
  public.leave_seat(text, uuid, uuid)
  from public;
grant execute on function
  public.create_trip(text, text, date, date, text, text),
  public.get_trip_preview(text),
  public.join_trip(text, text, text),
  public.get_trip_state(text, uuid),
  public.save_car(text, uuid, uuid, int, json),
  public.delete_car(text, uuid, uuid),
  public.take_seat(text, uuid, uuid),
  public.leave_seat(text, uuid, uuid)
  to anon, authenticated;
