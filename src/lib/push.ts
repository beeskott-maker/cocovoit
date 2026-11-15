import { useCallback, useEffect, useState } from 'react';
import { b64urlDecode } from '../../supabase/functions/push-send/webpush';
import { useApi } from './api';
import { storageKey } from './env';
import { isIos, isStandalone } from './install';
import { ApiError, type Api } from './types';

/**
 * Notifications push sur cet appareil.
 * - unsupported : navigateur sans notifications push (rien n'est proposé) ;
 * - needs-install : iPhone / iPad, possible seulement avec l'appli installée ;
 * - denied : refusées dans la fenêtre du système (réglages du téléphone) ;
 * - off / on : désactivées / activées sur cet appareil.
 */
export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const ASKED_KEY = storageKey('push-asked');
const DEMO_KEY = storageKey('push-demo');
const RESUME_KEY = storageKey('push-resume');
const ASK_AGAIN_DAYS = 30;

/** Réabonnement en cours après une reconnexion (l'état affiché l'attend). */
let resuming: Promise<unknown> = Promise.resolve();

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : sans conséquence (on redemandera, ou l'état démo est oublié).
  }
}

/**
 * Service worker de l'appli (absent en développement local). `wait` : attend qu'il
 * soit actif (4 s au plus), pour s'abonner ; sinon, simple lecture de l'état.
 */
async function registration(wait = false): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  if (!wait) return (await navigator.serviceWorker.getRegistration?.()) ?? null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function pushStatus(api: Api): Promise<PushStatus> {
  if (!supported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  if (api.mode === 'demo') return read(DEMO_KEY) === '1' ? 'on' : 'off';
  const reg = await registration();
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

/**
 * Demande l'autorisation puis abonne cet appareil. Renvoie le nouvel état.
 * `silent` : réabonnement automatique, sans notification d'exemple en démo.
 */
export async function enablePush(api: Api, token: string, silent = false): Promise<PushStatus> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  const reg = await registration(true);
  if (!reg) throw new ApiError("Notifications indisponibles sur cet appareil pour l'instant.", 'unknown');

  const key = await api.pushPublicKey();
  if (!key) {
    if (api.mode !== 'demo')
      throw new ApiError('Notifications indisponibles pour le moment, réessaie plus tard.', 'unknown');
    // Démo : pas de vrai envoi, une notification d'exemple sur l'appareil.
    write(DEMO_KEY, '1');
    if (silent) return 'on';
    await reg.showNotification('Julie monte dans ta voiture 🥥', {
      body: 'Week-end à Annecy · Aller. Il reste 2 places sur 4. (exemple)',
      icon: 'pwa-192.png',
    });
    return 'on';
  }
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlDecode(key),
    }));
  const json = sub.toJSON();
  await api.pushSubscribe(token, {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  });
  return 'on';
}

/** Coupe les notifications sur cet appareil (aussi à la déconnexion). */
export async function disablePush(api: Api, token: string): Promise<PushStatus> {
  write(DEMO_KEY, null);
  if (!supported()) return pushStatus(api);
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.pushUnsubscribe(token, sub.endpoint).catch(() => undefined);
    await sub.unsubscribe().catch(() => false);
  }
  return pushStatus(api);
}

/**
 * Déconnexion : si les notifications étaient activées, l'appareil s'en souvient
 * pour les réactiver quand ce même compte se reconnecte.
 */
export async function rememberPushForReturn(api: Api, email: string) {
  write(RESUME_KEY, (await pushStatus(api)) === 'on' ? email.toLowerCase() : null);
}

/** Connexion : réabonne l'appareil si ce compte les avait activées avant de se déconnecter. */
export function resumePushAfterLogin(api: Api, token: string, email: string) {
  const saved = read(RESUME_KEY);
  write(RESUME_KEY, null);
  if (saved !== email.toLowerCase() || !supported() || Notification.permission !== 'granted') return;
  resuming = enablePush(api, token, true).catch(() => undefined);
}

/** Message après la demande : activées, refusées, ou erreur. */
export function pushResultMessage(status: PushStatus): string | null {
  if (status === 'on') return 'Notifications activées 🔔';
  if (status === 'denied') return 'Notifications refusées : tu peux les réautoriser dans les réglages du téléphone.';
  return null;
}

/** Proposer d'activer les notifications ? Une fois, puis pas avant 30 jours après « Plus tard ». */
export function shouldAskPush(status: PushStatus): boolean {
  if (status !== 'off' && status !== 'needs-install') return false;
  const at = Number(read(ASKED_KEY));
  return !(at > 0 && Date.now() - at < ASK_AGAIN_DAYS * 24 * 3600 * 1000);
}
export function markPushAsked() {
  write(ASKED_KEY, String(Date.now()));
}

/** État des notifications sur cet appareil, et actions pour les activer ou les couper. */
export function usePush(token: string) {
  const api = useApi();
  const [status, setStatus] = useState<PushStatus | null>(null);
  useEffect(() => {
    let alive = true;
    void resuming.then(() => pushStatus(api)).then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, [api]);
  const enable = useCallback(async () => {
    const s = await enablePush(api, token);
    setStatus(s);
    return s;
  }, [api, token]);
  const disable = useCallback(async () => {
    const s = await disablePush(api, token);
    setStatus(s);
    return s;
  }, [api, token]);
  return { status, enable, disable };
}
