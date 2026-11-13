-- Récap par email : depuis la pop-in « C'est tout bon », un participant peut
-- recevoir sur l'adresse de son compte le résumé de ses places (sens, date,
-- voiture, point de rendez-vous en lien Google Maps, lien Google Agenda).
-- Envoi par Brevo, comme l'email de vérification.

alter table public.email_settings
  add column site_url text not null default 'https://cocovoiturage.fr/';

-- Une ligne par récap envoyé, pour limiter les envois (effacées après 7 jours).
create table public.recap_emails (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index recap_emails_account_idx on public.recap_emails (account_id, created_at desc);
alter table public.recap_emails enable row level security;
revoke all on public.recap_emails from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Outils
-- ---------------------------------------------------------------------------

-- Texte inséré dans du HTML : les noms et adresses sont saisis par les utilisateurs.
create function public._html(p text)
returns text
language sql immutable
as $$
  select replace(replace(replace(replace(replace(coalesce(p, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- Encodage d'un paramètre d'URL (UTF-8, comme encodeURIComponent).
create function public._urlencode(p text)
returns text
language plpgsql immutable
as $$
declare
  b bytea := convert_to(coalesce(p, ''), 'UTF8');
  r text := '';
  c int;
begin
  for i in 0 .. length(b) - 1 loop
    c := get_byte(b, i);
    if (c between 48 and 57) or (c between 65 and 90) or (c between 97 and 122) or c in (45, 46, 95, 126) then
      r := r || chr(c);
    else
      r := r || '%' || upper(lpad(to_hex(c), 2, '0'));
    end if;
  end loop;
  return r;
end;
$$;

-- Date de départ comme dans l'appli : « Sam 14 nov à 9h00 » (heure de Paris).
create function public._format_departure(p timestamptz)
returns text
language sql stable
as $$
  with t as (select p at time zone 'Europe/Paris' as d)
  select (array['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'])[extract(dow from d)::int + 1]
    || ' ' || extract(day from d)::int
    || ' ' || (array['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'])[extract(month from d)::int]
    || ' à ' || extract(hour from d)::int || 'h' || to_char(d, 'MI')
  from t;
$$;

-- Envoi d'un email par Brevo (clé « brevo_api_key » du Vault, via pg_net).
create function public._send_email(p_to text, p_subject text, p_html text, p_text text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s email_settings;
  v_key text;
begin
  select * into s from email_settings;
  if to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'net' and p.proname = 'http_post') then
    raise notice 'Envoi d''email non configuré : « % » pour % non envoyé', p_subject, p_to;
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_key using 'brevo_api_key';
  if v_key is null then
    raise notice 'Secret brevo_api_key absent : « % » pour % non envoyé', p_subject, p_to;
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://api.brevo.com/v3/smtp/email',
      jsonb_build_object(
        'sender', jsonb_build_object('name', s.sender_name, 'email', s.sender_email),
        'to', jsonb_build_array(jsonb_build_object('email', p_to)),
        'subject', p_subject,
        'htmlContent', p_html,
        'textContent', p_text,
        'tags', jsonb_build_array('cocovoit')),
      jsonb_build_object('api-key', v_key, 'content-type', 'application/json', 'accept', 'application/json');
end;
$$;

-- ---------------------------------------------------------------------------
-- Récap
-- ---------------------------------------------------------------------------

-- Envoie le récap de mes places dans ce voyage à l'adresse de mon compte.
-- Au plus 5 récaps par heure et par compte. Renvoie l'adresse utilisée.
create function public.email_trip_recap(p_token uuid, p_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_me participants := _participant(p_token, p_code);
  v_account accounts;
  v_trip trips;
  s email_settings;
  r record;
  v_legs_html text := '';
  v_legs_text text := '';
  v_line text;
  v_cal text;
  v_html text;
begin
  select * into v_account from accounts where id = v_me.account_id;
  select * into v_trip from trips where id = v_me.trip_id;
  select * into s from email_settings;

  delete from recap_emails where created_at < now() - interval '7 days';
  if (select count(*) from recap_emails
      where account_id = v_account.id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Trop d''envois de récap : réessayez dans une heure' using errcode = '22023';
  end if;

  for r in
    select l.id, l.direction, l.departs_at, l.meeting_point, da.name as driver,
      (select string_agg(pa.name, ', ' order by b2.created_at)
       from bookings b2 join participants p2 on p2.id = b2.participant_id
       join accounts pa on pa.id = p2.account_id
       where b2.leg_id = l.id) as passengers
    from bookings b
    join car_legs l on l.id = b.leg_id
    join cars c on c.id = l.car_id
    join participants d on d.id = c.driver_id
    join accounts da on da.id = d.account_id
    where b.participant_id = v_me.id
    order by l.direction  -- « aller » avant « retour »
  loop
    v_line := '<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
      || 'style="border:2px solid #d9cff7;border-radius:14px"><tr><td style="padding:12px 16px;font-size:15px;line-height:1.6">'
      || '<b>' || case r.direction when 'aller' then 'Aller' else 'Retour' end || ' · '
      || _format_departure(r.departs_at) || '</b><br>'
      || '&#128663; Voiture de ' || _html(r.driver);
    v_legs_text := v_legs_text || case r.direction when 'aller' then 'Aller' else 'Retour' end || ' · '
      || _format_departure(r.departs_at) || E'\nVoiture de ' || r.driver;
    if r.direction = 'aller' then
      if r.meeting_point is not null and length(trim(r.meeting_point)) > 0 then
        v_line := v_line || '<br>&#128205; RDV : <a href="https://www.google.com/maps/search/?api=1&amp;query='
          || _urlencode(r.meeting_point) || '" style="color:#5b3cc4;font-weight:bold">' || _html(r.meeting_point) || '</a>';
        v_legs_text := v_legs_text || E'\nRDV : ' || r.meeting_point;
      end if;
      -- Même événement que « Ajouter à mon agenda » dans l'appli : 30 min.
      v_cal := 'https://calendar.google.com/calendar/render?action=TEMPLATE'
        || '&text=' || _urlencode('Covoiturage aller · ' || v_trip.name)
        || '&dates=' || to_char(r.departs_at at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"')
        || '/' || to_char((r.departs_at + interval '30 minutes') at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"')
        || '&location=' || _urlencode(coalesce(r.meeting_point, ''))
        || '&details=' || _urlencode('Conducteur : ' || r.driver
             || E'\nPassagers : ' || coalesce(r.passengers, 'aucun pour l’instant')
             || E'\nVoyage : ' || s.site_url || '#/j/' || v_trip.invite_code);
      v_line := v_line || '<br>&#128197; <a href="' || replace(v_cal, '&', '&amp;')
        || '" style="color:#5b3cc4;font-weight:bold">Ajouter à mon agenda</a>';
    end if;
    v_legs_html := v_legs_html || v_line || '</td></tr></table></td></tr>';
    v_legs_text := v_legs_text || E'\n\n';
  end loop;

  if v_legs_html = '' then
    raise exception 'Vous n''avez pas de place dans ce voyage' using errcode = '22023';
  end if;

  v_html := '<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#ffeaf3;'
    || 'font-family:Helvetica,Arial,sans-serif;color:#1b1b1b">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;'
    || 'background:#ffffff;border-radius:24px;overflow:hidden">'
    || '<tr><td align="center" style="background:#5b3cc4;padding:20px 0 22px">'
    || '<img src="' || s.logo_url || '" width="140" alt="Coco·Voit" style="display:block;border:0"></td></tr>'
    || '<tr><td style="padding:26px 26px 8px">'
    || '<h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#1b1b1b">Votre voyage<br>'
    || _html(v_trip.name) || '</h1>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' || v_legs_html || '</table>'
    || '<a href="' || s.site_url || '#/t/' || v_trip.invite_code || '" style="display:block;background:#ff7ab6;'
    || 'color:#1b1b1b;text-decoration:none;text-align:center;font-weight:bold;font-size:16px;padding:15px 20px;'
    || 'border-radius:999px;margin-top:4px">Voir le voyage</a>'
    || '<p style="margin:16px 0 0;font-size:13px;line-height:1.5">Un empêchement ? Libérez vos places depuis la page du voyage.</p>'
    || '</td></tr><tr><td style="padding:18px 26px 24px;font-size:12px;line-height:1.5;color:#777">'
    || 'Vous recevez cet email parce que vous l''avez demandé sur Coco·Voit.'
    || '</td></tr></table></td></tr></table></body></html>';

  insert into recap_emails (account_id) values (v_account.id);
  perform _send_email(v_account.email, 'Votre voyage ' || v_trip.name, v_html,
    'Votre voyage ' || v_trip.name || E'\n\n' || v_legs_text
    || 'Voir le voyage : ' || s.site_url || '#/t/' || v_trip.invite_code);
  return json_build_object('email', v_account.email);
end;
$$;

revoke all on function public._send_email(text, text, text, text) from public, anon, authenticated;
revoke all on function public.email_trip_recap(uuid, text) from public;
grant execute on function public.email_trip_recap(uuid, text) to anon, authenticated;
