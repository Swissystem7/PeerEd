# PeerEd architecture

PeerEd is a single-file web app for tutoring coordinators. It pairs university students with
high-school pupils by region, free hours and subject, and it never stores a name, phone, email or id.
There is no server, no network call and no dependency. Why it exists and who it is for: `PURPOSE.md`.
What works today and how to run it: `README.md`.

## Layout

| Path | What it is |
| --- | --- |
| `src/app-shell.html` | The page: markup, styles and the UI wiring. It has a `<!--MODULES-->` marker where the modules go. |
| `src/lib/*.js` | The logic, as plain CommonJS modules. They are deterministic: no clock, no randomness, no network. The tests `require` these same files. |
| `scripts/build-app.js` | Inlines the modules into the shell and writes `app.html`. `--check` exits 1 if `app.html` is stale. |
| `app.html` | The built app, committed. You open it straight from disk (`file://`). **Generated: don't edit it by hand.** |
| `scripts/contrast.js` | A WCAG contrast audit of the shell's colours. It is a dev tool and is not inlined. |
| `test/*.test.js` | The suite, run by Node's built-in runner (`node --test`). |
| `test-support/fake-dom.js` | A tiny fake DOM that runs the real `app.html`, so tests can press buttons and read the screen. It lives outside `test/` so the runner doesn't count it as a test file. |
| `docs/launch/` | Pilot kit, pitch and outreach texts. Tests check that their claims match the code. |

## Modules, in build order

A module may only `require` modules listed before it. `ORDER` in `scripts/build-app.js` is the source of
truth.

| Module | Role |
| --- | --- |
| `i18n` | UI strings: Hebrew (default, RTL), Arabic and Russian. |
| `regions` | The allowed region codes. |
| `retention` | Fixed retention limits, in days, for each data category. |
| `audit-report` | The Hebrew privacy and retention statement for audits. |
| `cycle-manager` | The end-of-cycle sweep that drops rows past their retention window. |
| `profile` | The only record shape that is stored. Any key outside the accepted fields is rejected. |
| `match` | Deterministic matching: the same input always gives the same pairs. |
| `validator` | The free-text gate. It refuses personal data and offensive language. |
| `unit` | Enrichment units (short text lessons). The id is a hash of the content. |
| `approval` | The approval queue. Nothing reaches a pupil before the approver role decides. |
| `session` | The session log for a pair. It keeps only what the pair shares. |
| `store` | Local-only storage: the whole state is one JSON document under one `localStorage` key. |
| `tabnav` | Keyboard navigation for the tab bar (the WAI-ARIA tabs pattern). |
| `contact` | The one contact channel. |

## Data flow

1. The coordinator enters profiles: role, region, free hours and subjects, nothing more. `profile`
   rejects anything else.
2. `match` pairs students with pupils who share a region, an hour and a subject. It also reports why
   anyone is left unmatched.
3. Teachers submit units. `validator` screens the text, `unit` gives it an id, and `approval` holds it
   until it is approved or rejected.
4. `session` logs held, missed or cut-short sessions for a pair against an approved unit.
5. `store` saves the state to the browser on this device. `cycle-manager` and `retention` drop old rows.
   The wipe controls clear the device.

## Build and test

```sh
npm test              # whole suite
npm run build         # regenerate app.html after editing src/
npm run build:check   # CI gate: fails if app.html is stale
```

CI (`.github/workflows/test.yml`) runs `npm test` and the build check on Ubuntu. The build normalizes
every input to LF, so a Windows checkout with `core.autocrlf=true` builds the same `app.html`. Tests
that read text files must also accept CRLF.
