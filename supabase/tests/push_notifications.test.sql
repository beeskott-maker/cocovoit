-- Notifications push : abonnement, file d'envoi et contenu de chaque notification.
\set ON_ERROR_STOP on

create temp table pn (hugo uuid, julie uuid, code text, car uuid, aller uuid, retour uuid);
grant all on pn to anon;

set role anon;
do $$
declare
  hugo uuid := (login('pn-hugo@example.com', 'Hugo')->>'token')::uuid;
  julie uuid := (login('pn-julie@example.com', 'Julie')->>'token')::uuid;
  code text;
  car uuid;
  st json;
begin
  code := create_trip(hugo, 'Annecy', null, '2026-12-05', '2026-12-07');
  perform join_trip(julie, code);
  car := save_car(hugo, code, null, 3,
    '[{"direction":"aller","departsAt":"2026-12-05T07:00:00Z","meetingPoint":"Gare"},
      {"direction":"retour","departsAt":"2026-12-07T16:00:00Z","meetingPoint":null}]');
  st := get_trip_state(julie, code);
  insert into pn values (hugo, julie, code, car,
    (st->'cars'->0->'legs'->0->>'id')::uuid, (st->'cars'->0->'legs'->1->>'id')::uuid);

  -- Abonnements (un appareil chacun)
  assert push_public_key() is null, 'pas de clé avant le premier envoi';
  perform push_subscribe(hugo, 'https://push.example.com/hugo', repeat('a', 87), repeat('b', 22));
  perform push_subscribe(julie, 'https://push.example.com/julie', repeat('a', 87), repeat('b', 22));
  begin
    perform push_subscribe(julie, 'http://pas-https', repeat('a', 87), repeat('b', 22));
    raise exception 'abonnement http accepté';
  exception when sqlstate '22023' then null;
  end;
end;
$$;
reset role;

-- Contenu de la file pour un compte (titre | texte), puis vidage.
create function pg_temp.outbox(p_token uuid) returns text language sql as $$
  select string_agg(o.title || ' | ' || o.body, E'\n' order by o.id)
  from push_outbox o join account_sessions s on s.account_id = o.account_id where s.token = p_token;
$$;
create function pg_temp.due() returns void language sql as $$
  update passenger_notices set due_at = now() - interval '1 second';
  update seat_left_notices set due_at = now() - interval '1 second';
  update leg_change_notices set due_at = now() - interval '1 second';
  select _send_due_passenger_notices();
$$;

do $$
declare
  v pn;
  o text;
  legs json;
begin
  select * into v from pn;
  delete from push_outbox;

  -- 1. Julie prend l'aller : notification au conducteur, une minute plus tard.
  set local role anon;
  perform take_seat(v.julie, v.code, v.aller);
  reset role;
  assert pg_temp.outbox(v.hugo) is null, 'rien avant l''échéance';
  perform pg_temp.due();
  o := pg_temp.outbox(v.hugo);
  assert o = 'Julie monte dans ta voiture 🥥 | Annecy · Aller. Il reste 2 places sur 3.', o;
  assert pg_temp.outbox(v.julie) is null, 'rien pour Julie';
  delete from push_outbox;

  -- 2. Elle libère l'aller puis le reprend aussitôt : rien n'a changé, pas de notification.
  set local role anon;
  perform leave_seat(v.julie, v.code, v.aller);
  reset role;
  assert (select count(*) from seat_left_notices) = 1, 'place libérée en attente';
  set local role anon;
  perform take_seat(v.julie, v.code, v.aller);
  reset role;
  assert (select count(*) from seat_left_notices) = 0, 'reprise : avis retiré';
  assert (select count(*) from passenger_notices) = 0, 'reprise : pas de nouvelle arrivée';
  perform pg_temp.due();
  assert pg_temp.outbox(v.hugo) is null, 'aucune notification';

  -- 3. Elle libère vraiment l'aller : notification « a libéré sa place ».
  set local role anon;
  perform leave_seat(v.julie, v.code, v.aller);
  reset role;
  perform pg_temp.due();
  o := pg_temp.outbox(v.hugo);
  assert o = 'Julie a libéré sa place | Annecy · Aller. Il reste 3 places sur 3.', o;
  delete from push_outbox;

  -- 4. Prise puis libérée avant l'annonce : ni arrivée, ni départ.
  set local role anon;
  perform take_seat(v.julie, v.code, v.retour);
  perform leave_seat(v.julie, v.code, v.retour);
  reset role;
  perform pg_temp.due();
  assert pg_temp.outbox(v.hugo) is null, 'ravisée : rien';

  -- 5. Aller et retour pris ensemble : une seule notification.
  set local role anon;
  perform take_seat(v.julie, v.code, v.aller);
  perform take_seat(v.julie, v.code, v.retour);
  reset role;
  perform pg_temp.due();
  o := pg_temp.outbox(v.hugo);
  assert o = 'Julie monte dans ta voiture 🥥 | Annecy · Aller et retour.', o;
  delete from push_outbox;

  -- 6. Départ modifié (heure et RDV) : notification aux passagers du trajet.
  set local role anon;
  perform save_car(v.hugo, v.code, v.car, 3,
    '[{"direction":"aller","departsAt":"2026-12-05T07:30:00Z","meetingPoint":"Parking"},
      {"direction":"retour","departsAt":"2026-12-07T16:00:00Z","meetingPoint":null}]');
  reset role;
  assert (select count(*) from leg_change_notices) = 1, 'seul l''aller a changé';
  perform pg_temp.due();
  o := pg_temp.outbox(v.julie);
  assert o = 'Départ modifié | Annecy · Aller : départ à 8h30 avec Hugo. RDV : Parking.', o;
  assert pg_temp.outbox(v.hugo) is null, 'pas pour le conducteur';
  delete from push_outbox;

  -- 7. Rappel la veille.
  update car_legs set departs_at = (date_trunc('day', now() at time zone 'Europe/Paris') + interval '1 day 8 hours')
    at time zone 'Europe/Paris' where id = v.aller;
  delete from leg_change_notices;
  assert _push_daily_reminders() = 1, 'un trajet demain';
  o := pg_temp.outbox(v.hugo);
  assert o = 'C''est demain ! 🚗 | Annecy · Aller : départ à 8h00, 1 passager. RDV : Parking.', o;
  o := pg_temp.outbox(v.julie);
  assert o = 'C''est demain ! 🚗 | Annecy · Aller : départ à 8h00 avec Hugo. RDV : Parking.', o;
  delete from push_outbox;

  -- 8. Le conducteur retire le retour : place annulée pour Julie.
  legs := (select json_build_array(json_build_object('direction', 'aller', 'departsAt', departs_at, 'meetingPoint', meeting_point))
           from car_legs where id = v.aller);
  set local role anon;
  perform save_car(v.hugo, v.code, v.car, 3, legs);
  reset role;
  o := pg_temp.outbox(v.julie);
  assert o = 'Ta place a été annulée 😕 | Annecy · Hugo ne fait plus le retour. Choisis une autre voiture.', o;
  assert (select count(*) from seat_left_notices) = 0, 'pas d''avis « libérée » au conducteur';
  delete from push_outbox;

  -- 9. Voiture supprimée : place annulée.
  set local role anon;
  perform delete_car(v.hugo, v.code, v.car);
  reset role;
  o := pg_temp.outbox(v.julie);
  assert o = 'Ta place a été annulée 😕 | Annecy · Hugo a retiré sa voiture. Choisis une autre voiture.', o;
  delete from push_outbox;

  -- 10. Sans appareil abonné : rien en file.
  set local role anon;
  perform push_unsubscribe(v.julie, 'https://push.example.com/julie');
  reset role;
  perform _push_enqueue((select account_id from account_sessions where token = v.julie), 't', 'b', 'u', null);
  assert pg_temp.outbox(v.julie) is null, 'pas d''abonnement, pas de file';

  raise notice 'Tests notifications push OK';
