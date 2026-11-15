-- Email au conducteur quand une place est prise : contenu, déclencheur, droits.
\set ON_ERROR_STOP on

do $$
begin
  assert _format_phone('+33612345678') = '06 12 34 56 78', _format_phone('+33612345678');
  assert _format_phone('+41791234567') = '+41791234567', 'autres pays tels quels';
  raise notice 'Tests format téléphone OK';
end;
$$;

create temp table np (hugo uuid, julie uuid, tom uuid, code text);
grant all on np to anon;

set role anon;
do $$
declare
  hugo uuid := (login('np-hugo@example.com', 'Hugo')->>'token')::uuid;
  julie uuid := (login('np-julie@example.com', 'Julie', '06 12 34 56 78')->>'token')::uuid;
  tom uuid := (login('np-tom@example.com', 'Tom <3')->>'token')::uuid;
  code text;
  st json;
  failed boolean := false;
begin
  code := create_trip(hugo, 'WE dans le Beaujolais', null, '2026-12-05', '2026-12-07');
  perform join_trip(julie, code);
  perform join_trip(tom, code);
  perform save_car(hugo, code, null, 2,
    '[{"direction":"aller","departsAt":"2026-12-05T08:00:00Z","meetingPoint":null},
      {"direction":"retour","departsAt":"2026-12-07T16:00:00Z","meetingPoint":null}]');
  st := get_trip_state(julie, code);
  -- La réservation passe même si l'envoi n'est pas configuré (pas de pg_net en test).
  perform take_seat(julie, code, (st->'cars'->0->'legs'->0->>'id')::uuid);
  perform take_seat(tom, code, (st->'cars'->0->'legs'->0->>'id')::uuid);
  perform take_seat(tom, code, (st->'cars'->0->'legs'->1->>'id')::uuid);
  insert into np values (hugo, julie, tom, code);

  -- Fonctions internes : pas d'appel direct depuis le client.
  begin
    perform _new_passenger_email(gen_random_uuid(), gen_random_uuid());
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, '_new_passenger_email interdite à anon';
end;
$$;
reset role;

do $$
declare
  v np;
  aller uuid;
  retour uuid;
  julie_p uuid;
  tom_p uuid;
  m json;
begin
  select * into v from np;
  select l.id into aller from car_legs l join cars c on c.id = l.car_id join trips t on t.id = c.trip_id
    where t.invite_code = v.code and l.direction = 'aller';
  select l.id into retour from car_legs l join cars c on c.id = l.car_id join trips t on t.id = c.trip_id
    where t.invite_code = v.code and l.direction = 'retour';
  select p.id into julie_p from participants p join accounts a on a.id = p.account_id
    join trips t on t.id = p.trip_id where t.invite_code = v.code and a.email = 'np-julie@example.com';
  select p.id into tom_p from participants p join accounts a on a.id = p.account_id
    join trips t on t.id = p.trip_id where t.invite_code = v.code and a.email = 'np-tom@example.com';

  -- Julie : aller seulement, avec téléphone.
  m := _new_passenger_email(aller, julie_p);
  assert m->>'to' = 'np-hugo@example.com', 'envoyé au conducteur';
  assert m->>'subject' = 'Julie monte dans ta voiture 🥥', m->>'subject';
  assert m->>'html' like '%Julie monte dans<br>ta voiture !%', 'titre';
  assert m->>'html' like '%href="tel:+33612345678"%06 12 34 56 78%', 'téléphone';
  assert m->>'html' like '%<b>Aller</b> · Sam 5 déc à 9h00%', 'trajet aller';
  assert m->>'html' like '%Voiture complète%', 'aller complet (Julie et Tom, 2 places)';
  assert m->>'html' not like '%<b>Retour</b>%', 'pas de cadre retour';
  assert m->>'html' like '%Julie n&#39;a pas pris de place pour le retour.%', 'mention du retour';
  assert m->>'html' like '%email-coco.png%', 'noix de coco';

  -- Tom : aller et retour, sans téléphone, prénom échappé.
  m := _new_passenger_email(retour, tom_p);
  assert m->>'html' like '%Tom &lt;3 monte dans%', 'prénom échappé';
  assert m->>'html' like '%<b>Retour</b> · Lun 7 déc à 17h00%', 'trajet retour';
  assert m->>'html' like '%Il reste 1 place sur 2%', 'places restantes au retour';
  assert m->>'html' not like '%tel:%', 'pas de téléphone';
  assert m->>'html' not like '%n&#39;a pas pris%', 'pas de mention quand tout est pris';

  raise notice 'Tests email nouveau passager OK';
end;
$$;

drop table np;
