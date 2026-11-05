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
button on the roster flips it through the profile module) and matching it has a privacy tab ("פרטיות") that
saves nothing: a box where any pasted text is run through the free-text gate and what it refuses is listed (two
buttons load a sample with personal data and one with offensive language), and a button that tries to save a
participant with a phone field and shows it refused for the field itself, though the value was empty; a units screen where a teacher
submits an enrichment unit and the approver (a role, never a person) approves or rejects it with a reason,
and a sessions screen where a session is logged for a matched pair (slot, subject, approved unit, outcome;
never who) and a municipality sees counts only. The people screen ends with a wipe button for the device: a second click (or cancel) is asked for on the screen itself, then the storage key and the `:rejected` copy of a refused document beside it are removed through `store.clear` - never overwritten with an empty document - and every screen is emptied, even when the browser refuses to remove the key; `test/wipe-device.test.js` watches the key through a fake localStorage.

| File | What it does |
|---|---|
| `src/lib/i18n.js` | UI strings table supporting Hebrew (default, RTL), Arabic (RTL), and Russian (LTR). Arabic and Russian translations marked as needing native-speaker review. |
| `src/lib/regions.js` | The six region codes and their validation. |
| `src/lib/retention.js` | How long each kind of record may be kept (profile 730 days, match 365); nothing is kept indefinitely. |
| `src/lib/audit-report.js` | A Hebrew privacy and retention statement for audits, generated from the active retention policy (what is collected, how long it is kept, how it is deleted). The deletion protocol says what the screen does: nothing is removed on its own when a window ends (a stored person carries no date and no screen runs the sweep), the coordinator deletes a person or wipes the device, pairs are not stored, and a downloaded pairs file is outside the wipe's reach. |
| `src/lib/cycle-manager.js` | The end-of-cycle sweep: `sweep()` splits stored rows into the ones the policy still allows and the ones to delete, by `retention.js`'s limit for the row's category as it stands today; `applyRetentionPolicy()` does the same for stored match and profile rows (the `maxAgeDays` stamped on a row must be a whole number of days, but the limit is the policy's, never the stamp's). The caller passes the date and writes the result back; nothing is mutated. A module only: no screen runs a sweep yet. |
| `src/lib/profile.js` | The only record the app keeps: role, region, availability slots (8:00-22:00), subjects, and for a pupil one boolean, `parentConsent`, false unless given. The module also accepts three lists no screen writes or shows (added for a parent's block and a report, #91 and #137): `blockedUsers` (opaque ids, `p-` and 8 hex digits), `reportEvent` (such an id and a detail of up to 300 characters) and `responseToReport` (a report's index and a detail of up to 300 characters); each detail passes the free-text gate. A stored person carrying them loads, keeps them through a consent flip and is removed with them by a delete or the wipe; the add form never sets them. Any other key, even an empty one, is refused with `personal data is not accepted`, so consent can never carry a parent's name, a date or a document. Arrays come back with one spelling per hour (normalizeSlot turns SUN_08 into SUN_8, because the engine compares slots as strings and two spellings of one hour would never meet) and no repeats, so a slot ticked twice does not count as two free hours. `grantParentConsent` / `revokeParentConsent` return a new record through `makeProfile`, so the gate holds on that path too. |
| `src/lib/match.js` | Deterministic matching: a pupil with parent consent (`parentConsent === true`; a missing flag is a no), same region, at least one shared hour, at least one shared subject, each person at most once, and the largest possible number of pairs (a greedy pass by shared hours, then augmenting paths). The consent gate is the engine's, not the screen's: a pupil without it is not in the pool however well the rest fits, so no stored roster and no screen can pair a minor whose parent has not said yes, and the sessions screen, which takes its pairs from here, cannot log a session for one. `explainUnmatched()` gives the true reason for each person left out, a missing parent consent first (`NO_PARENT_CONSENT`: for a pupil, the pupil has none; for a student, no pupil in the region has it yet); `matchAcrossRegions()` is the emergency pass (issue #54): only the people left out, the region rule dropped because sessions are text only, a shared hour, a shared subject and parent consent still required, local pairs untouched; `makeMatchRecord()` stamps a pair with the day it was kept and its retention category, so a stored pair carries its own expiry; the screen does not store pairs yet. |
| `src/lib/match2.js` | Multi-criteria matching (stage 1): weighted region/hours/subject/level/language/preference scores, a global optimum (pair count first, then total score; deterministic min-cost max-flow, never greedy), a Hebrew explanation with the score breakdown for every pair, forced locked pairs, student capacity (`maxPupils`) and partial re-matching that keeps unreleased pairs. A module only: no screen runs it yet. |
| `src/lib/capacity.js` | Capacity vs demand (stage 2): per student/subject/region supply places against consented-pupil demand, `DEMAND_GT_SUPPLY` alerts with the number of places (students) still needed, in Hebrew. A module only: no screen runs it yet. |
| `src/lib/schedule.js` | Multi-week weekly scheduling (stage 2): shared-slot sessions with duration and sessions-per-week, student/pupil double-booking and pupil weekly-cap conflicts, automatic waitlist, and up to 3 alternative slots per pair. A module only: no screen runs it yet. |
| `src/lib/semester.js` | Semester calendar (stage 3): a static Israeli school-holiday table (replaceable by the caller), Sun-Thu teaching days, expansion of weekly schedule sessions onto real dates with holiday skips, cancellations that do or do not need a makeup, and up to 3 makeup dates. A module only: no screen runs it yet. |
| `src/lib/attendance.js` | Attendance (stage 3): an immutable log of held/missed/postponed/cancelled per pair and date, summaries with a held rate, and a Hebrew alert for a pair that has not met for two weeks. A module only: no screen runs it yet. |
| `src/lib/reports.js` | Coordinator reports (stage 4): weekly/monthly/semester counts by status, subject and region with a held rate and stale-pair list, CSV export in the counts-only format, iCalendar export with internal UIDs, a deterministic SVG bar chart, and a printable Hebrew fragment for PDF-via-print. Internal indexes and codes only. A module only: no screen runs it yet. |
| `src/lib/import-availability.js` | Paste import of availability CSV (stage 5): the whole paste passes the free-text privacy gate before parsing, bad rows become per-line errors, and parent consent is never taken from a paste. A module only: no screen runs it yet. |
| `src/lib/wizard-link.js` | Anonymous availability wizard link (stage 5): a student's answers encoded in a URL fragment (base64url JSON plus an FNV-1a integrity check — integrity only, not encryption), with no name and no identifier, validated through `makeProfile` on decode. A module only: no screen runs it yet. |
| `src/lib/pwa.js` | Offline PWA pieces for the single file (stage 6): a standalone manifest with no external icons and a cache-only service-worker source for the one app file (a cache miss is answered locally, nothing is fetched). Strings only — the shell registers it. |
| `src/lib/backup.js` | Encrypted backup envelope (stage 6): PBKDF2-SHA256 parameters and AES-GCM ciphertext with the crypto primitives injected by the caller (WebCrypto in the browser), a strictly validated envelope, and one generic `cannot open backup` failure so a wrong passphrase and a tampered file look the same. A module only: no screen runs it yet. |
| `src/lib/lang-he.js` | Hebrew strings for the new coordinator screens (stage 7; separate dictionaries while PR #358 is unmerged). |
| `src/lib/lang-ar.js` | Arabic strings for the new coordinator screens (stage 7; marked as needing native-speaker review). |
| `src/lib/lang-ru.js` | Russian strings for the new coordinator screens (stage 7; marked as needing native-speaker review). |
| `src/lib/lang-extra.js` | Lookup with Hebrew fallback and bidirectional key-parity verification for the new-screen dictionaries (stage 7). A module only: no screen runs it yet. |
| `src/lib/flow.js` | The coordinator flow end to end (stage 8): import → consent → match → schedule → semester → attendance → report export as one pure composition that names its failing stage, plus the accessibility contract (keyboard, screen-reader, focus, 360px) every new screen must satisfy. Real-browser E2E belongs to the shell and is not claimed here. A module only: no screen runs it yet. |
| `src/lib/guide-he.js` | The Hebrew coordinator guide inside the app (stage 9): eight short sections from first steps to privacy, with a table of contents, full text for a help screen or print, and a search whose query passes the privacy gate. Examples are codes only; the guide itself passes the free-text gate. A module only: no screen runs it yet. |
| `src/lib/curriculum.js` | Lesson content for teaching children about artificial intelligence (stage 10): two tracks (elementary grades 3-6, playful and unplugged-first; middle school grades 7-9, hands-on tools and ethics), 12 lessons each with Hebrew title, goals, a 45-minute flow, an activity with an offline variant, materials and wrap-up questions, plus a `cur.*` i18n key per lesson title. `assignLessons` gives every scheduled session the next lesson of its group's track (a second cycle after 12), `todayLesson` is the mentor's lesson-of-the-day, an immutable delivery log backs the delivered checkbox, and `lessonProgress` / `progressToCsv` give the coordinator per-group progress. Content only, internal pair indexes only; the home screen shows the lesson of the day from it and the delivered checkbox writes its log (stage 11). |
| `src/lib/modes.js` | Routine / emergency modes (stage 11): simple availability chips (morning / noon / afternoon per day) mapped onto the slots `profile.js` accepts, group aggregates that hold counts only (routine: school + grade; emergency: gathering place + region + age band, chunked to 12 children, an exact-address or name field refused by the same personal-data gate), nearby-only student assignment with unmet groups kept visible, short 20-30 minute unplugged lessons in emergency, a mode switch that carries people and groups over untouched, and a per-school / per-location counts report with CSV. The home screen runs the mode toggle, the chips and the group panel. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses (also spelled out, dana at gmail dot com or dana [at] walla [dot] co.il), Israeli phone numbers however they are split (050-123-45-67, (050) 1234567, 050.123.4567, +972 (50) ...), nine-digit id numbers (also 12345678-9 and 123-456-789), links with a scheme, with www or on a bare common domain (wa.me/..., t.me/..., instagram.com/...) and social handles, with the same error message as the profile gate. It also refuses offensive language, with a message of its own: a fixed list of Hebrew and English words (Hebrew feminine and plural forms written out, not guessed by a suffix rule), found with up to two of ו ה ש ל ב כ מ glued in front, with a letter stretched (fuuuck, חרררא) or spelled one letter at a time (f.u.c.k, ז-ו-נ-ה, four letters or more, so a three-letter Hebrew root written ש.מ.ר stays a grammar lesson), while a word that only looks like one is let through (מזונות, אחראי); a text with both is refused for the personal data. The privacy tab ("פרטיות") runs this gate on whatever is pasted into it and stores nothing. It reads the text the way a reader sees it: invisible characters and niqqud are dropped and full-width, mathematical and Arabic-Indic digits and a full-width @ are read as the plain ones, while the stored text stays as written. Emptiness is read the same way: a box holding nothing but characters that take no space (a zero-width space, the RLM a WhatsApp paste leaves behind) is as empty as an empty box, so a unit title or a rejection reason that reads as blank is refused instead of stored as text nobody can see. Ordinary Hebrew lesson text with numbers passes. |
| `src/lib/unit.js` | An enrichment-unit record with a deterministic id (title and body pass the free-text gate). The units screen submits one. |
| `src/lib/approval.js` | The approval queue for units: pending, approved or rejected by the approver role only (no personal identity), deterministic and JSON-serializable. A unit sent again with the same body is a repeat and changes nothing; sent with another body it is the next revision and goes back to pending whatever was decided before, an approved unit included, so it leaves the pupils' list until it is approved again. The units screen runs the flow. A stored entry with a key the flow never writes (a teacher name, a note) is refused as personal data, not dropped, and so is a key written beside the entries or inside the unit itself. |
| `src/lib/session.js` | The session log (MVP item 6): a row per session of a matched pair holding only what the pair shares (region, slot, subject, the id of the unit, approved when the row is written, the outcome); roster positions never reach it, an unapproved unit cannot be logged, and the municipality summary is counts only. The sessions screen logs it and shows the counts-only summary, and `reportCsv` exports that summary as CSV (measure, code, count; fixed order). Loading a stored log re-checks every row against the approval queue: a row on a unit that is approved today is kept, and so is a row on a unit that is pending or rejected today but has had a revision (a unit revised after it was taught: the lesson took place, and refusing the row would throw away the whole saved state), and the summary and the CSV still count it under that unit id; a row on a unit pending or rejected on its first text, which was never approved, is refused. A key beside the rows (a coordinator, a school) is refused as personal data. |
| `src/lib/store.js` | Local-only storage (MVP item 7). The whole state (roster, approval queue, session log) is one JSON document under one key in the browser's localStorage, or an in-memory fallback when storage is blocked. Loading re-validates everything (`makeProfile`, `loadQueue`, `loadLog`), so a record edited in devtools cannot bring a name or a forged status in; a document that fails comes back as an empty state plus the reason, and before anything can write over it, it is copied as is under a second key, the first one plus `:rejected` (`peered_app_v1:rejected`), so the first save of the empty state does not erase the refused roster, queue and log. No screen reads that copy back; it stays until the wipe, and `clear()` removes both keys. A document refused on a later visit is copied to the next free slot (`peered_app_v1:rejected:2`, `:3`, ...), never over an earlier copy, and `clear()` removes those too. `test/offline.test.js` is a static check that no module and neither HTML file can reach the network. |
| `src/lib/tabnav.js` | Keyboard navigation of the tab bar, the WAI-ARIA tabs pattern: the bar is one tab stop, and `stepTab` says which tab an arrow key lands on. The screen is right-to-left, so ArrowLeft goes forward and ArrowRight back, both wrap, Home and End are the ends, and any other key is left to the browser. The shell only asks the module and moves focus. |
| `src/lib/contact.js` | The one place for a contact channel. Since 28.9 `CONTACT` is the Google Form "משוב על האפליקציות", pre-filled with PeerEd. If emptied, the app links to the Hebrew issue form `.github/ISSUE_TEMPLATE/pilot.yml`; the repo is private, so only people given access to it can open that form, and the note under the link says so. |

On screen: add participants (or load a sample), compute the match, see who is left out and why, download
the pairs as CSV (people by list number, never by name, to line up with the coordinator's sheet: each pair with its
region, shared subjects and shared hours, then a "לא שובצו" section with the role, list number, region, subjects and
reason of everyone left out - for a pupil without parent consent that reason says so - and the cross-region
suggestions; hours a pair does not share are not in it, and nothing loads it back), a card of cross-region suggestions for pupils whose region has no free student (also in the CSV; the coordinator decides), and the "סיכום לרשות" card: counts
only (pairs, pupils without a student, students without a pupil, pupils waiting for a parent's consent counted
apart, and the students missing by region and subject), on the screen with no file to download.

## What does not exist

No accounts, no sharing between devices (the state lives in one browser's localStorage), no reports for a
municipality beyond two on-screen count cards, both titled "סיכום לרשות" (the match screen's and the sessions screen's, each with its CSV count export), no screen-reader pass: the
accessibility work is markup and focus checked by the `test/a11y-*` and `test/app-a11y.test.js` files
against a fake DOM (the tab bar's keyboard navigation and tab panels, every status line a `role="status"`,
the lists `aria-live` regions, the hour and subject buttons and the consent button `aria-pressed`, hints tied
by `aria-describedby`, a refused form moving focus to the field at fault, a delete or a decision moving it to
the next button, a visible focus ring, the text contrast audit), never heard through NVDA, VoiceOver or
TalkBack; the card and field borders reach at least 3:1 under WCAG 1.4.11 (3.4:1 and 3.1:1) and are covered by the automated contrast audit; no Arabic or Russian, regions are national rather than one
municipality's neighbourhoods. Nothing here has been used by a real coordinator.

No AI: nothing generates or rewrites a unit, and `PURPOSE.md` says PeerEd is not an AI content tool. The
text gate is not a demonstration: every unit title and body a teacher sends and every rejection reason the
approver writes passes it before it is stored, a stored queue is gated again on load, and the privacy tab is
only the place to try it on any text.

## Why the profile is so narrow

The matching only needs role, region, availability and subject, and for a pupil the parent-consent yes or
no. Besides those, `makeProfile` accepts only the three lists no screen writes (`blockedUsers`, `reportEvent`,
`responseToReport`: opaque `p-` ids and short details that pass the free-text gate) and writes its own
retention stamp (`retention`, holding only `dataCategory` and `maxAgeDays`). Every other field would be personal data about a minor, so
the code refuses it outright rather than trusting a future caller to be careful. That refusal is the feature
a municipality's privacy officer will ask about first.
