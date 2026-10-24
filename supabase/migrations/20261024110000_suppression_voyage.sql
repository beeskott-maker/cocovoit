-- Suppression d'un voyage par la personne qui l'a créé (l'organisateur).
-- Tout ce qui s'y rattache (participants, voitures, trajets, places) part en
-- cascade, et le lien d'invitation ne marche plus.

create function public.delete_trip(p_token uuid, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v participants := _participant(p_token, p_code);
begin
  if not v.is_organizer then
    raise exception 'Seul l''organisateur peut supprimer ce voyage' using errcode = '28000';
  end if;
  delete from trips where id = v.trip_id;
end;
$$;

revoke all on function public.delete_trip(uuid, text) from public;
grant execute on function public.delete_trip(uuid, text) to anon, authenticated;
