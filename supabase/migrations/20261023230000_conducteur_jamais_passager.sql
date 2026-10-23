-- Un conducteur n'est jamais passager : dès qu'on conduit une voiture d'un
-- voyage, on ne peut plus prendre de place dans ce voyage (aller comme retour),
-- et proposer sa voiture libère les places qu'on avait prises.

-- Places déjà prises par des conducteurs : libérées.
delete from public.bookings b
using public.participants p
where p.id = b.participant_id
  and exists (select 1 from public.cars c where c.driver_id = p.id);

create or replace function public.save_car(p_token uuid, p_code text, p_car_id uuid, p_seats int, p_legs json)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
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

  -- Un conducteur n'est jamais passager : ses places dans le voyage sont libérées.
  delete from bookings where participant_id = v_me.id;

  for v_leg in select * from json_array_elements(p_legs) loop
    v_dir := v_leg->>'direction';
    if v_dir = any (v_kept) then
      raise exception 'Trajet en double' using errcode = '22023';
    end if;
    v_kept := v_kept || v_dir;

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

create or replace function public.take_seat(p_token uuid, p_code text, p_leg_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
  v_leg car_legs;
  v_car cars;
begin
  -- Verrou sur le trajet pour éviter de dépasser le nombre de places.
  select l.* into v_leg from car_legs l where l.id = p_leg_id for update;
  select c.* into v_car from cars c where c.id = v_leg.car_id;
  if v_car.id is null or v_car.trip_id <> v_me.trip_id then
    raise exception 'Trajet introuvable' using errcode = 'P0002';
  end if;
  -- Un conducteur n'est jamais passager, quel que soit le sens.
  if exists (select 1 from cars c where c.driver_id = v_me.id) then
    raise exception 'Vous conduisez une voiture : vous ne pouvez pas être passager' using errcode = '22023';
  end if;
  -- Une place par sens : il faut d'abord libérer sa place.
  if exists (
    select 1 from bookings b join car_legs l on l.id = b.leg_id
    where b.participant_id = v_me.id and l.direction = v_leg.direction and l.id <> v_leg.id
  ) then
    raise exception 'Vous avez déjà une place %', case v_leg.direction when 'aller' then 'à l''aller' else 'au retour' end
      using errcode = '22023';
  end if;

  if (select count(*) from bookings where leg_id = v_leg.id and participant_id <> v_me.id) >= v_car.seats then
    raise exception 'Plus de place disponible' using errcode = '22023';
  end if;

  insert into bookings (leg_id, participant_id) values (v_leg.id, v_me.id)
  on conflict do nothing;
end;
$$;
