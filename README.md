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
`node scripts/build-app.js` (`--check` fails if it is stale). `npm test` runs the suite, among it a contrast
audit of the screen: `scripts/contrast.js` reads every text-on-background pair out of the stylesheet
(variables resolved, translucent tints painted over their parent) and `test/contrast.test.js` fails the suite
if one drops under WCAG AA, 4.5:1 for text and 3:1 for the focus ring and the selected-tab line;
`node scripts/contrast.js` prints the table. Besides people (a pupil gets a parent-consent checkbox, and a
button on the roster flips it through the profile module) and matching it has a units screen where a teacher
submits an enrichment unit and the approver (a role, never a person) approves or rejects it with a reason,
and a sessions screen where a session is logged for a matched pair (slot, subject, approved unit, outcome;
never who) and a municipality sees counts only. The people screen ends with a wipe button for the device: a second click (or cancel) is asked for on the screen itself, then the one storage key is removed through `store.clear` - never overwritten with an empty document - and every screen is emptied, even when the browser refuses to remove the key; `test/wipe-device.test.js` watches the key through a fake localStorage.

| File | What it does |
|---|---|
| `src/lib/regions.js` | The six region codes and their validation. |
| `src/lib/retention.js` | How long each kind of record may be kept (profile 730 days, match 365); nothing is kept indefinitely. |
| `src/lib/audit-report.js` | A Hebrew privacy and retention statement for audits, generated from the active retention policy (what is collected, how long it is kept, how it is deleted). |
| `src/lib/cycle-manager.js` | The end-of-cycle sweep: `sweep()` splits stored rows into the ones the policy still allows and the ones to delete, by `retention.js`'s limit for the row's category as it stands today; `applyRetentionPolicy()` does the same for stored match and profile rows (the `maxAgeDays` stamped on a row must be a whole number of days, but the limit is the policy's, never the stamp's). The caller passes the date and writes the result back; nothing is mutated. A module only: no screen runs a sweep yet. |
| `src/lib/profile.js` | The only record the app keeps: role, region, availability slots (8:00-22:00), subjects, and for a pupil one boolean, `parentConsent`, false unless given. Any other key, even an empty one, is refused with `personal data is not accepted`, so consent can never carry a parent's name, a date or a document. Arrays come back with one spelling per hour (normalizeSlot turns SUN_08 into SUN_8, because the engine compares slots as strings and two spellings of one hour would never meet) and no repeats, so a slot ticked twice does not count as two free hours. `grantParentConsent` / `revokeParentConsent` return a new record through `makeProfile`, so the gate holds on that path too. |
| `src/lib/match.js` | Deterministic matching: a pupil with parent consent (`parentConsent === true`; a missing flag is a no), same region, at least one shared hour, at least one shared subject, each person at most once, and the largest possible number of pairs (a greedy pass by shared hours, then augmenting paths). The consent gate is the engine's, not the screen's: a pupil without it is not in the pool however well the rest fits, so no stored roster and no screen can pair a minor whose parent has not said yes, and the sessions screen, which takes its pairs from here, cannot log a session for one. `explainUnmatched()` gives the true reason for each person left out, a missing parent consent first (`NO_PARENT_CONSENT`: for a pupil, the pupil has none; for a student, no pupil in the region has it yet); `matchAcrossRegions()` is the emergency pass (issue #54): only the people left out, the region rule dropped because sessions are text only, a shared hour, a shared subject and parent consent still required, local pairs untouched; `makeMatchRecord()` stamps a pair with the day it was kept and its retention category, so a stored pair carries its own expiry; the screen does not store pairs yet. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses, Israeli phone numbers however they are split (050-123-45-67, (050) 1234567, 050.123.4567, +972 (50) ...), nine-digit id numbers (also 12345678-9 and 123-456-789), links with a scheme, with www or on a bare common domain (wa.me/..., t.me/..., instagram.com/...) and social handles, with the same error message as the profile gate. It reads the text the way a reader sees it: invisible characters are dropped and full-width, mathematical and Arabic-Indic digits and a full-width @ are read as the plain ones, while the stored text stays as written. Emptiness is read the same way: a box holding nothing but characters that take no space (a zero-width space, the RLM a WhatsApp paste leaves behind) is as empty as an empty box, so a unit title or a rejection reason that reads as blank is refused instead of stored as text nobody can see. Ordinary Hebrew lesson text with numbers passes. |
| `src/lib/unit.js` | An enrichment-unit record with a deterministic id (title and body pass the free-text gate). The units screen submits one. |
| `src/lib/approval.js` | The approval queue for units: pending, approved or rejected by the approver role only (no personal identity), deterministic and JSON-serializable. The units screen runs the flow. A stored entry with a key the flow never writes (a teacher name, a note) is refused as personal data, not dropped, and so is a key written beside the entries. |
| `src/lib/session.js` | The session log (MVP item 6): a row per session of a matched pair holding only what the pair shares (region, slot, subject, the approved unit id, the outcome); roster positions never reach it, an unapproved unit cannot be logged, and the municipality summary is counts only. The sessions screen logs it and shows the counts-only summary, and `reportCsv` exports that summary as CSV (measure, code, count; fixed order). Loading a stored log re-checks every row against the approval queue, and a key beside the rows (a coordinator, a school) is refused as personal data. |
| `src/lib/store.js` | Local-only storage (MVP item 7). The whole state (roster, approval queue, session log) is one JSON document under one key in the browser's localStorage, or an in-memory fallback when storage is blocked. Loading re-validates everything (`makeProfile`, `loadQueue`, `loadLog`), so a record edited in devtools cannot bring a name or a forged status in; a document that fails comes back as an empty state plus the reason. `test/offline.test.js` is a static check that no module and neither HTML file can reach the network. |
| `src/lib/tabnav.js` | Keyboard navigation of the tab bar, the WAI-ARIA tabs pattern: the bar is one tab stop, and `stepTab` says which tab an arrow key lands on. The screen is right-to-left, so ArrowLeft goes forward and ArrowRight back, both wrap, Home and End are the ends, and any other key is left to the browser. The shell only asks the module and moves focus. |
| `src/lib/contact.js` | The one place for a contact channel. Since 28.9 `CONTACT` is the Google Form "משוב על האפליקציות", pre-filled with PeerEd. If emptied, the app links to the Hebrew issue form `.github/ISSUE_TEMPLATE/pilot.yml`. |

On screen: add participants (or load a sample), compute the match, see who is left out and why, download
the pairs as CSV (list numbers only, to line up with the coordinator's sheet), a card of cross-region suggestions for pupils whose region has no free student (also in the CSV; the coordinator decides), and a summary of pupils left
without a student by region and subject.

## What does not exist

No accounts, no sharing between devices (the state lives in one browser's localStorage), no reports for a
municipality beyond the session counts on the sessions screen and their CSV export, no accessibility work
beyond keyboard navigation of the tab bar and the text contrast audit (no screen-reader pass; the card and
field borders sit near 1.4:1, under the 3:1 of WCAG 1.4.11, and the audit does not cover borders because
lightening them is a look still to be chosen), no Arabic or Russian, regions are national rather than one
municipality's neighbourhoods. Nothing here has been used by a real coordinator.

The gateway for AI content in `PURPOSE.md` is not offered; the text gate stays as a demonstration of the
privacy rule.

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature a municipality's privacy officer will ask about first.
