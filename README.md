# PeerEd (working name)

Wartime regional learning network: university students matched to school pupils by region, short text
"enrichment units", and a teacher gateway for everything AI-related.

Owner idea, 2026-09-07. Owner's decisions: high-school age, text only, the owner approves every unit, its
own repository and built to be extended. Rules: no cloud dependency for the MVP, no personal data of minors,
deterministic tests only. Local repository until the owner approves publishing.

## What works today

`npm test` runs 112 tests. `app.html` is a one-file demo shell over the core: people, matching, the text gate, a units screen where a teacher submits an enrichment unit and the approver (a role, never a person) approves or rejects it with a reason, and a sessions screen where a session is logged for a matched pair (slot, subject, approved unit, outcome; never who) and a municipality sees counts only.

| Module | What it does |
|---|---|
| `src/lib/regions.js` | The six region codes of the first municipality-scale deployment, and their validation. |
| `src/lib/profile.js` | The only record the system stores: role, region, availability slots, subjects. Any other key, including an empty one, is refused with `personal data is not accepted`. The result is frozen and its arrays are copies. |
| `src/lib/match.js` | Deterministic matching: same region, at least one shared availability slot, at least one shared subject. Candidates are ranked by shared slots, then shared subjects, then input order, and taken greedily; each participant is used at most once. No clock, no randomness, no network. `explainUnmatched` says why each leftover participant has no pair, checking the same gates in the same order: nobody on the other side in the region, nobody with a shared hour, nobody with a shared subject, or compatible counterparts existed but were all paired with others (`TAKEN`, with their count). The match screen shows that sentence instead of one guess for every case, so the coordinator knows whether to recruit, ask for hours, or add a subject. |
| `src/lib/validator.js` | The gate for free text: refuses email addresses, Israeli phone numbers, nine-digit id numbers, links and social handles, with the same error message as the profile gate. Ordinary Hebrew lesson text with numbers passes. |
| `src/lib/unit.js` | An enrichment unit, the short text-only lesson a teacher submits (MVP item 4). Title and body pass the free-text gate; any other key is refused like personal data. The id is a hash of title + subject + duration, computed in plain JavaScript so it is the same in Node and in the browser: resubmitting the same unit, or fixing a typo in its body, gives the same id. |
| `src/lib/approval.js` | The approval flow (MVP item 5). A submitted unit is pending and invisible to pupils until the approver role decides; the queue records the role, never a person. A rejection needs a reason that passes the free-text gate. Resubmitting the same text changes nothing; a revised body goes back to pending with its revision number raised. The queue is a frozen JSON value and every operation returns a new one, so it can be stored locally; loading it re-runs every unit and reason through the gates. |
| `src/lib/session.js` | The session log (MVP item 6). A session is logged for a pair from matchPairs, but only what the pair shares is written: region, slot, subject, plus the id of the approved unit that was taught and the outcome (held, missed, cut short). The roster positions of the pair never reach the log, any other key is refused as personal data, and a unit that is not approved in the queue cannot be logged. The summary for a municipality is counts only, and `reportCsv` exports exactly that summary as CSV (measure, code, count; fixed order, sorted codes, same log same text) so it can be pasted into a spreadsheet; the sessions screen shows it in a read-only box and offers the clipboard, never a download. Loading a stored log re-checks every row against the approval queue. |
| `src/lib/store.js` | Local-only storage (MVP item 7). The whole state — roster, approval queue, session log — is one JSON document under one key in a Web Storage shaped backend (the browser's localStorage, or an in-memory fallback when storage is blocked). Loading re-validates everything: every person through `makeProfile`, the queue through `loadQueue`, the log through `loadLog`, so a record edited in devtools cannot bring a name or a forged status in. A document that fails comes back as an empty state plus the reason, never as half a roster. `test/offline.test.js` is a static check that no module and neither HTML file can reach the network. |
| `src/lib/tabnav.js` | Keyboard navigation of the tab bar, the WAI-ARIA tabs pattern: the bar is one tab stop, and `stepTab` says which tab an arrow key lands on. The screen is right-to-left, so ArrowLeft goes forward and ArrowRight back, both wrap, Home and End are the ends, and any other key is left to the browser. The shell only asks the module and moves focus. |

`PURPOSE.md` carries the research this is grounded in (35 sources) and the owner's decisions.

## What does not exist yet

No reports for a municipality beyond the session counts on the sessions screen and their CSV export, no accessibility work beyond keyboard navigation of the tab bar (no screen-reader pass, no contrast audit), no Arabic or Russian. Nothing here has been used by a real school.

## Why the profile is so narrow

The matching only needs region, availability and subject. Every additional field would be personal data
about a minor, so the code refuses it outright rather than trusting a future caller to be careful. That
refusal is the feature an examiner or a municipality will ask about first.
