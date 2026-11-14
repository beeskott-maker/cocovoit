-- Avis « nouveau passager » différé : prendre / libérer / reprendre n'envoie qu'un email.
\set ON_ERROR_STOP on

create temp table pnd (julie uuid, code text, aller uuid, retour uuid);
grant all on pnd to anon;

set role anon;
do $$
declare
  hugo uuid := (login('pnd-hugo@example.com', 'Hugo')->>'token')::uuid;
  julie uuid := (login('pnd-julie@example.com', 'Julie')->>'token')::uuid;
  code text;
  st json;
begin
  code := create_trip(hugo, 'Délai', null, '2026-12-05', '2026-12-07');
  perform join_trip(julie, code);
  perform save_car(hugo, code, null, 3,
    '[{"direction":"aller","departsAt":"2026-12-05T08:00:00Z","meetingPoint":null},
      {"direction":"retour","departsAt":"2026-12-07T16:00:00Z","meetingPoint":null}]');
  st := get_trip_state(julie, code);
  insert into pnd values (julie, code, (st->'cars'->0->'legs'->0->>'id')::uuid, (st->'cars'->0->'legs'->1->>'id')::uuid);
end;
$$;
reset role;

do $$
declare
  v pnd;
  n int;
begin
  select * into v from pnd;
  delete from passenger_notices;

  -- Prise de l'aller : un avis en attente, pas encore échu.
  set local role anon;
  perform take_seat(v.julie, v.code, v.aller);
  reset role;
  assert (select count(*) from passenger_notices) = 1, 'avis en attente';
  assert (select due_at from passenger_notices) = now() + interval '1 minute', 'dans une minute';
  assert _send_due_passenger_notices() = 0, 'rien d''échu';

  -- Libérée : avis annulé.
  set local role anon;
  perform leave_seat(v.julie, v.code, v.aller);
  reset role;
  assert (select count(*) from passenger_notices) = 0, 'avis annulé';

  -- Reprise de l'aller puis du retour : un seul avis pour la voiture.
  set local role anon;
  perform take_seat(v.julie, v.code, v.aller);
  perform take_seat(v.julie, v.code, v.retour);
  reset role;
  assert (select count(*) from passenger_notices) = 1, 'un avis par voiture et par passager';

  -- Libérer le retour seulement : l'avis reste (elle a encore l'aller).
  set local role anon;
  perform leave_seat(v.julie, v.code, v.retour);
  reset role;
  assert (select count(*) from passenger_notices) = 1, 'avis maintenu';

  -- Échu : envoyé (pas de pg_net ici, simple notice) puis retiré.
  update passenger_notices set due_at = now() - interval '1 second';
  n := _send_due_passenger_notices();
  assert n = 1, 'un avis traité';
  assert (select count(*) from passenger_notices) = 0, 'avis retiré après envoi';

  raise notice 'Tests délai avis nouveau passager OK';
end;
$$;

drop table pnd;
