'use strict';
// One place for the contact channel: src/lib/contact.js. The owner fills CONTACT (an email or an https
// link); until then the app points at a Hebrew GitHub issue form. Nothing is invented: an empty or
// malformed value shows no contact at all rather than a broken one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, ROOT } = require('../test-support/fake-dom.js');

const contact = require('../src/lib/contact.js');

test('contactLink: email, https link, issue-form fallback, or nothing', () => {
  const form = 'https://github.com/Swissystem7/PeerEd/issues/new?template=pilot.yml';
  assert.deepEqual(contact.contactLink('pilot@example.org', form),
    { kind: 'email', href: 'mailto:pilot@example.org', label: 'pilot@example.org' });
  assert.equal(contact.contactLink(' https://forms.example.org/x ', form).href, 'https://forms.example.org/x');
  assert.equal(contact.contactLink('', form).kind, 'issue');
  assert.equal(contact.contactLink('', form).href, form);
  assert.equal(contact.contactLink('', ''), null, 'nothing configured: nothing shown');
  assert.equal(contact.contactLink('call me', form), null, 'a malformed value is not shown');
  assert.equal(contact.contactLink('javascript:alert(1)', form), null);
  assert.equal(contact.contactLink('http://plain.example.org', form), null, 'https only');
});

test('the shipped config: CONTACT is empty (the owner fills it), the fallback is this repo\'s issue form', () => {
  assert.equal(contact.CONTACT, '');
  assert.match(contact.ISSUE_FORM, /^https:\/\/github\.com\/Swissystem7\/PeerEd\/issues\/new\?template=pilot\.yml$/);
});

test('the issue form exists, is Hebrew, and warns that the request is public', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'pilot.yml'), 'utf8');
  assert.match(yml, /^name: .*[֐-׿]/m);
  assert.match(yml, /ציבורי/);
  assert.match(yml, /אל תכתבו/);
  assert.doesNotMatch(yml, /id: (phone|email|name)\b/, 'the form asks for no contact detail');
});

test('the app shows the configured channel, and hides the box when there is none', () => {
  const $ = openApp();
  assert.equal($('contactBox').hidden, false);
  assert.equal($('contactLink').href, contact.ISSUE_FORM);
  assert.match($('contactNote').textContent, /ציבורי/);
});
