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
| **Home** `/` | Three doors: cursed samples (one click), paste code (validation, language auto-detect, Ctrl+Enter), and **Bring your code from GitHub**: sign in, pick one of your repositories (searchable; **Import a repository** grants access to more), then scan the whole repo or one of its open pull requests. Without the GitHub App, a link box takes any public GitHub link instead. Summoning progress overlay. Resume banner for an unfinished hunt. |
| **Haunted Map** `/map` | Overview of a multi-file scan: monsters by type and severity, files ordered most-haunted-first or by folder, "Enter the crypt" on the worst file, and folder suggestions when a repository is bigger than one scan. |
| **The Crypt** `/crypt` | **Banish all** applies every remaining fix in a file or the whole scan after a preview (Twin Ghosts left for review unless you include them), undone in one step. Syntax-highlighted code with monsters on their lines, sized by severity. Cursor-following lantern, Lights on/off. Optional sound (see below). Detail panel with "What is wrong" / "Explain it simply", the fix as a diff, Banish (burn-away animation, applies the fix) and Ignore. Graveyard with restore, undo everywhere, "summon them again", multi-file navigation, PR changed-line gutter. Keyboard spells (`?`). |
| **Report** `/report` | Verdict, room light, trapped monsters, stats, worst severity, findings table, patch of every applied fix, Markdown export/copy. Send it back to GitHub: **Open a fix PR** (new branch, one commit per fixed file, a PR listing every fix) for file, folder, repository and comparison scans; **Push fixes to this PR** for pull requests; post a review (Comment / Request changes / Approve; Comment only on your own PR); or **Create GitHub issue**. |
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
| Repository permissions | **Contents:** Read and write · **Pull requests:** Read and write · **Issues:** Read and write |
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
| `GET /api/github/scan?url=…` | Any GitHub link: PR, file, folder, repository, commit or comparison |
| `GET /api/github/repos` | Repositories the signed-in user gave the app access to, newest push first |
| `GET /api/github/pulls?owner=&repo=` | A repository's open pull requests, most recently updated first |
| `POST /api/github/issue` | Creates an issue listing the monsters (needs Issues: write) |
| `POST /api/github/fixes` | Commits the banished fixes, one commit per file, to a new branch + PR or to an open PR's branch (needs Contents: write). Files that changed on GitHub since the scan are skipped, never overwritten; Windows line endings are kept |

Tokens refresh automatically before they expire (GitHub App user tokens last 8 hours).

### Without the GitHub App

Public pull requests still open: the server reads them anonymously from GitHub (file contents come from `raw.githubusercontent.com`, which doesn't count against GitHub's API limit). The "Sign in with GitHub" button is hidden, and posting a review explains that it isn't available yet. To raise the anonymous API limit (60 requests per hour per server IP), you can optionally set `GITHUB_TOKEN` to a fine-grained personal access token with **public repositories, read-only** access.

## GitHub links you can bring

| Link | What's scanned |
| --- | --- |
| `github.com/owner/repo/pull/12` (or `owner/repo#12`) | The lines the PR changed |
| `github.com/owner/repo/blob/<branch>/path/file.js#L10-L20` | That whole file; lines 10–20 are highlighted |
| `raw.githubusercontent.com/owner/repo/<branch>/path/file.js` | That file |
| `github.com/owner/repo/tree/<branch>/src/api` | Every supported file in the folder |
| `github.com/owner/repo` (or `owner/repo`) | The repository's default branch |
| `github.com/owner/repo/commit/<sha>` | The lines the commit changed |
| `github.com/owner/repo/compare/main...feature` | The lines the branch changes |

Folder and repository scans read up to **40 files**, real source before tests and config, skipping `node_modules`, `dist`, `build`, `vendor`, minified and generated files and anything over 1,500 lines. Branch names with slashes (`feature/login`) work. A repository scan costs 2–3 GitHub API calls; file contents come from `raw.githubusercontent.com`, which doesn't count against the API limit.

## Sound

Off by default. Turn it on with the speaker button in the header (or `M` in the crypt); the choice is remembered.

- **Monster voices:** each monster speaks when you select it (click, `J`/`K`):

  | Monster | Voice |
  | --- | --- |
  | Void Wraith | A cold breath with a thin whistle |
  | Leech | Wet, bubbling gurgle |
  | Possessor | A rough demonic growl that sinks |
  | Imp | A quick, squeaky giggle |
  | Twin Ghosts | Two whispers, one in each ear |
  | Zombie | A long, hollow groan |
  | Gremlin | "Heh-heh-heh-heh" |

- **Banish:** the monster's last cry, deeper, under a hiss with ember crackles (**Banish all** gets a bigger burn).
- **The room is cleansed:** when the last monster falls, two bells ring over a warm chord, light floods the crypt and "The room is cleansed" rises. Clearing one file while others are still haunted gets a short chime.
- **Entering the crypt:** a door creak.
- **In the crypt:** a very quiet low drone that fades as monsters are banished and stops when none are left.

Everything is made in the browser with Web Audio, so there are no audio files to download. Nothing plays until the visitor clicks or presses a key, it pauses when the tab is hidden, and it stays silent when the system asks for reduced motion.

## Keyboard spells (in the crypt)

`J`/`N` next · `K`/`P` previous · `B` banish · `I` ignore · `E` explain simply · `L` lights · `M` sound · `U` or `Ctrl+Z` undo · `[` `]` switch file · `?` help

## Tests

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

- **Vitest** (222 tests): every scanner rule, the fix engine (apply / relocate / stale), reducer, selectors, PR URL parsing, mock API, diff, Markdown export, highlighter, component tests for the crypt, home doors, report and sound, and server tests for the GitHub routes (sign-in state check, encrypted session, token refresh, PR loading, review placement) against a fake GitHub API.
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