end;
$$;

-- Places réduites par le conducteur : le passager le plus récent perd sa place.
do $$
declare
  hugo uuid := (login('pn2-hugo@example.com', 'Hugo')->>'token')::uuid;
  lea uuid := (login('pn2-lea@example.com', 'Léa')->>'token')::uuid;
  max_ uuid := (login('pn2-max@example.com', 'Max')->>'token')::uuid;
  code text;
  car uuid;
  leg uuid;
  o text;
begin
  code := create_trip(hugo, 'Ski', null, '2027-01-23', '2027-01-30');
  perform join_trip(lea, code);
  perform join_trip(max_, code);
  car := save_car(hugo, code, null, 2, '[{"direction":"aller","departsAt":"2027-01-23T07:00:00Z","meetingPoint":null}]');
  leg := (get_trip_state(lea, code)->'cars'->0->'legs'->0->>'id')::uuid;
  perform push_subscribe(max_, 'https://push.example.com/max', repeat('a', 87), repeat('b', 22));
  perform take_seat(lea, code, leg);
  perform take_seat(max_, code, leg);
  delete from push_outbox;
  perform save_car(hugo, code, car, 1, '[{"direction":"aller","departsAt":"2027-01-23T07:00:00Z","meetingPoint":null}]');
  o := pg_temp.outbox(max_);
  assert o = 'Ta place a été annulée 😕 | Ski · Aller : Hugo a réduit le nombre de places. Choisis une autre voiture.', o;
  delete from push_outbox;

  -- Voyage supprimé : pas de notification « place annulée ».
  perform delete_trip(hugo, code);
  assert pg_temp.outbox(max_) is null, 'voyage supprimé : rien';
  raise notice 'Tests places réduites OK';
end;
$$;

-- Fonction d'envoi : clés VAPID, lot à envoyer, abonnements expirés.
do $$
declare
  k json;
  b json;
  hugo uuid := (select hugo from pn);
begin
  k := _push_set_keys('PUB', '{"kty":"EC"}');
  assert k->>'publicKey' = 'PUB', 'clés enregistrées';
  k := _push_set_keys('AUTRE', '{}');
  assert k->>'publicKey' = 'PUB', 'clés jamais remplacées';
  assert push_public_key() = 'PUB', 'clé publique visible';

  delete from push_outbox;
  perform _push_enqueue((select account_id from account_sessions where token = hugo), 'Titre', 'Texte', 'https://x/#/t/1', 'tag');
  b := _push_take_batch(50);
  assert json_array_length(b) = 1, b::text;
  assert b->0->>'endpoint' = 'https://push.example.com/hugo', 'appareil';
  assert b->0->'payload'->>'title' = 'Titre', 'contenu';
  assert (select count(*) from push_outbox) = 0, 'file vidée';
  perform _push_forget(array['https://push.example.com/hugo']);
  assert not exists (select 1 from push_subscriptions where endpoint = 'https://push.example.com/hugo'), 'oublié';
  raise notice 'Tests fonction d''envoi OK';
end;
$$;

drop table pn;
