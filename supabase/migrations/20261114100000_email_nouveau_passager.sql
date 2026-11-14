-- Email au conducteur quand une personne prend une place dans sa voiture :
-- prénom et téléphone du passager, trajets où il est à bord (date, places
-- restantes), mention du trajet qu'il n'a pas pris. Un email par place prise.
-- Envoi par Brevo (voir _send_email), déclenché après l'insertion de la place.

alter table public.email_settings
  add column passenger_notice_enabled boolean not null default true;

-- Téléphone lisible : « +33612345678 » → « 06 12 34 56 78 » ; autres pays tels quels.
create function public._format_phone(p text)
returns text
language sql immutable
as $$
  select case
    when p ~ '^\+33[1-9][0-9]{8}$' then
      regexp_replace('0' || substr(p, 4), '^(..)(..)(..)(..)(..)$', '\1 \2 \3 \4 \5')
    else p
  end;
$$;

-- Contenu de l'email pour la place (p_leg_id, p_participant_id) : {to, subject, html, text}.
create function public._new_passenger_email(p_leg_id uuid, p_participant_id uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  s email_settings;
  v_car cars;
  v_trip trips;
  v_driver accounts;
  v_pax accounts;
  r record;
  v_left int;
  v_legs_html text := '';
  v_legs_text text := '';
  v_missing text := '';
  v_html text;
  v_link text;
begin
  select * into s from email_settings;
  select c.* into v_car from car_legs l join cars c on c.id = l.car_id where l.id = p_leg_id;
  select * into v_trip from trips where id = v_car.trip_id;
  select a.* into v_driver from participants p join accounts a on a.id = p.account_id where p.id = v_car.driver_id;
  select a.* into v_pax from participants p join accounts a on a.id = p.account_id where p.id = p_participant_id;
  v_link := s.site_url || '#/t/' || v_trip.invite_code;

  for r in
    select l.id, l.direction, l.departs_at,
      exists (select 1 from bookings b where b.leg_id = l.id and b.participant_id = p_participant_id) as aboard,
      (select count(*) from bookings b where b.leg_id = l.id)::int as taken
    from car_legs l
    where l.car_id = v_car.id
    order by l.direction  -- « aller » avant « retour »
  loop
    if r.aboard then
      v_left := v_car.seats - r.taken;
      v_legs_html := v_legs_html
        || '<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        || 'style="border:2px solid #d9cff7;border-radius:14px"><tr><td style="padding:10px 16px;font-size:14px;line-height:1.55">'
        || '<span style="font-size:15px"><b>' || case r.direction when 'aller' then 'Aller' else 'Retour' end || '</b> · '
        || _format_departure(r.departs_at) || '</span><br>'
        || '<b>&#9989; ' || _html(v_pax.name) || ' est à bord</b><br>'
        || '<span style="color:#4a3f46">'
        || case when v_left <= 0 then 'Voiture complète &#127881;'
                when v_left = 1 then 'Il reste 1 place sur ' || v_car.seats
                else 'Il reste ' || v_left || ' places sur ' || v_car.seats end
        || '</span></td></tr></table></td></tr>';
      v_legs_text := v_legs_text || case r.direction when 'aller' then 'Aller' else 'Retour' end || ' · '
        || _format_departure(r.departs_at) || E'\n' || v_pax.name || ' est à bord. '
        || case when v_left <= 0 then 'Voiture complète.'
                when v_left = 1 then 'Il reste 1 place sur ' || v_car.seats || '.'
                else 'Il reste ' || v_left || ' places sur ' || v_car.seats || '.' end
        || E'\n\n';
    else
      v_missing := v_pax.name || ' n''a pas pris de place pour '
        || case r.direction when 'aller' then 'l''aller' else 'le retour' end || '.';
    end if;
  end loop;

  v_html := '<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#ffeaf3;'
    || 'font-family:Helvetica,Arial,sans-serif;color:#1b1b1b">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;'
    || 'background:#ffffff;border-radius:24px;overflow:hidden">'
    || '<tr><td align="center" style="background:#5b3cc4;padding:20px 0 22px">'
    || '<img src="' || s.logo_url || '" width="140" alt="Coco·Voit" style="display:block;border:0"></td></tr>'
    || '<tr><td style="padding:22px 26px 8px">'
    || '<img src="' || s.site_url || 'email-coco.png" width="160" height="112" alt="" '
    || 'style="display:block;border:0;margin:0 auto 6px">'
    || '<h1 style="margin:0;font-size:23px;line-height:1.2;text-align:center;color:#1b1b1b">'
    || _html(v_pax.name) || ' monte dans<br>votre voiture !</h1>'
    || '<p style="margin:6px 0 18px;font-size:14px;line-height:1.5;text-align:center;color:#4a3f46">'
    || _html(v_trip.name) || '</p>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;'
    || 'border:2px solid #d9cff7;border-radius:14px"><tr><td style="padding:12px 16px;font-size:15px;line-height:1.7">'
    || '&#128587; <b>' || _html(v_pax.name) || '</b>'
    || case when v_pax.phone is not null then
         '<br>&#128222; <a href="tel:' || v_pax.phone || '" style="color:#5b3cc4;font-weight:bold">'
         || _format_phone(v_pax.phone) || '</a>'
       else '' end
    || '</td></tr></table>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' || v_legs_html || '</table>'
    || case when v_missing <> '' then
         '<p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#4a3f46">&#9888;&#65039; '
         || _html(v_missing) || '</p>'
       else '' end
    || '<a href="' || v_link || '" style="display:block;background:#ff7ab6;'
    || 'color:#1b1b1b;text-decoration:none;text-align:center;font-weight:bold;font-size:16px;padding:15px 20px;'
    || 'border-radius:999px;margin-top:4px">Voir le voyage</a>'
    || '</td></tr><tr><td style="padding:18px 26px 24px;font-size:12px;line-height:1.5;color:#777">'
    || 'Vous recevez cet email parce que vous proposez une voiture sur Coco·Voit.'
    || '</td></tr></table></td></tr></table></body></html>';

  return json_build_object(
    'to', v_driver.email,
    'subject', v_pax.name || ' monte dans votre voiture 🥥',
    'html', v_html,
    'text', v_pax.name || ' monte dans votre voiture !' || E'\n' || v_trip.name || E'\n\n'
      || case when v_pax.phone is not null then 'Téléphone : ' || _format_phone(v_pax.phone) || E'\n\n' else '' end
      || v_legs_text
      || case when v_missing <> '' then v_missing || E'\n\n' else '' end
      || 'Voir le voyage : ' || v_link);
end;
$$;

-- Après chaque place prise : prévient le conducteur. Un échec d'envoi ne bloque jamais la réservation.
create function public._notify_driver_new_passenger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  m json;
begin
  if not coalesce((select passenger_notice_enabled from email_settings), false) then
    return null;
  end if;
  begin
    m := _new_passenger_email(new.leg_id, new.participant_id);
    perform _send_email(m->>'to', m->>'subject', m->>'html', m->>'text');
  exception when others then
    raise warning 'Email au conducteur non envoyé : %', sqlerrm;
  end;
  return null;
end;
$$;

create trigger bookings_notify_driver
  after insert on public.bookings
  for each row execute function public._notify_driver_new_passenger();

revoke all on function public._format_phone(text) from public, anon, authenticated;
revoke all on function public._new_passenger_email(uuid, uuid) from public, anon, authenticated;
revoke all on function public._notify_driver_new_passenger() from public, anon, authenticated;
