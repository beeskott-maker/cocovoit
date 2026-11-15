// Bibliothèque de référence Web Push (tests seulement), sans types publiés.
declare module 'http_ece' {
  export function decrypt(
    buffer: Uint8Array,
    params: { version: 'aes128gcm'; privateKey: unknown; authSecret: string },
  ): Uint8Array;
}
