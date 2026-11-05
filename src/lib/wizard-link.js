'use strict';
// PeerEd - anonymous weekly availability wizard link (stage 5). No server: the student's answers ride
// in the URL fragment as base64url JSON plus an FNV-1a integrity check. The check is NOT encryption and
// NOT a secret - it only catches a mistyped or edited link. The payload holds no name and no identifier:
// exactly the fields makeProfile accepts for a wizard answer (role/region/subjects/availability).

const { makeProfile } = require('./profile.js');

const FIELDS = Object.freeze(['role', 'region', 'subjects', 'availability']);
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(payload) {
  const bin = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function canonical(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid availability link');
  const keys = Object.keys(input).sort();
  if (keys.length !== FIELDS.length || !FIELDS.every((f) => keys.indexOf(f) !== -1)) throw new Error('invalid availability link');
  return JSON.stringify({ role: input.role, region: input.region, subjects: input.subjects, availability: input.availability });
}
function encodeAvailabilityLink(input) {
  const body = canonical(input);
  makeProfile(JSON.parse(body)); // refuses anything the profile gate refuses, before a link exists
  const payload = b64urlEncode(body);
  return '#a=' + payload + '.' + fnv1a(payload);
}
function decodeAvailabilityLink(hash) {
  const m = typeof hash === 'string' && /^#a=([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(hash.trim());
  if (!m || fnv1a(m[1]) !== m[2]) throw new Error('invalid availability link');
  let parsed;
  try { parsed = JSON.parse(b64urlDecode(m[1])); } catch (e) { throw new Error('invalid availability link'); }
  if (canonical(parsed) !== b64urlDecode(m[1]) && JSON.stringify(parsed) !== b64urlDecode(m[1])) throw new Error('invalid availability link');
  return makeProfile(parsed);
}

module.exports = { encodeAvailabilityLink, decodeAvailabilityLink, fnv1a };
