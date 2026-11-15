-- Nom de l'appli : « Coco·voit » (v minuscule) partout, y compris dans les emails
-- (expéditeur, texte et logo) et les notifications générés par la base.

do $$
declare
  f record;
  def text;
  n int := 0;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%Coco·Voit%'
  loop
    def := replace(pg_get_functiondef(f.oid), 'Coco·Voit', 'Coco·voit');
    execute def;
    n := n + 1;
  end loop;
  raise notice 'Nom corrigé dans % fonction(s)', n;
end;
$$;

alter table public.email_settings alter column sender_name set default 'Coco·voit';
update public.email_settings set sender_name = 'Coco·voit' where sender_name = 'Coco·Voit';
