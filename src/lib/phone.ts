import { isApple } from './maps';

/**
 * Numéro saisi librement (06 12 34 56 78, 0033…, +33 6…) → format international
 * (+33612345678), comme la fonction SQL _phone. Vide : null. Invalide : undefined.
 */
export function parsePhone(input: string): string | null | undefined {
  let v = input.replace(/[\s.()-]/g, '');
  if (v === '') return null;
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  else if (/^0[1-9]\d{8}$/.test(v)) v = `+33${v.slice(1)}`;
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : undefined;
}

/** +33612345678 → 06 12 34 56 78 ; les numéros étrangers restent au format international. */
export function formatPhone(phone: string): string {
  const fr = /^\+33(\d{9})$/.exec(phone);
  return fr ? `0${fr[1]}`.replace(/(\d{2})(?=\d)/g, '$1 ') : phone;
}

export const telUrl = (phone: string) => `tel:${phone}`;

/** SMS à un ou plusieurs numéros. L'iPhone n'accepte plusieurs destinataires que sous cette forme. */
export function smsUrl(phones: string[], ua: string = navigator.userAgent): string {
  if (phones.length > 1 && isApple(ua)) return `sms:/open?addresses=${phones.join(',')}`;
  return `sms:${phones.join(',')}`;
}
