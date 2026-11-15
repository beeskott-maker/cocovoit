import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { ApiContext } from '../lib/api';
import { disablePush, enablePush, pushStatus, shouldAskPush } from '../lib/push';
import type { Api } from '../lib/types';
import { PushAskSheet, PushSetting } from './Push';

/** Navigateur compatible push : Notification, PushManager et service worker simulés. */
function fakeBrowser(permission: NotificationPermission = 'default', answer: NotificationPermission = 'granted') {
  let subscription: {
    endpoint: string;
    toJSON: () => unknown;
    unsubscribe: () => Promise<boolean>;
  } | null = null;
  const reg = {
    showNotification: vi.fn().mockResolvedValue(undefined),
    pushManager: {
      getSubscription: vi.fn(async () => subscription),
      subscribe: vi.fn(async () => {
        subscription = {
          endpoint: 'https://push.example.com/abc',
          toJSON: () => ({ keys: { p256dh: 'P256', auth: 'AUTH' } }),
          unsubscribe: vi.fn(async () => {
            subscription = null;
            return true;
          }),
        };
        return subscription;
      }),
    },
  };
  const Notification = {
    permission,
    requestPermission: vi.fn(async () => (Notification.permission = answer)),
  };
  vi.stubGlobal('Notification', Notification);
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(reg), getRegistration: async () => reg },
  });
  return { reg, Notification };
}

function fakeApi(mode: 'supabase' | 'demo', key: string | null = 'BKey'): Api {
  return {
    mode,
    pushPublicKey: vi.fn().mockResolvedValue(key),
    pushSubscribe: vi.fn().mockResolvedValue(undefined),
    pushUnsubscribe: vi.fn().mockResolvedValue(undefined),
  } as unknown as Api;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('notifications push', () => {
  it('navigateur sans push : rien à proposer', async () => {
    const api = fakeApi('supabase');
    expect(await pushStatus(api)).toBe('unsupported');
    expect(shouldAskPush('unsupported')).toBe(false);
  });

  it('activation : autorisation, abonnement, enregistrement en base ; puis désactivation', async () => {
    const { reg } = fakeBrowser();
    const api = fakeApi('supabase');
    expect(await pushStatus(api)).toBe('off');
    expect(await enablePush(api, 'tok')).toBe('on');
    expect(reg.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      }),
    );
    expect(api.pushSubscribe).toHaveBeenCalledWith('tok', {
      endpoint: 'https://push.example.com/abc',
      p256dh: 'P256',
      auth: 'AUTH',
    });
    expect(await pushStatus(api)).toBe('on');

    expect(await disablePush(api, 'tok')).toBe('off');
    expect(api.pushUnsubscribe).toHaveBeenCalledWith('tok', 'https://push.example.com/abc');
  });

  it('autorisation refusée : état « denied », plus de proposition', async () => {
    fakeBrowser('default', 'denied');
    const api = fakeApi('supabase');
    expect(await enablePush(api, 'tok')).toBe('denied');
    expect(api.pushSubscribe).not.toHaveBeenCalled();
    expect(shouldAskPush('denied')).toBe(false);
  });

  it("démo : notification d'exemple sur l'appareil, sans abonnement", async () => {
    const { reg } = fakeBrowser();
    const api = fakeApi('demo', null);
    expect(await enablePush(api, 'tok')).toBe('on');
    expect(reg.showNotification).toHaveBeenCalledWith('Julie monte dans ta voiture 🥥', expect.any(Object));
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
    expect(await pushStatus(api)).toBe('on');
  });

  it('proposition au conducteur : « Activer » puis message ; « Plus tard » ne redemande pas', async () => {
    fakeBrowser();
    const api = fakeApi('supabase');
    const onDone = vi.fn();
    render(
      <ApiContext.Provider value={api}>
        <PushAskSheet token="tok" role="driver" onDone={onDone} />
      </ApiContext.Provider>,
    );
    expect(
      await screen.findByRole('dialog', {
        name: "Être prévenu quand quelqu'un monte ?",
      }),
    ).toBeInTheDocument();
    expect(shouldAskPush('off')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Activer les notifications' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Notifications activées 🔔'));
    expect(shouldAskPush('off')).toBe(false);
  });

  it('réglage de Mes voyages : interrupteur pour cet appareil', async () => {
    fakeBrowser('granted');
    const api = fakeApi('supabase');
    const onMessage = vi.fn();
    render(
      <ApiContext.Provider value={api}>
        <PushSetting token="tok" onMessage={onMessage} />
      </ApiContext.Provider>,
    );
    const toggle = await screen.findByRole('switch', { name: /Notifications/ });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(onMessage).toHaveBeenCalledWith('Notifications activées 🔔');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(onMessage).toHaveBeenLastCalledWith('Notifications coupées sur cet appareil');
  });
});
