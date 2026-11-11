-- Vérification de l'adresse email à la première connexion.
--
-- Une adresse inconnue reçoit un lien (valable 24 h) avant de pouvoir créer son
-- compte. Les comptes existants et les adresses connues d'avance entrent
-- directement. L'email part par l'API Brevo, via pg_net, avec la clé rangée
-- dans le coffre Supabase (Vault, secret « brevo_api_key »).
--
-- Désactivée tant que email_settings.verification_enabled vaut false : la
-- connexion se comporte alors comme avant (nom demandé tout de suite). Une
-- migration l'activera une fois Brevo configuré.

-- pg_net pour les appels HTTP (présent sur Supabase, absent d'un Postgres nu).
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponible : aucun email ne sera envoyé (%)', sqlerrm;
end;
$$;

create table public.email_settings (
  id boolean primary key default true check (id),
  verification_enabled boolean not null default false,
  sender_email text not null default 'bonjour@cocovoiturage.fr',
  sender_name text not null default 'Coco·Voit',
  -- Le lien de l'email : ce préfixe suivi du jeton.
  link_base text not null default 'https://cocovoiturage.fr/#/verifier/',
  logo_url text not null default 'https://cocovoiturage.fr/email-logo.png'
);
insert into public.email_settings default values;

create table public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Empreinte du jeton du lien ; le jeton lui-même n'est jamais stocké.
  token_hash bytea not null unique,
  -- Page où reprendre après la vérification (ex. /j/<code>).
  next_path text check (next_path is null or (next_path like '/%' and next_path not like '//%')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  verified_at timestamptz
);
create index email_verifications_email_idx on public.email_verifications (lower(email), created_at desc);

alter table public.email_settings enable row level security;
alter table public.email_verifications enable row level security;
revoke all on public.email_settings, public.email_verifications from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Envoi de l'email (Brevo)
-- ---------------------------------------------------------------------------

create function public._send_verification_email(p_email text, p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s email_settings;
  v_key text;
  v_link text;
  v_html text;
begin
  select * into s from email_settings;
  v_link := s.link_base || p_token;
  if to_regclass('vault.decrypted_secrets') is null
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'net' and p.proname = 'http_post') then
    raise notice 'Envoi d''email non configuré : lien pour % non envoyé', p_email;
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_key using 'brevo_api_key';
  if v_key is null then
    raise notice 'Secret brevo_api_key absent : lien pour % non envoyé', p_email;
    return;
  end if;

  v_html := '<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:#ffeaf3;'
    || 'font-family:Helvetica,Arial,sans-serif;color:#1b1b1b">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;'
    || 'background:#ffffff;border-radius:24px;overflow:hidden">'
    || '<tr><td align="center" style="background:#5b3cc4;padding:20px 0 22px">'
    || '<img src="' || s.logo_url || '" width="140" alt="Coco·Voit" style="display:block;border:0"></td></tr>'
    || '<tr><td style="padding:26px 26px 8px">'
    || '<h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;color:#1b1b1b">Encore un clic et on part !</h1>'
    || '<p style="margin:0 0 22px;font-size:15px;line-height:1.5">Confirmez que cette adresse est bien la vôtre '
    || 'pour rejoindre vos voyages sur Coco·Voit.</p>'
    || '<a href="' || v_link || '" style="display:block;background:#ff7ab6;color:#1b1b1b;text-decoration:none;'
    || 'text-align:center;font-weight:bold;font-size:16px;padding:15px 20px;border-radius:999px">Confirmer mon email</a>'
    || '<p style="margin:16px 0 0;font-size:13px;color:#4a3f46">Le lien est valable 24 heures.</p>'
    || '</td></tr><tr><td style="padding:18px 26px 24px;font-size:12px;line-height:1.5;color:#777">'
    || 'Vous n''avez rien demandé ? Ignorez simplement cet email : sans clic, aucun compte n''est créé.'
    || '</td></tr></table></td></tr></table></body></html>';

  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://api.brevo.com/v3/smtp/email',
      jsonb_build_object(
        'sender', jsonb_build_object('name', s.sender_name, 'email', s.sender_email),
        'to', jsonb_build_array(jsonb_build_object('email', p_email)),
        'subject', 'Confirmez votre adresse email',
        'htmlContent', v_html,
        'textContent', 'Encore un clic et on part ! Confirmez votre adresse email pour Coco·Voit : '
          || v_link || E'\n\nLe lien est valable 24 heures. Vous n''avez rien demandé ? Ignorez cet email.'),
      jsonb_build_object('api-key', v_key, 'content-type', 'application/json', 'accept', 'application/json');
end;
$$;

-- Nouvelle demande : jeton, empreinte, envoi. Au plus un email par minute (on
-- renvoie alors la demande en cours) et cinq par heure pour une même adresse.
create function public._start_email_verification(p_email text, p_next text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := trim(p_email);
  v_recent email_verifications;
  v_token text;
  v_id uuid;
begin
  -- Ménage : les demandes de plus de 7 jours (et leur adresse) sont effacées.
  delete from email_verifications where created_at < now() - interval '7 days';

  select * into v_recent from email_verifications
  where lower(email) = lower(v_email) and verified_at is null and expires_at > now()
    and created_at > now() - interval '1 minute'
  order by created_at desc limit 1;
  if found then
    return json_build_object('status', 'verification_sent', 'request', v_recent.id, 'email', v_recent.email);
  end if;
  if (select count(*) from email_verifications
      where lower(email) = lower(v_email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Trop de demandes pour cette adresse : réessayez dans une heure' using errcode = '22023';
  end if;

  -- Deux UUID aléatoires : 244 bits d'aléa, sans dépendre de pgcrypto.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into email_verifications (email, token_hash, next_path)
  values (v_email, sha256(convert_to(v_token, 'UTF8')),
          case when p_next like '/%' and p_next not like '//%' then p_next end)
  returning id into v_id;
  perform _send_verification_email(v_email, v_token);
  return json_build_object('status', 'verification_sent', 'request', v_id, 'email', v_email);
end;
$$;

-- ---------------------------------------------------------------------------
-- Connexion
-- ---------------------------------------------------------------------------

-- p_request : demande de vérification confirmée (clic sur le lien), exigée pour
-- créer un compte quand la vérification est active. p_next : page où reprendre
-- après le clic sur le lien.
drop function public.login(text, text, text);
create function public.login(
  p_email text,
  p_name text default null,
  p_phone text default null,
  p_request uuid default null,
  p_next text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v accounts;
  v_token uuid;
  v_known_name text;
begin
  select name into v_known_name from known_accounts
  where email_hash = sha256(convert_to(lower(trim(p_email)), 'UTF8'));

  select * into v from accounts where lower(email) = lower(trim(p_email));
  if not found then
    -- Adresse inconnue : vérification par email d'abord (sauf comptes connus d'avance).
    if v_known_name is null
       and (select verification_enabled from email_settings)
       and not exists (
         select 1 from email_verifications
         where id = p_request and lower(email) = lower(trim(p_email))
           and verified_at is not null and expires_at > now()
       ) then
      if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'Adresse email invalide' using errcode = '22023';
      end if;
      return _start_email_verification(p_email, p_next);
    end if;
    if v_known_name is null and (p_name is null or length(trim(p_name)) = 0) then
      return json_build_object('status', 'needs_name');
    end if;
    insert into accounts (email, name, phone)
    values (trim(p_email), coalesce(v_known_name, trim(p_name)), _phone(p_phone))
    returning * into v;
  elsif v_known_name is not null and v.name <> v_known_name then
    update accounts set name = v_known_name where id = v.id returning * into v;
  end if;
  insert into account_sessions (account_id) values (v.id) returning token into v_token;
  return json_build_object(
    'status', 'ok',
    'token', v_token,
    'account', json_build_object('email', v.email, 'name', v.name, 'phone', v.phone));
end;
$$;

-- Clic sur le lien. Idempotent jusqu'à l'expiration : un second clic (ou
-- l'ouverture préalable du lien par un antivirus de messagerie) ne le grille pas.
create function public.verify_email(p_token text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v email_verifications;
begin
  select * into v from email_verifications where token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
  if not found then
    return json_build_object('status', 'invalid');
  end if;
  if v.expires_at <= now() then
    return json_build_object('status', 'expired', 'email', v.email, 'next', v.next_path);
  end if;
  update email_verifications set verified_at = coalesce(verified_at, now()) where id = v.id;
  return json_build_object('status', 'verified', 'email', v.email, 'request', v.id, 'next', v.next_path);
end;
$$;

-- Suivi par l'écran d'attente (éventuellement sur un autre appareil que le clic).
create function public.email_verification_status(p_request uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case
      when verified_at is not null and expires_at > now() then 'verified'
      when expires_at <= now() then 'expired'
      else 'pending'
    end
    from email_verifications where id = p_request
  ), 'expired');
$$;

revoke all on function public._send_verification_email(text, text), public._start_email_verification(text, text) from public, anon, authenticated;
revoke all on function public.login(text, text, text, uuid, text), public.verify_email(text), public.email_verification_status(uuid) from public;
grant execute on function public.login(text, text, text, uuid, text), public.verify_email(text), public.email_verification_status(uuid) to anon, authenticated;
