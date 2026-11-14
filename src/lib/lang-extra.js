'use strict';
// PeerEd - lookup + parity for the new-screen dictionaries (stage 7). Separate from i18n.js (PR #358
// is not merged, so nothing here touches it). Fallback: Hebrew, then the key itself.

const DICTS = Object.freeze({ he: require('./lang-he.js'), ar: require('./lang-ar.js'), ru: require('./lang-ru.js') });
const LANGS = Object.freeze(['he', 'ar', 'ru']);

function getExtraKeys() { return Object.keys(DICTS.he).sort(); }
function tExtra(key, lang) {
  const d = DICTS[lang] || DICTS.he;
  if (typeof d[key] === 'string' && d[key] !== '') return d[key];
  return typeof DICTS.he[key] === 'string' ? DICTS.he[key] : key;
}
function verifyExtraParity() {
  const base = getExtraKeys(); const missing = {}; const extra = {}; let ok = true;
  LANGS.forEach((lang) => {
    if (lang === 'he') return;
    const keys = Object.keys(DICTS[lang]);
    missing[lang] = base.filter((k) => typeof DICTS[lang][k] !== 'string' || DICTS[lang][k].trim() === '');
    extra[lang] = keys.filter((k) => base.indexOf(k) === -1).sort();
    if (missing[lang].length || extra[lang].length) ok = false;
  });
  return { ok, missingKeys: missing, extraKeys: extra };
}

module.exports = { getExtraKeys, tExtra, verifyExtraParity };
