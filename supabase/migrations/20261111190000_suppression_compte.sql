-- Suppression du compte par la personne elle-même (Mes voyages).
--
-- Les voyages qu'elle organise passent au participant arrivé le plus tôt ; un
-- voyage où elle était seule est supprimé. Ses voitures (avec leurs places)
-- et ses propres places partent avec ses participations, en cascade, ainsi
-- que ses sessions : elle est déconnectée partout.

-- Ce que la suppression va changer, pour l'afficher avant de confirmer.
create function public.account_deletion_preview(p_token uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v accounts := _account(p_token);
begin
  return json_build_object(
    -- Voyages organisés transmis : nom du voyage et du nouvel organisateur.
    'transferred', coalesce((
      select json_agg(json_build_object('trip', t.name, 'to', heir.name) order by t.starts_on, t.name)
      from participants me
      join trips t on t.id = me.trip_id
      cross join lateral (
        select a.name from participants o join accounts a on a.id = o.account_id
        where o.trip_id = t.id and o.id <> me.id
        order by o.created_at, o.id limit 1
      ) heir
      where me.account_id = v.id and me.is_organizer
    ), '[]'),
    -- Voyages organisés où la personne est seule : supprimés.
    'deletedTrips', coalesce((
      select json_agg(t.name order by t.starts_on, t.name)
      from participants me join trips t on t.id = me.trip_id
      where me.account_id = v.id and me.is_organizer
        and not exists (select 1 from participants o where o.trip_id = t.id and o.id <> me.id)
    ), '[]'),
    -- Ses voitures dans les voyages qui restent, et les passagers qui perdent leur place.
    'cars', coalesce((
      select json_agg(json_build_object(
        'trip', t.name,
        'passengers', coalesce((
          select json_agg(x.name order by x.name)
          from (
            select distinct a.name
            from car_legs l
            join bookings b on b.leg_id = l.id
            join participants p on p.id = b.participant_id
            join accounts a on a.id = p.account_id
            where l.car_id = c.id
          ) x
        ), '[]')
      ) order by t.starts_on, t.name)
      from participants me
      join cars c on c.driver_id = me.id
      join trips t on t.id = c.trip_id
      where me.account_id = v.id
        and exists (select 1 from participants o where o.trip_id = t.id and o.id <> me.id)
    ), '[]'),
    -- Ses places de passager, une par voiture.
    'seats', coalesce((
      select json_agg(json_build_object('trip', s.trip, 'driver', s.driver) order by s.starts_on, s.trip)
      from (
        select distinct t.name as trip, t.starts_on, da.name as driver
        from participants me
        join bookings b on b.participant_id = me.id
        join car_legs l on l.id = b.leg_id
        join cars c on c.id = l.car_id
        join trips t on t.id = c.trip_id
        join participants d on d.id = c.driver_id
        join accounts da on da.id = d.account_id
        where me.account_id = v.id
      ) s
    ), '[]')
  );
end;
$$;

-- Suppression, confirmée en retapant l'email du compte (casse et espaces ignorés).
create function public.delete_account(p_token uuid, p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v accounts := _account(p_token);
  r record;
begin
  if lower(trim(coalesce(p_email, ''))) <> lower(trim(v.email)) then
    raise exception 'Cet email n''est pas celui du compte' using errcode = '22023';
  end if;

  for r in select me.id, me.trip_id from participants me where me.account_id = v.id and me.is_organizer loop
    update participants set is_organizer = true
    where id = (
      select o.id from participants o
      where o.trip_id = r.trip_id and o.id <> r.id
      order by o.created_at, o.id limit 1
    );
    if not found then
      delete from trips where id = r.trip_id;
    end if;
  end loop;

  delete from accounts where id = v.id;
end;
$$;

revoke all on function public.account_deletion_preview(uuid), public.delete_account(uuid, text) from public;
grant execute on function public.account_deletion_preview(uuid), public.delete_account(uuid, text) to anon, authenticated;
