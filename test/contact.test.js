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

test('isValidEmail accepts a well-formed address', () => {
  assert.equal(contact.isValidEmail('user@example.com'), true);
});

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

// Since 28.9 the public contact channel for all his apps is his Google Form
// "משוב על האפליקציות", with the app field pre-filled as PeerEd (an exact option of the form).
const OWNER_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdT8YduNx-VWKM3bWGUJdiSj4Sw9D-EA6R6c-oYVYCQmOVXxQ/viewform?usp=pp_url&entry.368039752=PeerEd';

test('the shipped config: CONTACT is the owner\'s Google Form; the fallback is this repo\'s issue form', () => {
  assert.equal(contact.CONTACT, OWNER_FORM);
  assert.doesNotMatch(contact.CONTACT, /@|tel:|wa\.me/, 'no email or phone');
  assert.match(contact.ISSUE_FORM, /^https:\/\/github\.com\/Swissystem7\/PeerEd\/issues\/new\?template=pilot\.yml$/);
});

test('the issue form exists, is Hebrew, and warns who can read the request (the repo is private)', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'pilot.yml'), 'utf8');
  assert.match(yml, /^name: .*[֐-׿]/m);
  assert.match(yml, /גלויה לכל מי שיש לו גישה לריפו/);
  assert.doesNotMatch(yml, /ציבורי/, 'the repo is private, the request is not public');
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.match(shell, /הריפו בגיטהאב פרטי: רק מי שקיבל גישה אליו יכול לפתוח את הטופס/);
  assert.doesNotMatch(shell, /בגיטהאב ציבורית/);
  assert.match(yml, /אל תכתבו/);
  assert.doesNotMatch(yml, /id: (phone|email|name)\b/, 'the form asks for no contact detail');
});

test('the app shows the configured channel, and hides the box when there is none', () => {
  const $ = openApp();
  assert.equal($('contactBox').hidden, false);
  assert.equal($('contactLink').href, OWNER_FORM, 'the app links to the form');
  assert.match($('contactLink').textContent, /טופס/);
  assert.doesNotMatch($('contactNote').textContent, /גיטהאב|GitHub/, 'no GitHub warning once CONTACT is set');
  const built = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.ok(built.includes("var CONTACT = '" + OWNER_FORM + "';"), 'app.html is rebuilt with the form link');
});

test('a11y: contactLink has aria-describedby pointing to contactNote', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(/<a id="contactLink"[^>]*aria-describedby="contactNote"/.test(shell),
    'contactLink must have aria-describedby="contactNote"');
});

test('a11y: external contact link sets target, rel, and announces new tab', () => {
  const $ = openApp();
  assert.equal($('contactLink').getAttribute('target'), '_blank');
  assert.equal($('contactLink').getAttribute('rel'), 'noopener noreferrer');
  assert.equal($('contactLink').getAttribute('aria-label'), $('contactLink').textContent + ' (נפתח בלשונית חדשה)');
});

test('a11y: contactBox has role="region" and aria-labelledby pointing to contactTitle', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(/<div class="card" id="contactBox"[^>]*role="region"[^>]*aria-labelledby="contactTitle"/.test(shell),
    'contactBox must have role="region" and aria-labelledby="contactTitle"');
  assert.ok(/<h2 id="contactTitle">/.test(shell),
    'contact heading must have id="contactTitle"');
});

