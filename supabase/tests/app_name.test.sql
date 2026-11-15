-- Nom de l'appli : « Coco·voit » dans tout ce que la base génère (emails, notifications).
\set ON_ERROR_STOP on
do $$
declare
  bad text;
begin
  select string_agg(p.proname, ', ') into bad
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%Coco·Voit%';
  assert bad is null, 'ancien nom dans : ' || bad;
  assert (select sender_name from email_settings) = 'Coco·voit', 'expéditeur des emails';
  assert (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
          where ns.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%Coco·voit%') >= 3, 'emails renommés';
  raise notice 'Tests nom de l''appli OK';
end;
$$;
