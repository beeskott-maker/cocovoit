-- Une place par sens : déjà inscrit sur un aller (ou un retour), on ne peut
-- plus prendre de place sur un autre aller (ou retour) du voyage. Il faut
-- d'abord libérer sa place. Auparavant, l'ancienne place était libérée d'office.

create or replace function public.take_seat(p_code text, p_secret uuid, p_leg_id uuid)
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
