-- « Mes voyages » : indique si le voyage est complet, c'est-à-dire s'il a au
-- moins un trajet et plus aucune place libre sur aucun de ses trajets.

create or replace function public.my_trips(p_token uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_account accounts := _account(p_token);
begin
  return coalesce((
    select json_agg(json_build_object(
      'code', t.invite_code,
      'name', t.name,
      'startsOn', t.starts_on,
      'endsOn', t.ends_on,
      'isOrganizer', p.is_organizer,
      'isDriver', exists (select 1 from cars c where c.driver_id = p.id),
      'isPassenger', exists (select 1 from bookings b where b.participant_id = p.id),
      'isFull',
        exists (select 1 from car_legs l join cars c on c.id = l.car_id where c.trip_id = t.id)
        and not exists (
          select 1 from car_legs l join cars c on c.id = l.car_id
          where c.trip_id = t.id
            and (select count(*) from bookings b where b.leg_id = l.id) < c.seats)
    ) order by t.starts_on, t.name)
    from participants p join trips t on t.id = p.trip_id
    where p.account_id = v_account.id), '[]'::json);
end;
$$;
