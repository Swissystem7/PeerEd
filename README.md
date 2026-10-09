# PeerEd (working name)

Wartime regional learning network: university students matched to school pupils by region, short text
"enrichment units", and a teacher gateway for everything AI-related.

Owner idea, 2026-09-07. Owner's decisions: high-school age, text only, the owner approves every unit, its
own repository and built to be extended. Rules: no cloud dependency for the MVP, no personal data of minors,
deterministic tests only. Local repository until the owner approves publishing.

## Quickstart

Needs Node.js 18 or newer (the suite uses the built-in `node:test` runner). There are no dependencies, so
there is nothing to install.

```sh
npm test                           # the whole suite (node --test), 56 tests today
node scripts/build-app.js          # rebuild app.html after a change under src/lib/ or src/app-shell.html
node scripts/build-app.js --check  # exit 1 if app.html is stale (test/app-build.test.js checks the same)
```

To try the interface, open `app.html` in a browser straight from the file system. It is one file with every
module inlined, no server needed.

## What works today

`app.html` is a single-page Hebrew interface with three tabs: people (add a participant), match, and a
free-text check that shows the gate refusing personal data. Participants are kept in the browser's
`localStorage` only. Underneath it is the tested core:

| Module | What it does |
|---|---|
| `src/lib/regions.js` | The six region codes of the first municipality-scale deployment, and their validation. |
| `src/lib/retention.js` | The retention limit per data category in days (profile 365, match 180). No category is kept indefinitely. |
| `src/lib/profile.js` | The only record the system stores: role, region, availability slots, subjects. Any other key, including an empty one, is refused with `personal data is not accepted`. The result is frozen and its arrays are copies. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared availability slot, at least one shared subject. Candidates are ranked by shared slots, then shared subjects, then input order, and taken greedily; each participant is used at most once. No clock, no randomness, no network. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses, Israeli phone numbers, nine-digit id numbers, links and social handles, with the same error message as the profile gate. Ordinary Hebrew lesson text with numbers passes. |
| `src/lib/unit.js` | An enrichment unit, the short text-only lesson a teacher submits (MVP item 4). Title and body pass the free-text gate; any other key is refused like personal data. The id is a hash of title + subject + duration, computed in plain JavaScript so it is the same in Node and in the browser: resubmitting the same unit, or fixing a typo in its body, gives the same id. |

`PURPOSE.md` carries the research this is grounded in (35 sources) and the owner's decisions.

## What does not exist yet

No server or shared storage (everything stays in one browser), no teacher approval flow, no reports for a
municipality, no accessibility work, no Arabic or Russian. Nothing here has been used by a real school.

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature an examiner or a municipality will ask about first.
