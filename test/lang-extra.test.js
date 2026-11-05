'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tExtra, verifyExtraParity, getExtraKeys } = require('../src/lib/lang-extra.js');

test('lang-extra: full he/ar/ru parity for every new screen, fallback to Hebrew', () => {
  const p = verifyExtraParity();
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.ok(getExtraKeys().length >= 30);
  assert.equal(tExtra('sem.stalePair', 'he'), 'הזוג לא נפגש כבר שבועיים');
  assert.equal(tExtra('sem.stalePair', 'ar'), 'لم يلتقِ الزوج منذ أسبوعين');
  assert.match(tExtra('rep.title', 'ru'), /координатора/);
  assert.equal(tExtra('sched.title', 'fr'), tExtra('sched.title', 'he'));
  assert.equal(tExtra('no.such.key', 'ar'), 'no.such.key');
  for (const prefix of ['sched.', 'cap.', 'sem.', 'rep.', 'imp.', 'wiz.', 'bak.', 'guide.']) {
    assert.ok(getExtraKeys().some((k) => k.startsWith(prefix)), prefix);
  }
});
