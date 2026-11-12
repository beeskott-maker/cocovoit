-- Garde la clé API Brevo active : Brevo la désactive après 90 jours sans
-- usage, ce qui casserait la vérification de l'email s'il n'y a aucune
-- inscription pendant trois mois. Appelée une fois par mois par la tâche
-- GitHub « Supabase keep-alive » (via l'API de gestion, pas par le front).
--
-- Simple lecture des statistiques d'envoi : aucun email n'est envoyé.
-- Renvoie l'identifiant de la requête pg_net, dont la réponse se lit ensuite
-- dans net._http_response ; null si l'envoi d'email n'est pas configuré.
create function public.brevo_keepalive()
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_key text;
  v_id bigint;
begin
  if to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'net' and p.proname = 'http_get') then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_key using 'brevo_api_key';
  if v_key is null then
    return null;
  end if;
  execute 'select net.http_get(url := $1, headers := $2)'
    into v_id
    using 'https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=1',
      jsonb_build_object('api-key', v_key, 'accept', 'application/json');
  return v_id;
end;
$$;

revoke all on function public.brevo_keepalive() from public, anon, authenticated;
