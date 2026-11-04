# Cursed Code Review

**Every bug is a monster.** Open your code in the crypt and bugs crawl out onto the exact lines where they hide. Apply the fix to banish them, and watch the room fill with light.

Built for **Kiroween 2026 · Costume Contest**.

> **Status:** everything is real. The static checks run in the browser, and pull requests are fetched live from GitHub. **Public** PRs work with no setup at all. Signing in, **private** repositories and posting reviews back to GitHub need the GitHub App described below.

## Try it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000 and pick **Try a cursed sample**, or go straight to http://localhost:3000/crypt?sample=cursed-login.

## What you can do

| Screen | Features |
| --- | --- |
| **Home** `/` | Three doors: cursed samples (one click), paste code (validation, language auto-detect, Ctrl+Enter), GitHub PR link (fetched live from GitHub; sign-in and install prompts for private repos). Summoning progress overlay. Resume banner for an unfinished hunt. |
| **The Crypt** `/crypt` | Syntax-highlighted code with monsters on their lines, sized by severity. Cursor-following lantern, Lights on/off. Detail panel with "What is wrong" / "Explain it simply", the fix as a diff, Banish (burn-away animation, applies the fix) and Ignore. Graveyard with restore, undo everywhere, "summon them again", multi-file navigation, PR changed-line gutter. Keyboard spells (`?`). |
| **Report** `/report` | Verdict, room light, trapped monsters, stats, worst severity, findings table, patch of every applied fix, Markdown export/copy, post to GitHub PR (Comment / Request changes / Approve). |
| **Bestiary** `/bestiary` | The seven monsters, their bug type, behaviour and an example fix. |

### The bestiary

| Monster | Bug | Default severity |
| --- | --- | --- |
| Void Wraith | Null / undefined access | MED |
| Leech | Memory leak (module-level cache that only grows) | MED |
| Possessor | SQL injection, XSS | HIGH |
| Imp | Off-by-one | LOW |
| Twin Ghosts | Race condition (read, then write after await) | HIGH |
| Zombie | Dead code after return/throw/break | LOW |
| Gremlin | Hardcoded secret | HIGH |

Languages: JavaScript, TypeScript, Python, PHP (not every rule applies to every language).

## Connect real GitHub (GitHub App)

Every user signs in with their own GitHub account and picks which repositories the app may read. Tokens stay on the server in an encrypted, HTTP-only cookie; code is scanned and never stored.

### 1. One-click setup (recommended)

1. Open **`/setup`** on your deployment, e.g. `https://cursed-code-review.vercel.app/setup`.
2. Click **Create the GitHub App**. GitHub opens with every setting filled in (callback URL, permissions, install-time sign-in); click **Create GitHub App** there.
3. GitHub sends you back to `/setup/complete` with the three keys in one block. Click **Copy all**.
4. In Vercel → Project → **Settings → Environment Variables**, click the first **Key** box and paste. Vercel splits the block into three variables. Click **Save**.
5. **Deployments → ⋯ → Redeploy**. Then `/setup` says **GitHub is connected**.

The keys are shown once and never stored by the site.

### 2. Or set it up by hand

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**:

| Field | Value |
| --- | --- |
| GitHub App name | `Cursed Code Review` (must be unique) |
| Homepage URL | `https://cursed-code-review.vercel.app` |
| Callback URL | `https://cursed-code-review.vercel.app/api/auth/callback/github` |
| Expire user authorization tokens | ✅ checked |
| Request user authorization (OAuth) during installation | ✅ checked |
| Webhook → Active | unchecked |
| Repository permissions | **Contents:** Read-only · **Pull requests:** Read and write |
| Where can this GitHub App be installed? | **Any account** |

Then add these in Vercel → **Settings → Environment Variables** (and `.env.local` for local dev, see `.env.example`):

