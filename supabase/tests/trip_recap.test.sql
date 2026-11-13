-- Récap par email : formats, contrôles, limite d'envoi.
\set ON_ERROR_STOP on

-- Outils (appelés en interne par email_trip_recap).
do $$
begin
  assert _format_departure('2026-11-14T08:00:00Z') = 'Sam 14 nov à 9h00', _format_departure('2026-11-14T08:00:00Z');
  assert _format_departure('2026-08-02T16:05:00Z') = 'Dim 2 août à 18h05', _format_departure('2026-08-02T16:05:00Z');
  assert _urlencode('Gare Part-Dieu, Lyon & co') = 'Gare%20Part-Dieu%2C%20Lyon%20%26%20co', _urlencode('Gare Part-Dieu, Lyon & co');
  assert _urlencode('Été') = '%C3%89t%C3%A9', 'UTF-8';
  assert _html('<b>"Tom" & l''ami</b>') = '&lt;b&gt;&quot;Tom&quot; &amp; l&#39;ami&lt;/b&gt;', 'échappement HTML';
  raise notice 'Tests outils récap OK';
end;
$$;

set role anon;

do $$
declare
  hugo uuid := (login('recap-hugo@example.com', 'Hugo')->>'token')::uuid;
  lea uuid := (login('recap-lea@example.com', 'Léa')->>'token')::uuid;
  zoe uuid := (login('recap-zoe@example.com', 'Zoé')->>'token')::uuid;
  code text;
  leg uuid;
  failed boolean;
begin
  code := create_trip(hugo, 'Week-end <Annecy>', null, '2026-12-01', '2026-12-02');
  perform join_trip(lea, code);
  perform join_trip(zoe, code);
  perform save_car(hugo, code, null, 3,
    '[{"direction":"aller","departsAt":"2026-12-01T08:00:00Z","meetingPoint":"Gare & co"},
      {"direction":"retour","departsAt":"2026-12-02T16:00:00Z","meetingPoint":null}]');
  leg := (get_trip_state(hugo, code)->'cars'->0->'legs'->0->>'id')::uuid;
  perform take_seat(lea, code, leg);

  -- Récap envoyé à l'adresse du compte.
  assert email_trip_recap(lea, code)->>'email' = 'recap-lea@example.com', 'adresse du compte';

  -- Sans place : refusé.
  failed := false;
  begin
    perform email_trip_recap(zoe, code);
  exception when invalid_parameter_value then failed := true;
  end;
  assert failed, 'pas de place, pas de récap';

  -- Hors du voyage : refusé.
  failed := false;
  begin
    perform email_trip_recap((login('recap-x@example.com', 'X')->>'token')::uuid, code);
  exception when others then failed := true;
  end;
  assert failed, 'non participant refusé';

  -- Au plus 5 par heure.
  for i in 2 .. 5 loop
    perform email_trip_recap(lea, code);
  end loop;
  failed := false;
  begin
    perform email_trip_recap(lea, code);
  exception when invalid_parameter_value then failed := true;
  end;
  assert failed, 'limite de 5 récaps par heure';

  raise notice 'Tests récap par email OK';
end;
$$;
