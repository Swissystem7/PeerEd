'use strict';
// PeerEd - encrypted backup envelope (stage 6). The crypto primitives are INJECTED by the caller
// (browser: WebCrypto-derived key + AES-GCM; tests: node:crypto), because this single file may not
// require node modules and home-grown synchronous crypto would be worse than none. This module owns
// only the envelope shape, its strict validation and one generic failure message: a wrong passphrase
// and a tampered file are indistinguishable from outside.

const FIELDS = Object.freeze(['v', 'kdf', 'iter', 'salt', 'iv', 'ciphertext']);
const MIN_ITER = 100000;
const OPEN_ERROR = 'cannot open backup';

function isHex(s, minLen) { return typeof s === 'string' && /^[0-9a-f]+$/.test(s) && s.length >= minLen && s.length % 2 === 0; }

function makeBackupEnvelope(plaintext, opts) {
  const o = opts || {};
  if (typeof plaintext !== 'string' || plaintext === '') throw new Error('invalid backup: expected non-empty text');
  if (!isHex(o.saltHex, 16) || !isHex(o.ivHex, 16)) throw new Error('invalid backup: salt and iv must be hex');
  const iter = o.iter === undefined ? 210000 : o.iter;
  if (!Number.isInteger(iter) || iter < MIN_ITER) throw new Error('invalid backup: iteration count too low');
  if (typeof o.encrypt !== 'function') throw new Error('invalid backup: encrypt primitive is required');
  const ciphertext = o.encrypt(plaintext, { saltHex: o.saltHex, ivHex: o.ivHex, iter: iter });
  if (!isHex(ciphertext, 32)) throw new Error('invalid backup: encrypt primitive returned malformed ciphertext');
  return Object.freeze({ v: 1, kdf: 'PBKDF2-SHA256', iter: iter, salt: o.saltHex, iv: o.ivHex, ciphertext: ciphertext });
}

function openBackupEnvelope(envelope, opts) {
  try {
    if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error(OPEN_ERROR);
    const keys = Object.keys(envelope).sort();
    if (keys.length !== FIELDS.length || !FIELDS.every((f) => keys.indexOf(f) !== -1)) throw new Error(OPEN_ERROR);
    if (envelope.v !== 1 || envelope.kdf !== 'PBKDF2-SHA256') throw new Error(OPEN_ERROR);
    if (!Number.isInteger(envelope.iter) || envelope.iter < MIN_ITER) throw new Error(OPEN_ERROR);
    if (!isHex(envelope.salt, 16) || !isHex(envelope.iv, 16) || !isHex(envelope.ciphertext, 32)) throw new Error(OPEN_ERROR);
    if (!opts || typeof opts.decrypt !== 'function') throw new Error(OPEN_ERROR);
    const plain = opts.decrypt(envelope.ciphertext, { saltHex: envelope.salt, ivHex: envelope.iv, iter: envelope.iter });
    if (typeof plain !== 'string' || plain === '') throw new Error(OPEN_ERROR);
    return plain;
  } catch (e) { throw new Error(OPEN_ERROR); }
}

function backupFilename(dateISO) {
  if (typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error('invalid date: expected YYYY-MM-DD');
  return 'peered-backup-' + dateISO + '.json';
}

module.exports = { makeBackupEnvelope, openBackupEnvelope, backupFilename, MIN_ITER };
