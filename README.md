# PeerEd (working name)

A free matching tool for tutoring coordinators: university students are paired with high-school pupils by
region, free hours and subject, with no name, phone, email or id ever entered. The coordinator keeps the
names in their own sheet and uses PeerEd for the part that is slow by hand: who can meet whom, when.

Owner idea, 2026-09-07: high-school age, its own repository. Rules: no cloud
dependency, no personal data of minors, deterministic tests only. Private repository until the owner
approves publishing.

## Quickstart

Node 18 or newer (verified on v18.19.1; CI uses `lts/*`). There are **no dependencies and no install
step** — the repository has no lockfile, so `npm install` is unnecessary and `npm ci` fails by design.
Go straight to the commands:

```sh
npm test                      # the whole suite: 56 tests at the time of writing
node --test test/unit.test.js # one file (Node's built-in runner; no other test framework)
npm run build                 # regenerate app.html from src/app-shell.html + src/lib/*.js
npm run build:check           # exit 1 if app.html is stale — the second CI gate
```

To run the app, open `app.html` in a browser. It is a single self-contained file with no external
requests, so opening it straight from disk (`file://`) works; no server and no build are needed, because
the committed `app.html` is already built. After any change under `src/lib/` or to `src/app-shell.html`,
run `npm run build` and commit the regenerated `app.html`.

## What works today

<<<<<<< HEAD
`npm test` runs 56 tests. There is a working interface — `app.html`, one self-contained Hebrew
right-to-left file with three tabs (אנשים, שידוך, טקסט) over the modules below. It keeps its state in the
browser's `localStorage` only: no server, no cloud, no account.
=======
`app.html` is the whole app: one file, no server, no network call, built from the tested modules by
`node scripts/build-app.js` (`--check` fails if it is stale). `npm test` runs the suite.
>>>>>>> origin/master

| File | What it does |
|---|---|
<<<<<<< HEAD
| `src/lib/regions.js` | The six region codes of the first municipality-scale deployment, and their validation. |
| `src/lib/retention.js` | The explicit retention limit in days for each data category (`profile`, `match`). Frozen, and no category is kept indefinitely. |
| `src/lib/profile.js` | The only record the system stores: role, region, availability slots, subjects. Any other key, including an empty one, is refused with `personal data is not accepted`. The result is frozen and its arrays are copies. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared availability slot, at least one shared subject. Candidates are ranked by shared slots, then shared subjects, then input order, and taken greedily; each participant is used at most once. No clock, no randomness, no network. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses, Israeli phone numbers, nine-digit id numbers, links and social handles, with the same error message as the profile gate. Ordinary Hebrew lesson text with numbers passes. |
| `src/lib/unit.js` | An enrichment unit, the short text-only lesson a teacher submits (MVP item 4). Title and body pass the free-text gate; any other key is refused like personal data. The id is a hash of title + subject + duration, computed in plain JavaScript so it is the same in Node and in the browser: resubmitting the same unit, or fixing a typo in its body, gives the same id. |
=======
| `src/lib/regions.js` | The six region codes and their validation. |
| `src/lib/retention.js` | How long each kind of record may be kept (profile 365 days, match 180); nothing is kept indefinitely. |
| `src/lib/audit-report.js` | A Hebrew privacy and retention statement for audits, generated from the active retention policy (what is collected, how long it is kept, how it is deleted). |
| `src/lib/profile.js` | The only record the app keeps: role, region, availability slots (8:00-22:00), subjects. Any other key, even an empty one, is refused with `personal data is not accepted`. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared hour, at least one shared subject, each person at most once, and the largest possible number of pairs (a greedy pass by shared hours, then augmenting paths). `explainUnmatched()` gives the true reason for each person left out. |
| `src/lib/validator.js` | The free-text gate (email, Israeli phone, nine-digit id, links, handles). On screen it is a demo: the app stores no free text. |
| `src/lib/unit.js` | An enrichment-unit record with a deterministic id (title and body pass the free-text gate). A module only: nothing on screen offers or stores units. |
| `src/lib/approval.js` | The approval queue for units: pending, approved or rejected by the approver role only (no personal identity), deterministic and JSON-serializable. A module only: nothing on screen runs the flow yet. |
| `src/lib/contact.js` | The one place for a contact channel. Since 28.9 `CONTACT` is the Google Form "משוב על האפליקציות", pre-filled with PeerEd. If emptied, the app links to the Hebrew issue form `.github/ISSUE_TEMPLATE/pilot.yml`. |
>>>>>>> origin/master

On screen: add participants (or load a sample), compute the match, see who is left out and why, download
the pairs as CSV (list numbers only, to line up with the coordinator's sheet), and a summary of pupils left
without a student by region and subject.

## What does not exist

<<<<<<< HEAD
No storage beyond the browser's `localStorage`, no teacher approval flow, no reports for a
municipality, no accessibility work, no Arabic or Russian. Nothing here has been used by a real school.
=======
No accounts, no sharing between devices (the list lives in one browser's localStorage), no session log,
no accessibility audit, no Arabic or Russian, regions are national rather than one municipality's
neighbourhoods. Nothing here has been used by a real coordinator.

The enrichment units (beyond the `unit.js` record), the teacher approval flow and the gateway for AI content
in `PURPOSE.md` are not offered; the text gate stays as a demonstration of the privacy rule.
>>>>>>> origin/master

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature a municipality's privacy officer will ask about first.
