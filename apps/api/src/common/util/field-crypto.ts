import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** AES-256-GCM app-layer encryption for high-sensitivity fields (SEVIS id, passport no). */
export function encryptField(plain: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function decryptField(payload: string, hexKey: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const key = Buffer.from(hexKey, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
