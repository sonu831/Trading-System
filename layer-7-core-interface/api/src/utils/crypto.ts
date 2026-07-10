/**
 * AES-256-GCM encryption for broker credentials.
 * Master key from env — never hardcoded.
 */
const crypto = require('crypto');

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterKey(): Buffer {
  const key = process.env.CREDENTIAL_MASTER_KEY;
  if (!key) throw new Error('CREDENTIAL_MASTER_KEY environment variable is not set');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== KEY_LENGTH) throw new Error(`CREDENTIAL_MASTER_KEY must be ${KEY_LENGTH * 2} hex characters`);
  return buf;
}

function encrypt(plaintext: string): EncryptedPayload {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext: encrypted.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function decrypt(ciphertext: string, iv: string, tag: string): string {
  const masterKey = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function generateMasterKey(): string { return crypto.randomBytes(KEY_LENGTH).toString('hex'); }

function maskValue(value: string | undefined): string {
  if (!value) return '(not set)';
  if (value.length <= 6) return '******';
  return value.substring(0, 3) + '***' + value.substring(value.length - 3);
}

export = { encrypt, decrypt, generateMasterKey, maskValue, getMasterKey };
export type { EncryptedPayload };
