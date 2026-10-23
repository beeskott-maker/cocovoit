-- « Mes voyages » sur l'accueil : la liste vient du serveur.
-- Le navigateur envoie les accès qu'il a mémorisés (code + secret) ; seuls les
-- voyages qui existent encore et dont le secret est valide sont renvoyés,
-- avec leur nom et leurs dates à jour.

create function public.my_trips(p_sessions json)
returns json
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_sessions is null or json_typeof(p_sessions) <> 'array' or json_array_length(p_sessions) > 200 then
    raise exception 'Liste de voyages invalide' using errcode = '22023';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'code', t.invite_code,
      'name', t.name,
      'startsOn', t.starts_on,
      'endsOn', t.ends_on
    ) order by t.starts_on, t.name)
    from trips t
    where exists (
      select 1
      from json_to_recordset(p_sessions) as s(code text, secret text)
      join participants p on p.trip_id = t.id
      where s.code = t.invite_code and p.secret::text = s.secret
    )), '[]'::json);
end;
$$;

revoke all on function public.my_trips(json) from public;
grant execute on function public.my_trips(json) to anon, authenticated;
