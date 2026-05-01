// Web Push Protocol implementation using Web Crypto API
// Implements RFC 8291 (Message Encryption for Web Push) and RFC 8292 (VAPID)

function base64urlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function generateVapidKeys(): Promise<{ publicKey: string; privateKeyJwk: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return {
    publicKey: base64urlEncode(publicKeyRaw),
    privateKeyJwk: JSON.stringify(privateKeyJwk),
  };
}

async function createVapidJwt(audience: string, privateKeyJwk: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:payhook@notifications.local',
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(privateKeyJwk),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsignedToken)
    )
  );

  return `${unsignedToken}.${base64urlEncode(signature)}`;
}

async function hkdfDerive(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(derived);
}

async function encryptPayload(p256dh: string, auth: string, payload: string): Promise<Uint8Array> {
  const subscriberKeyRaw = base64urlDecode(p256dh);
  const authSecret = base64urlDecode(auth);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const localPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

  // Import subscriber public key
  const subscriberPubKey = await crypto.subtle.importKey(
    'raw', subscriberKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberPubKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Derive IKM
  const keyInfoParts = [
    new TextEncoder().encode('WebPush: info\0'),
    subscriberKeyRaw,
    localPublicKey,
  ];
  const keyInfo = new Uint8Array(keyInfoParts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of keyInfoParts) {
    keyInfo.set(part, offset);
    offset += part.length;
  }

  const ikm = await hkdfDerive(sharedSecret, authSecret, keyInfo, 32);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key (16 bytes for AES-128-GCM)
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = await hkdfDerive(ikm, salt, cekInfo, 16);

  // Derive nonce (12 bytes)
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = await hkdfDerive(ikm, salt, nonceInfo, 12);

  // Encrypt with AES-128-GCM, add padding delimiter
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // padding delimiter

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload)
  );

  // Build aes128gcm record
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, 4096);

  const header = new Uint8Array(16 + 4 + 1 + localPublicKey.length);
  header.set(salt, 0);
  header.set(new Uint8Array(rs.buffer), 16);
  header[20] = localPublicKey.length;
  header.set(localPublicKey, 21);

  const result = new Uint8Array(header.length + encrypted.length);
  result.set(header);
  result.set(encrypted, header.length);
  return result;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKeyJwk: string
): Promise<Response> {
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await createVapidJwt(audience, vapidPrivateKeyJwk);
  const encrypted = await encryptPayload(subscription.p256dh, subscription.auth, JSON.stringify(payload));

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: encrypted,
  });
}
