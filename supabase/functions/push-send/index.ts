// Fonction Supabase « push-send » : vide la file push_outbox de la base et envoie
// chaque notification aux appareils abonnés (Web Push). Appelée par pg_cron
// (via pg_net) quand la file n'est pas vide ; sans effet si elle est vide.
// Au premier appel, crée la paire de clés VAPID et la range dans la base.
import { generateVapidKeys, sendPush, type VapidKeys } from './webpush.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(h: () => Promise<Response>): void;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUBJECT = 'mailto:contact@cocovoiturage.fr';
const BATCH = 200;

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} : ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function vapidKeys(): Promise<VapidKeys> {
  const stored = await rpc<VapidKeys | null>('_push_keys');
  if (stored?.publicKey) return stored;
  const fresh = await generateVapidKeys();
  // Si une autre exécution a créé les clés entre-temps, ce sont les siennes qui restent.
  return rpc<VapidKeys>('_push_set_keys', {
    p_public: fresh.publicKey,
    p_private: fresh.privateJwk,
  });
}

interface Item {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: { title: string; body: string; url: string; tag: string | null };
}

Deno.serve(async () => {
  const keys = await vapidKeys();
  let sent = 0;
  const gone: string[] = [];
  for (let round = 0; round < 10; round++) {
    const batch = await rpc<Item[]>('_push_take_batch', { p_limit: BATCH });
    if (batch.length === 0) break;
    await Promise.all(
      batch.map(async (item) => {
        try {
          const status = await sendPush(item, JSON.stringify(item.payload), keys, SUBJECT);
          if (status === 404 || status === 410) gone.push(item.endpoint);
          else if (status >= 200 && status < 300) sent++;
          else console.warn(`Push refusé (${status}) : ${new URL(item.endpoint).host}`);
        } catch (err) {
          console.warn(`Push impossible : ${err}`);
        }
      }),
    );
  }
  if (gone.length) await rpc('_push_forget', { p_endpoints: gone });
  return new Response(JSON.stringify({ sent, forgotten: gone.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
