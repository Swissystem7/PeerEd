# PeerEd (working name)

Wartime regional learning network: university students matched to school pupils by region, short text
"enrichment units", and a teacher gateway for everything AI-related.

Owner idea, 2026-09-07. Owner's decisions: high-school age, text only, the owner approves every unit, its
own repository and built to be extended. Rules: no cloud dependency for the MVP, no personal data of minors,
deterministic tests only. Local repository until the owner approves publishing.

## What works today

`npm test` runs 61 tests. There is **no user interface yet** — this is the core.

| Module | What it does |
|---|---|
| `src/lib/regions.js` | The six region codes of the first municipality-scale deployment, and their validation. |
| `src/lib/profile.js` | The only record the system stores: role, region, availability slots, subjects. Any other key, including an empty one, is refused with `personal data is not accepted`. The result is frozen and its arrays are copies. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared availability slot, at least one shared subject. Candidates are ranked by shared slots, then shared subjects, then input order, and taken greedily; each participant is used at most once. No clock, no randomness, no network. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses, Israeli phone numbers, nine-digit id numbers, links and social handles, with the same error message as the profile gate. Ordinary Hebrew lesson text with numbers passes. |
| `src/lib/unit.js` | An enrichment unit, the short text-only lesson a teacher submits (MVP item 4). Title and body pass the free-text gate; any other key is refused like personal data. The id is a hash of title + subject + duration, computed in plain JavaScript so it is the same in Node and in the browser: resubmitting the same unit, or fixing a typo in its body, gives the same id. |
| `src/lib/approval.js` | The approval flow (MVP item 5). A submitted unit is pending and invisible to pupils until the approver role decides; the queue records the role, never a person. A rejection needs a reason that passes the free-text gate. Resubmitting the same text changes nothing; a revised body goes back to pending with its revision number raised. The queue is a frozen JSON value and every operation returns a new one, so it can be stored locally; loading it re-runs every unit and reason through the gates. |

`PURPOSE.md` carries the research this is grounded in (35 sources) and the owner's decisions.

## What does not exist yet

No interface, no storage, no reports for a
municipality, no accessibility work, no Arabic or Russian. Nothing here has been used by a real school.

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature an examiner or a municipality will ask about first.
