// @vitest-environment node
import { createECDH, randomBytes } from 'node:crypto';
import { decrypt } from 'http_ece';
import { vi } from 'vitest';
import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  generateVapidKeys,
  sendPush,
  vapidAuthorization,
} from '../../supabase/functions/push-send/webpush';

/** Un « appareil » : sa paire de clés et son secret, comme un navigateur abonné. */
function device() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    ecdh,
    sub: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p256dh: b64urlEncode(ecdh.getPublicKey()),
      auth: b64urlEncode(randomBytes(16)),
    },
  };
}

describe('Web Push', () => {
  it("chiffre un message que l'appareil sait déchiffrer (aes128gcm)", async () => {
    const { ecdh, sub } = device();
    const payload = JSON.stringify({
      title: 'Julie monte dans ta voiture 🥥',
      body: 'Annecy · Aller.',
    });
    const body = await encryptPayload(sub, payload);
    const clear = decrypt(Buffer.from(body), {
      version: 'aes128gcm',
      privateKey: ecdh,
      authSecret: sub.auth,
    });
    expect(Buffer.from(clear).toString('utf8')).toBe(payload);
  });

  it("signe l'en-tête VAPID avec la clé privée (ES256)", async () => {
    const keys = await generateVapidKeys();
    expect(b64urlDecode(keys.publicKey)).toHaveLength(65);
    const header = await vapidAuthorization(
      'https://web.push.apple.com/abc',
      keys,
      'mailto:contact@cocovoiturage.fr',
      0,
    );
    const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(keys.publicKey);
    const [h, c, s] = token.split('.');
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c)))).toEqual({
      aud: 'https://web.push.apple.com',
      exp: 12 * 3600,
      sub: 'mailto:contact@cocovoiturage.fr',
    });
    const pub = await crypto.subtle.importKey(
      'raw',
      b64urlDecode(keys.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pub,
      b64urlDecode(s),
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });

  it('envoie au service push avec les bons en-têtes', async () => {
    const { sub } = device();
    const keys = await generateVapidKeys();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    const status = await sendPush(sub, '{}', keys, 'mailto:contact@cocovoiturage.fr', fetchMock);
    expect(status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(sub.endpoint);
    expect(init.headers['Content-Encoding']).toBe('aes128gcm');
    expect(init.headers.Authorization).toMatch(/^vapid t=.+, k=/);
  });
});
