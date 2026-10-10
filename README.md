# PeerEd (working name)

Wartime regional learning network: university students matched to school pupils by region, short text
"enrichment units", and a teacher gateway for everything AI-related.

Owner idea, 2026-09-07. Owner's decisions: high-school age, text only, the owner approves every unit, its
own repository and built to be extended. Rules: no cloud dependency for the MVP, no personal data of minors,
deterministic tests only. Local repository until the owner approves publishing.

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

`npm test` runs 56 tests. There is a working interface — `app.html`, one self-contained Hebrew
right-to-left file with three tabs (אנשים, שידוך, טקסט) over the modules below. It keeps its state in the
browser's `localStorage` only: no server, no cloud, no account.

| Module | What it does |
|---|---|
| `src/lib/regions.js` | The six region codes of the first municipality-scale deployment, and their validation. |
| `src/lib/retention.js` | The explicit retention limit in days for each data category (`profile`, `match`). Frozen, and no category is kept indefinitely. |
| `src/lib/profile.js` | The only record the system stores: role, region, availability slots, subjects. Any other key, including an empty one, is refused with `personal data is not accepted`. The result is frozen and its arrays are copies. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared availability slot, at least one shared subject. Candidates are ranked by shared slots, then shared subjects, then input order, and taken greedily; each participant is used at most once. No clock, no randomness, no network. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses, Israeli phone numbers, nine-digit id numbers, links and social handles, with the same error message as the profile gate. Ordinary Hebrew lesson text with numbers passes. |
| `src/lib/unit.js` | An enrichment unit, the short text-only lesson a teacher submits (MVP item 4). Title and body pass the free-text gate; any other key is refused like personal data. The id is a hash of title + subject + duration, computed in plain JavaScript so it is the same in Node and in the browser: resubmitting the same unit, or fixing a typo in its body, gives the same id. |

`PURPOSE.md` carries the research this is grounded in (35 sources) and the owner's decisions.

## What does not exist yet

No storage beyond the browser's `localStorage`, no teacher approval flow, no reports for a
municipality, no accessibility work, no Arabic or Russian. Nothing here has been used by a real school.

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature an examiner or a municipality will ask about first.
