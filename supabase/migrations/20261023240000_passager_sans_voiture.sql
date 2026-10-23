-- Une personne inscrite comme passager (aller ou retour) ne peut pas ajouter
-- de voiture : elle doit d'abord libérer ses places.

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
    -- Un passager ne peut pas ajouter de voiture : il libère d'abord ses places.
    if exists (select 1 from bookings where participant_id = v_me.id) then
      raise exception 'Vous avez une place de passager : libérez-la pour ajouter votre voiture' using errcode = '22023';
    end if;
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
