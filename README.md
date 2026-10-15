# PeerEd (working name)

A free matching tool for tutoring coordinators: university students are paired with high-school pupils by
region, free hours and subject, with no name, phone, email or id ever entered. The coordinator keeps the
names in their own sheet and uses PeerEd for the part that is slow by hand: who can meet whom, when.

Owner idea, 2026-09-07: high-school age, its own repository. Rules: no cloud
dependency, no personal data of minors, deterministic tests only. Private repository until the owner
approves publishing.

## Quickstart

Node 18 or newer. There are **no dependencies and no install
step** — the repository has no lockfile, so `npm install` is unnecessary and `npm ci` fails by design.
Go straight to the commands:

```sh
npm test                      # the whole suite (node --test)
node --test test/unit.test.js # one file (Node's built-in runner; no other test framework)
npm run build                 # regenerate app.html from src/app-shell.html + src/lib/*.js
npm run build:check           # exit 1 if app.html is stale — the second CI gate
```

To run the app, open `app.html` in a browser. It is a single self-contained file with no external
requests, so opening it straight from disk (`file://`) works; no server and no build are needed, because
the committed `app.html` is already built. After any change under `src/lib/` or to `src/app-shell.html`,
run `npm run build` and commit the regenerated `app.html`.

## What works today

`app.html` is the whole app: one file, no server, no network call, built from the tested modules by
`node scripts/build-app.js` (`--check` fails if it is stale). `npm test` runs the suite.

| File | What it does |
|---|---|
| `src/lib/regions.js` | The six region codes and their validation. |
| `src/lib/retention.js` | How long each kind of record may be kept (profile 730 days, match 365); nothing is kept indefinitely. |
| `src/lib/audit-report.js` | A Hebrew privacy and retention statement for audits, generated from the active retention policy (what is collected, how long it is kept, how it is deleted). |
| `src/lib/cycle-manager.js` | The end-of-cycle sweep: `sweep()` splits stored rows into the ones the policy still allows and the ones to delete, by `retention.js`'s limit for the row's category as it stands today; `applyRetentionPolicy()` drops stored match and profile rows whose age exceeds the `maxAgeDays` stamped on them. The caller passes the date and writes the result back; nothing is mutated. A module only: no screen runs a sweep yet. |
| `src/lib/profile.js` | The only record the app keeps: role, region, availability slots (8:00-22:00), subjects. Any other key, even an empty one, is refused with `personal data is not accepted`. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared hour, at least one shared subject, each person at most once, and the largest possible number of pairs (a greedy pass by shared hours, then augmenting paths). `explainUnmatched()` gives the true reason for each person left out; `makeMatchRecord()` stamps a pair with the day it was kept and its retention category, so a stored pair carries its own expiry; the screen does not store pairs yet. |
| `src/lib/validator.js` | The free-text gate (email, Israeli phone, nine-digit id, links, handles). On screen it is a demo: the app stores no free text. |
| `src/lib/unit.js` | An enrichment-unit record with a deterministic id (title and body pass the free-text gate). A module only: nothing on screen offers or stores units. |
| `src/lib/approval.js` | The approval queue for units: pending, approved or rejected by the approver role only (no personal identity), deterministic and JSON-serializable. A module only: nothing on screen runs the flow yet. |
| `src/lib/session.js` | The session log (MVP item 6): a row per session of a matched pair holding only what the pair shares (region, slot, subject, the approved unit id, the outcome); roster positions never reach it, an unapproved unit cannot be logged, and the municipality summary is counts only. A module only: nothing on screen logs a session yet. |
| `src/lib/contact.js` | The one place for a contact channel. Since 28.9 `CONTACT` is the Google Form "משוב על האפליקציות", pre-filled with PeerEd. If emptied, the app links to the Hebrew issue form `.github/ISSUE_TEMPLATE/pilot.yml`. |

On screen: add participants (or load a sample), compute the match, see who is left out and why, download
the pairs as CSV (list numbers only, to line up with the coordinator's sheet), and a summary of pupils left
without a student by region and subject.

## What does not exist

No accounts, no sharing between devices (the list lives in one browser's localStorage), no session screen
(the `session.js` module is built in, nothing on screen logs a session), no accessibility audit, no Arabic
or Russian, regions are national rather than one municipality's neighbourhoods. Nothing here has been used
by a real coordinator.

The enrichment units (beyond the `unit.js` record), the teacher approval flow and the gateway for AI content
in `PURPOSE.md` are not offered; the text gate stays as a demonstration of the privacy rule.

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature a municipality's privacy officer will ask about first.
