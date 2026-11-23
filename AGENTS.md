# Agent notes

## Modern web guidance

For HTML, CSS, and client-side JavaScript, follow `.agents/skills/modern-web-guidance/SKILL.md` before implementing or updating UI, layout, or browser behavior. Run it with `npx -y modern-web-guidance@latest`. The CLI needs no API keys and runs offline (if the registry is unreachable and the package is already cached, retry with `npx --offline`). Skip it for backend, infrastructure, and tooling-only changes.

## Commands

Install, lint, build, and test commands below are taken from `package.json` and the repo tree. If a step is listed as **none defined**, skip it and do not invent a command.

| Step | Command | Notes |
|---|---|---|
| Install | none defined | There are no `dependencies`, no `devDependencies`, and **no lockfile**. `npm install` is not a required step; `npm ci` fails by design. Node 18 or newer is required (`node:test`). Optional local tools are invoked via `npx` in other scripts (knip, size-limit, Playwright). |
| Lint | none defined | There is no lint script and no `biome.json` or `@biomejs/biome`. Related existing checks (not a lint runner): `npm run check:html`, `npm run check:a11y-static`, `npm run check:i18n`, `npm run check:deadcode`, `npm run check:size`, `npm run doctor`. |
| Build | `npm run build` | Runs `node scripts/build-app.js` and regenerates `app.html` from `src/app-shell.html` + `src/lib/*.js`. After source changes, commit the regenerated `app.html`. Related: `npm run build:check` (fails if `app.html` is stale), `npm run check:build` (rebuild, then fail if `git diff` shows `app.html` changed). |
| Test | `npm test` | Runs `node --test` (the whole suite). Other existing scripts: `npm run test:e2e` (Chromium checks in `e2e/`; needs Playwright installed locally, otherwise skipped per README). |

Before opening a PR, run every lint, build, and test command that exists in the table above.

## Folder structure

- `app.html` — generated single-page app at the repo root (do not hand-edit as the source of truth; rebuild from `src/`).
- `src/app-shell.html` — app shell source.
- `src/lib/` — application modules assembled into `app.html`.
- `test/` — Node test suite; `test-support/`; `e2e/`.
- `scripts/` — `build-app.js` and check scripts.
- `docs/`, `.agents/skills/modern-web-guidance/`, `PURPOSE.md`, `README.md`, this file.

## Style

No Biome (or other) formatter/linter config is in the repository. Match the surrounding file. The source of truth for the bundled app is `src/`; keep `app.html` in sync with `npm run build`.

## Rules

- **UI design** comes only from Claude Design and is implemented as-is, without changes.
- **Before opening a PR**, run lint, build, and test locally (skip any step listed as none defined; do not invent commands).
- **Never** touch `.github/workflows` or any merge mechanism, auto-merge, or merge scripts. **Never** push to `master` or `main`. Do not merge pull requests and do not enable auto-merge.
