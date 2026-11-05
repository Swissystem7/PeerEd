'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { manifestJson, swSource } = require('../src/lib/pwa.js');
const { makeBackupEnvelope, openBackupEnvelope, backupFilename } = require('../src/lib/backup.js');

function primitives(passphrase) {
  const key = (saltHex, iter) => crypto.pbkdf2Sync(passphrase, Buffer.from(saltHex, 'hex'), iter, 32, 'sha256');
  return {
    encrypt: (plain, o) => {
      const c = crypto.createCipheriv('aes-256-gcm', key(o.saltHex, o.iter), Buffer.from(o.ivHex, 'hex'));
      const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
      return Buffer.concat([body, c.getAuthTag()]).toString('hex');
    },
    decrypt: (hex, o) => {
      const raw = Buffer.from(hex, 'hex');
      const d = crypto.createDecipheriv('aes-256-gcm', key(o.saltHex, o.iter), Buffer.from(o.ivHex, 'hex'));
      d.setAuthTag(raw.subarray(raw.length - 16));
      return Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]).toString('utf8');
    }
  };
}
const SALT = '00112233445566778899aabbccddeeff'; const IV = '0102030405060708090a0b0c';

test('pwa: manifest is standalone with no external icons; worker source is cache-only', () => {
  const m = JSON.parse(manifestJson());
  assert.equal(m.display, 'standalone'); assert.equal(m.icons.length, 1); assert.ok(m.icons[0].src.startsWith('data:image/svg+xml'));
  const sw = swSource({ cacheName: 'peered-v9' });
  assert.match(sw, /peered-v9/); assert.match(sw, /caches\.match/);
  assert.ok(!/fetch\s*\(/.test(sw) && !/https?:/.test(sw), 'worker reaches no network');
});

test('backup: AES-256-GCM round trip via injected primitives; wrong pass and tamper give one generic error', () => {
  const env = makeBackupEnvelope('{"pairs":[]}', Object.assign({ saltHex: SALT, ivHex: IV }, primitives('correct horse')));
  assert.equal(env.kdf, 'PBKDF2-SHA256'); assert.ok(env.iter >= 100000);
  assert.equal(openBackupEnvelope(env, primitives('correct horse')), '{"pairs":[]}');
  assert.throws(() => openBackupEnvelope(env, primitives('wrong')), /^Error: cannot open backup$/);
  const tampered = Object.assign({}, env, { ciphertext: env.ciphertext.slice(0, -2) + 'ff' });
  assert.throws(() => openBackupEnvelope(tampered, primitives('correct horse')), /cannot open backup/);
  assert.throws(() => makeBackupEnvelope('x', { saltHex: SALT, ivHex: IV, iter: 10, encrypt: () => 'aa'.repeat(20) }), /iteration count out of range/);
  assert.throws(() => makeBackupEnvelope('x', { saltHex: 'aabbccdd', ivHex: IV, encrypt: () => 'aa'.repeat(20) }), /salt must be at least 16 bytes/);
  assert.equal(backupFilename('2026-09-01'), 'peered-backup-2026-09-01.json');
});
