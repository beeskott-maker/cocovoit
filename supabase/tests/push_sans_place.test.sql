-- Notifications push « nouvelle voiture » et « pas encore de place ».
\set ON_ERROR_STOP on

create temp table ps (hugo uuid, zoe uuid, julie uuid, max_ uuid, lea uuid, code text, aller uuid);
grant all on ps to anon;

create function pg_temp.outbox(p_token uuid) returns text language sql as $$
  select string_agg(o.title || ' | ' || o.body, E'\n' order by o.id)
  from push_outbox o join account_sessions s on s.account_id = o.account_id where s.token = p_token;
$$;
create function pg_temp.new_cars() returns void language sql as $$
  update new_car_notices set due_at = now() - interval '1 second';
  select _send_due_new_car_notices();
$$;

set role anon;
do $$
declare
  hugo uuid := (login('ps-hugo@example.com', 'Hugo')->>'token')::uuid;
  zoe uuid := (login('ps-zoe@example.com', 'Zoé')->>'token')::uuid;
  julie uuid := (login('ps-julie@example.com', 'Julie')->>'token')::uuid;
  max_ uuid := (login('ps-max@example.com', 'Max')->>'token')::uuid;
  lea uuid := (login('ps-lea@example.com', 'Léa')->>'token')::uuid;
  d date := (now() at time zone 'Europe/Paris')::date;
  code text;
  t uuid;
begin
  code := create_trip(hugo, 'Annecy', null, d + 3, d + 5);
  foreach t in array array[zoe, julie, max_, lea] loop
    perform join_trip(t, code);
  end loop;
  foreach t in array array[hugo, zoe, julie, max_, lea] loop
    perform push_subscribe(t, 'https://push.example.com/ps-' || t, repeat('a', 87), repeat('b', 22));
  end loop;
  insert into ps (hugo, zoe, julie, max_, lea, code) values (hugo, zoe, julie, max_, lea, code);
end;
$$;
reset role;

do $$
declare
  v ps;
  d date := (now() at time zone 'Europe/Paris')::date;
  legs text := format('[{"direction":"aller","departsAt":"%s","meetingPoint":null},
    {"direction":"retour","departsAt":"%s","meetingPoint":null}]',
    (d + 3 + time '10:00') at time zone 'Europe/Paris', (d + 5 + time '17:00') at time zone 'Europe/Paris');
  car uuid;
  o text;
begin
  select * into v from ps;
  delete from push_outbox;

  -- 1. Hugo ajoute sa voiture : les autres sont prévenus 2 minutes plus tard.
  set local role anon;
  perform save_car(v.hugo, v.code, null, 3, legs::json);
  reset role;
  perform _send_due_new_car_notices();
  assert not exists (select 1 from push_outbox), 'rien avant l''échéance';
  perform pg_temp.new_cars();
  o := pg_temp.outbox(v.julie);
  assert o = 'Nouvelle voiture 🚗 | Annecy · Hugo propose 3 places à l''aller et au retour.', o;
  assert pg_temp.outbox(v.zoe) = o and pg_temp.outbox(v.max_) = o and pg_temp.outbox(v.lea) = o, 'tous prévenus';
  assert pg_temp.outbox(v.hugo) is null, 'pas le conducteur';
  update ps set aller = (select l.id from car_legs l join cars c on c.id = l.car_id
    join participants p on p.id = c.driver_id join account_sessions s on s.account_id = p.account_id
    where s.token = v.hugo and l.direction = 'aller');
  select * into v from ps;
  delete from push_outbox;

  -- 2. Julie prend l'aller, Zoé ajoute une voiture d'une place : seuls les sens qui manquent.
  set local role anon;
  perform take_seat(v.julie, v.code, v.aller);
  perform save_car(v.zoe, v.code, null, 1, legs::json);
  reset role;
  delete from passenger_notices;
  perform pg_temp.new_cars();
  o := pg_temp.outbox(v.julie);
  assert o = 'Nouvelle voiture 🚗 | Annecy · Zoé propose 1 place pour le retour.', o;
  o := pg_temp.outbox(v.max_);
  assert o = 'Nouvelle voiture 🚗 | Annecy · Zoé propose 1 place à l''aller et au retour.', o;
  assert pg_temp.outbox(v.hugo) is null and pg_temp.outbox(v.zoe) is null, 'pas les conducteurs';
  delete from push_outbox;

  -- 3. Voiture ajoutée puis retirée avant l'échéance : rien.
  set local role anon;
  car := save_car(v.lea, v.code, null, 2, legs::json);
  reset role;
  delete from cars where id = car;
  assert not exists (select 1 from new_car_notices), 'avis retiré avec la voiture';
  delete from push_outbox;

  -- 4. Trois jours avant l'aller : ceux qui n'ont pas de place à l'aller.
  perform _push_seat_reminders();
  o := pg_temp.outbox(v.max_);
  assert o = 'Pas encore de place 🙋 | Annecy · Aller : il reste 2 places dans la voiture d''Hugo et 1 dans celle de Zoé.', o;
  assert pg_temp.outbox(v.lea) = o, 'Léa aussi';
  assert pg_temp.outbox(v.julie) is null, 'Julie a sa place';
  assert pg_temp.outbox(v.hugo) is null and pg_temp.outbox(v.zoe) is null, 'pas les conducteurs';
  delete from push_outbox;

  -- 5. Max prend la place de Zoé : il ne reste que la voiture d'Hugo.
  car := (select l.id from car_legs l join cars c on c.id = l.car_id
    join participants p on p.id = c.driver_id join account_sessions s on s.account_id = p.account_id
    where s.token = v.zoe and l.direction = 'aller');
  set local role anon;
  perform take_seat(v.max_, v.code, car);
  reset role;
  perform _push_seat_reminders();
  o := pg_temp.outbox(v.lea);
  assert o = 'Pas encore de place 🙋 | Annecy · Aller : il reste 2 places dans la voiture d''Hugo.', o;
  assert pg_temp.outbox(v.max_) is null, 'Max a sa place';
  delete from push_outbox;

  -- 6. Plus aucune place à l'aller : pas de relance pour Léa.
  update cars set seats = 1 where id = (select car_id from car_legs where id = v.aller);
  perform _push_seat_reminders();
  assert pg_temp.outbox(v.lea) is null, 'aucune relance sans place libre';

  -- 7. Textes : retour (deux voitures), puis trois voitures ou plus.
  o := _seats_offer_text((select id from trips where invite_code = v.code), 'retour');
  assert o = 'il reste 1 place dans la voiture d''Hugo et 1 dans celle de Zoé', o;
  set local role anon;
  perform save_car(v.lea, v.code, null, 4, legs::json);
  reset role;
  o := _seats_offer_text((select id from trips where invite_code = v.code), 'retour');
  assert o = 'il reste 6 places dans 3 voitures', o;
  delete from push_outbox;
  delete from new_car_notices;
  delete from passenger_notices;
  delete from seat_left_notices;
  raise notice 'Tests nouvelle voiture et sans place OK';
end;
$$;
