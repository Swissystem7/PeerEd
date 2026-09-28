'use strict';
// PeerEd - the ONE place for a contact channel. Nothing here is invented: the owner fills CONTACT.
//   CONTACT     an email (name@host.tld) or an https link to a form. Empty = use ISSUE_FORM.
//   ISSUE_FORM  the Hebrew GitHub issue form of this repository (.github/ISSUE_TEMPLATE/pilot.yml).
// A malformed value shows NO contact rather than a broken one. The link is only ever an <a href> the
// user clicks: the app itself still sends nothing anywhere (test/app-build.test.js).

var CONTACT = '';
var ISSUE_FORM = 'https://github.com/Swissystem7/PeerEd/issues/new?template=pilot.yml';

var EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
var HTTPS_RE = /^https:\/\/[^\s"'<>]+$/;

// -> { kind: 'email' | 'link' | 'issue', href, label } or null
function contactLink(contact, issueForm) {
  var c = typeof contact === 'string' ? contact.trim() : '';
  if (c !== '') {
    if (EMAIL_RE.test(c)) return { kind: 'email', href: 'mailto:' + c, label: c };
    if (HTTPS_RE.test(c)) return { kind: 'link', href: c, label: 'טופס יצירת קשר' };
    return null;
  }
  var f = typeof issueForm === 'string' ? issueForm.trim() : '';
  if (HTTPS_RE.test(f)) return { kind: 'issue', href: f, label: 'טופס פנייה ב-GitHub' };
  return null;
}

module.exports = { CONTACT: CONTACT, ISSUE_FORM: ISSUE_FORM, contactLink: contactLink };
