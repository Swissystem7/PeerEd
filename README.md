# PeerEd (working name)

Wartime regional learning network: university students matched to school pupils by region, short text
"enrichment units", and a teacher gateway for everything AI-related.

Owner idea, 2026-09-07. Owner's decisions: high-school age, text only, the owner approves every unit, its
own repository and built to be extended. Rules: no cloud dependency for the MVP, no personal data of minors,
deterministic tests only. The repository is on GitHub as `Swissystem7/PeerEd`.

## What works today

`npm test` runs 30 deterministic tests (`node:test`, no dependencies).

`app.html` is the interface: one file, no server, no network call, opens from a phone or any static
host. It is **generated** — `node scripts/build-app.js` inlines the modules below into
`src/app-shell.html`, and a test fails if `app.html` is stale, so run it after touching either.

| Module | What it does |
|---|---|
| `src/lib/regions.js` | The six region codes of the first municipality-scale deployment, and their validation. |
| `src/lib/profile.js` | The only record the system stores: role, region, availability slots, subjects. Any other key, including an empty one, is refused with `personal data is not accepted`. The result is frozen and its arrays are copies. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared availability slot, at least one shared subject. Candidates are ranked by shared slots, then shared subjects, then input order, and taken greedily; each participant is used at most once. No clock, no randomness, no network. |
| `src/lib/roster.js` | One number per person: the participants list numbers people by their place in it, and this module carries that number through the match, whose own indexes are positions among students / among pupils. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses, Israeli phone numbers, nine-digit id numbers, links and social handles, with the same error message as the profile gate. Ordinary Hebrew lesson text with numbers passes. |

`PURPOSE.md` carries the research this is grounded in (35 sources) and the owner's decisions.

## What does not exist yet

No server and no accounts: the participants list is kept in one browser's `localStorage` and goes with
that browser's data. No teacher approval flow, no enrichment-unit format, no reports for a municipality,
no accessibility work, no Arabic or Russian. Nothing about age or school is checked - the app holds role,
region, availability and subjects, and high school is the intended use, not an enforced rule. Nothing here
has been used by a real school; the app's own "מה לא עובד כאן" card lists the rest.

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature an examiner or a municipality will ask about first.
