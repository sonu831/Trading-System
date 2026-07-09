const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterKey() {
  const key = process.env.CREDENTIAL_MASTER_KEY;
  if (!key) {
    throw new Error('CREDENTIAL_MASTER_KEY environment variable is not set');
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`CREDENTIAL_MASTER_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`);
  }
  return buf;
}

function encrypt(plaintext) {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decrypt(ciphertext, iv, tag) {
  const masterKey = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function generateMasterKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

function maskValue(value) {
  if (!value) return '(not set)';
  if (value.length <= 6) return '******';
  return value.substring(0, 3) + '***' + value.substring(value.length - 3);
}

module.exports = { encrypt, decrypt, generateMasterKey, maskValue, getMasterKey };