| Name | Where to find it |
| --- | --- |
| `GITHUB_APP_CLIENT_ID` | App's **General** page → "Client ID" (starts with `Iv`) |
| `GITHUB_APP_CLIENT_SECRET` | Same page → **Generate a new client secret** (shown once) |
| `GITHUB_APP_SLUG` | The last part of the address bar on the app's settings page: `github.com/settings/apps/<slug>` |
| `SESSION_SECRET` | Optional. 32+ random characters; derived from the client secret if omitted |

Redeploy. `GET /api/auth/session` answers `"mode":"live"`; while something is missing it answers `"mode":"off"` with the names of the missing variables.

### 3. What users see

1. **Sign in with GitHub** → GitHub's own consent screen → back on the page they started from.
2. They paste a PR link. If the app isn't installed on that repository yet, the crypt offers **Install on this repository**, where they pick repositories.
3. Monsters appear only on the lines the PR added or changed.
4. **Post review to GitHub PR** posts inline comments with one-click `suggestion` fixes, as that user. Comments on lines outside the diff are listed in the review summary instead.

### Server routes

| Route | Purpose |
| --- | --- |
| `GET /api/auth/github/login?returnTo=/path` | Starts sign-in (`&install=1` opens the install screen) |
| `GET /api/auth/callback/github` | GitHub redirects here; checks `state`, exchanges the code, sets the session |
| `GET /api/auth/session` | `{ mode, user }`, never tokens |
| `POST /api/auth/logout` | Clears the session |
| `GET /api/github/pr?url=…` | PR metadata, changed files at the head commit, added lines. Signed out: public repos only |
| `POST /api/github/review` | Creates the review on the head commit |

Tokens refresh automatically before they expire (GitHub App user tokens last 8 hours).

### Without the GitHub App

Public pull requests still open: the server reads them anonymously from GitHub (file contents come from `raw.githubusercontent.com`, which doesn't count against GitHub's API limit). The "Sign in with GitHub" button is hidden, and posting a review explains that it isn't available yet. To raise the anonymous API limit (60 requests per hour per server IP), you can optionally set `GITHUB_TOKEN` to a fine-grained personal access token with **public repositories, read-only** access.

## Keyboard spells (in the crypt)

`J`/`N` next · `K`/`P` previous · `B` banish · `I` ignore · `E` explain simply · `L` lights · `U` or `Ctrl+Z` undo · `[` `]` switch file · `?` help

## Tests

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

- **Vitest** (111 tests): every scanner rule, the fix engine (apply / relocate / stale), reducer, selectors, PR URL parsing, mock API, diff, Markdown export, highlighter, component tests for the crypt, home doors and report, and server tests for the GitHub routes (sign-in state check, encrypted session, token refresh, PR loading, review placement) against a fake GitHub API.
- **Playwright** on desktop and Pixel 7: full hunt → report → export, keyboard + undo, PR → sign in → post review (GitHub responses mocked in the browser), no fake sign-in without the app, paste flow, and a no-horizontal-scroll check on every page.

Also: `npm run lint`, `npm run typecheck`.

## How it is built

- Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4.
- `src/lib/scanner/` — one pure module per monster. Each rule returns a finding with explanations and a line-range fix.
- `src/lib/review/` — the fix engine. Fixes are located by content, so when one fix inserts or removes lines every other monster moves with its code; monsters whose code vanished are marked stale.
- `src/providers/ReviewProvider.tsx` — reducer-based store persisted to localStorage, with undo.
- Accessibility: real buttons and links, 44px targets, focus-visible outlines, labelled icons, live regions, focus-trapped dialogs, `prefers-reduced-motion`.

## How Kiro was used

The `.kiro/` folder is part of the submission:

- **Specs** — `.kiro/specs/haunted-review-frontend/` (requirements in EARS form, design, tasks).
- **Steering** — product, tech and structure rules (e.g. "code font ligatures off so `<=` stays visible").
- **Hooks** — rerun scanner tests when a rule changes; accessibility pass when a component is saved.

## Roadmap

Webhooks so the app reviews new PRs automatically, an LLM for richer explanations, and the demo video.

## License

[MIT](./LICENSE)
