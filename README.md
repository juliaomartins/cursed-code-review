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
| **Haunted Map** `/map` | A moonlit overview of a repository or folder scan: stat cards and a jack-o'-lantern room-light gauge; **Crypts to explore**, one tombstone per folder marked *Unexplored*, *Explored* (what it found, and when) or *You are here*, with progress across the repository; a **monster census** you can tap to filter; and **The rooms**, a folder tree (expand/collapse, search, Haunted/Clear filter, monster counts rolled up into every folder) or a ranked *Most haunted* list. "Enter the crypt" opens the worst file. |
| **The Crypt** `/crypt` | **Banish all** applies every remaining fix in a file or the whole scan after a preview (Twin Ghosts left for review unless you include them), undone in one step. Syntax-highlighted code with monsters on their lines, sized by severity. Cursor-following lantern, Lights on/off. Optional sound (see below). Detail panel with "What is wrong" / "Explain it simply", the fix as a diff, Banish (burn-away animation, applies the fix) and Ignore. Graveyard with restore, undo everywhere, "summon them again", multi-file navigation, PR changed-line gutter. Keyboard spells (`?`). |
| **Report** `/report` | Verdict, room light, stats, **Fix first** (top open findings by priority), a findings table you can filter by severity, category and status, search, and sort by priority, each row linking to its code; patch of every applied fix; Markdown export/copy (a shareable report with a severity × status summary and per-finding remediation, secrets redacted). Send it back to GitHub: **Open a fix PR** (new branch, one commit per fixed file, a PR listing every fix) for file, folder, repository and comparison scans; **Push fixes to this PR** for pull requests; post a review (Comment / Request changes / Approve; Comment only on your own PR); or **Create GitHub issue**. |
| **Bestiary** `/bestiary` | The seven monsters, their bug type, behaviour and an example fix. |

### The bestiary: what each monster detects

Every finding has a rule id, category, severity (Critical, High, Medium, Low), confidence, exact line and column, an explanation, impact, remediation and a CWE reference. Rules match **code only**: a small lexer masks comments and string contents first, so keywords in comments or UI text never trigger a finding.

| Monster | Rule id | What it detects | Languages | Automatic fix |
| --- | --- | --- | --- | --- |
| Possessor | `sql-injection` | SQL statements (SELECT…FROM, INSERT INTO, UPDATE…SET, DELETE FROM) built by interpolation or concatenation | JS/TS, Python, PHP | Bound parameters |
| Possessor | `xss` | `innerHTML`/`outerHTML` assignments of data; PHP `echo $_GET[…]` | JS/TS, PHP | `textContent` / escaping |
| Possessor | `command-injection` | Shell commands built from variables (`exec` with `child_process`, `shell: true`, `os.system`, `subprocess(…, shell=True)`, PHP `system`…) | JS/TS, Python, PHP | No (guidance) |
| Possessor | `code-injection` | `eval` / `new Function` / Python `exec` on non-literals | JS/TS, Python, PHP | No (guidance) |
| Gremlin | `hardcoded-secret` | Known key formats (Stripe, AWS, GitHub, Slack, Google, private keys) or credential-named variables holding credential-shaped values | JS/TS, Python, PHP | Read from env |
| Gremlin | `tls-verification-disabled` | `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED='0'`, `verify=False` | JS/TS, Python | Turn it back on |
| Gremlin | `jwt-verification-disabled` | `jwt.decode(…, verify=False)`, `algorithms: ['none']` | JS/TS, Python | No (guidance) |
| Void Wraith | `null-access` | Property access on `.find()`/DOM lookups/`.get()`/regex matches without a check | JS/TS, Python | Optional chaining / guard |
| Imp | `off-by-one` | `<= length` loops, `[length]` indexes, `range(len(x) + 1)` | JS/TS, Python, PHP | `<` / `- 1` |
| Twin Ghosts | `race-condition` | Read, `await`, then write back the same value | JS/TS, Python | Lock |
| Zombie | `swallowed-error` | Empty `catch {}`; bare or catch-all `except: pass` | JS/TS, Python, PHP | No (guidance) |
| Zombie | `dead-code` | Code after `return`/`throw`/`break`/`continue` | JS/TS, Python, PHP | Delete |
| Leech | `memory-leak` | Module-level collections that only grow | JS/TS, Python | Size cap |

**Severity is evidence-based.** Critical only when the line shows untrusted input (request data, `argv`…) reaching an injection sink, or for a live-format credential. **Confidence** says how sure a rule is; "low" means a potential risk the scanner could not confirm (for example, only constant-looking values interpolated into SQL), and the explanation says so. Nothing about exploitability or reachability is guessed.

**Silence a finding in code** with a comment on its line or the line above: `// ccr-ignore` or `// ccr-ignore: sql-injection, xss` (`#` in Python/PHP). Strings never count.

### Fixes you can trust

- A fix applies only if its target lines are exactly where the finding says; otherwise it is rejected and the finding is marked stale. It never searches for a lookalike elsewhere.
- A fix changes only its own lines; when identical code appears twice, each occurrence stays tied to its own finding.
- The banishment animation starts only after a dry run confirms the fix applies. If it doesn't, the monster **resists** and nothing is reported as fixed.
- After each fix the file is re-scanned: the graveyard and report say "verified by re-scan" or "re-scan still detects it".
- Rules without a safe automatic fix explain the remediation and never change code; dismiss them with a reason (false positive, accepted risk, fixed outside the app).
- Undo restores the exact previous content. **Re-scan file** re-runs every rule on the current code and reports resolved / new / remaining, keeping dismissals for the same finding only.
- Reports, GitHub issues and review comments redact secret values.

These guarantees are covered by property tests over randomly generated files (`src/lib/__tests__/fixEngine.property.test.ts`).

### Limits

Rules are per file and line-oriented, with a lexer but no full parser: no cross-file or data-flow analysis, no type information. Unhandled promise rejections are not detected. Findings are leads to review, not proof of exploitability.

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

## The hunt, as a horror game

Every bug is a monster, every fix is a banishment, every victory brings daylight. The spectacle is wired to the real review:

- **Summoning.** Scanning draws a ritual circle in ember light while the files are read.
- **Emergence.** Monsters climb out of the exact lines where their bugs hide, in reading order, each its own way: the Void Wraith rises out of shadow, the Leech squeezes out, the Possessor flickers in, the Imp pops up, the Twin Ghosts slide in from both sides, the Zombie rises from below, the Gremlin peeks in. The line flashes in its severity colour.
- **Reactions.** Selecting a monster (click, `J`/`K`) makes it notice you with its own threat move, and it speaks (sound on).
- **Severity.** LOW is a whisper, MED glows, HIGH smoulders with embers and a pulsing aura. The crypt's fog thickens and reddens while HIGH monsters remain, and the candles gutter when one is selected.
- **Banishment.** The fix is dry-run first; only a fix that applies gets a banishment. Each creature dies its own death, in step with the timer that applies the fix (longer for HIGH): violet smoke, stolen energy, burning runes, embers, spectral waves, ash, golden sparks. Then the code changes, the room light rises and the next monster is selected. A fix that no longer applies is never shown as a success: the creature **resists**, and the finding is marked stale.
- **The crypt.** A gothic window, moonlight falling across the room, dust in the beam, drifting fog and candles, all behind the code so the code stays the focus.
- **The finale.** Banishing the last monster stops the drone, rings bells over a rising arpeggio and birdsong, turns the crypt to daylight and shows **THE CRYPT IS CLEANSED** with monsters discovered, banished, ignored, fixes applied and room light, and the way to the final report. **Undo the last banish** brings the night back.

Presentation lives apart from the review logic: `src/lib/horror.ts` (per-creature config), `src/components/fx/` (`Creature`, `BanishBurst`) and CSS keyframes. Under reduced motion every banishment applies at once and nothing moves.

## Daybreak

When the last monster is banished, the night lifts. The whole crypt eases into warm morning light: a sun rises behind the header, slow light rays turn, golden motes drift up, the code turns to parchment, the lantern becomes a sun (**Daylight · 100%**) and the page title becomes **Daybreak**. The report of a cleansed scan opens in daylight too. **Undo** brings the night back.

It is the same set of colour tokens redefined under `html[data-daybreak]`, so every component follows. Under reduced motion the change is instant and nothing moves.

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

- **Banish:** the monster's last cry, deeper, under a hiss with ember crackles, plus its own death texture (a breath sucked away, a wet pop, cracking runes, a bright pop, two drifting tones, crumbling bones, tinkling sparks). **Banish all** gets a bigger burn. A fix that no longer applies fizzles instead.
- **Emergence:** one low swell and stinger per opened file, heavier when something HIGH lurks. A faint breath when the cursor finds a monster (throttled), and now and then the selected monster murmurs while it waits.
- **The room is cleansed:** when the last monster falls, two bells ring over a warm chord and birds wake up, light floods the crypt and "The room is cleansed" rises. Clearing one file while others are still haunted gets a short chime.
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

- **Vitest** (235 tests): every scanner rule, the fix engine (apply / relocate / stale), reducer, selectors, PR URL parsing, mock API, diff, Markdown export, highlighter, component tests for the crypt, home doors, report, sound and Daybreak, and server tests for the GitHub routes (sign-in state check, encrypted session, token refresh, PR loading, review placement) against a fake GitHub API.
- **Playwright** on desktop and Pixel 7: full hunt → report → export, keyboard + undo, PR → sign in → post review (GitHub responses mocked in the browser), no fake sign-in without the app, paste flow, and a no-horizontal-scroll check on every page.

Also: `npm run lint` (includes the jsx-a11y recommended rules), `npm run typecheck`, `npm run check:kiro` (Kiro artefacts vs. code), and `npm run verify` (all of these plus the tests). Focused runs: `npm run test:scanner`, `npm run test:fix-engine`, `npm run test:ui`.

## How it is built

- Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4.
- `src/lib/scanner/` — one pure module per monster. Each rule returns a finding with explanations and a line-range fix.
- `src/lib/review/` — the fix engine. Fixes are located by content, so when one fix inserts or removes lines every other monster moves with its code; monsters whose code vanished are marked stale.
- `src/providers/ReviewProvider.tsx` — reducer-based store persisted to localStorage, with undo.
- Accessibility: real buttons and links, 44px targets, focus-visible outlines, labelled icons, live regions, focus-trapped dialogs, `prefers-reduced-motion`.

## Built with Kiro

The `.kiro/` folder is the project's specification and rulebook, and it is checked against the code on every pull request. Full evidence and verification steps: **[KIRO.md](KIRO.md)**.

- **Specs** ([.kiro/specs/](.kiro/specs/)): seven specs (monster experience, detection engine, safe fix engine, GitHub, developer review experience, accessibility and performance, testing). Each has EARS requirements with ids, non-functional requirements, edge cases, security notes, a design and a task list. Unfinished work stays unchecked.
- **Traceability** ([TRACEABILITY.md](.kiro/specs/TRACEABILITY.md)): each of the 74 requirements maps to its source files, the tests that verify it, and an honest status (69 ✅, 3 🟡, 2 ❌).
- **Steering** ([.kiro/steering/](.kiro/steering/)): product, tech and structure always on; [scanner-rules.md](.kiro/steering/scanner-rules.md) and [fix-engine.md](.kiro/steering/fix-engine.md) load only when those folders are edited.
- **Hooks** ([.kiro/hooks/](.kiro/hooks/)):
  - a rule edit runs `npm run test:scanner`;
  - a fix-engine edit runs the safety property tests (`npm run test:fix-engine`);
  - a UI edit runs `npm run lint:a11y` with an accessibility checklist;
  - a spec, test or doc edit runs `npm run check:kiro`;
  - a manual quality gate runs `npm run verify`.
- **Consistency check** ([scripts/check-kiro.mjs](scripts/check-kiro.mjs)): `npm run check:kiro` fails when a hook names a missing script, a requirement is untraced, a referenced test was renamed, or a doc link breaks. It runs in `npm test` and in CI.

The code and these artefacts were written in AI-assisted sessions (commits carry a `Claude-Session` trailer); the steps that need the Kiro IDE itself are listed in [KIRO.md](KIRO.md#steps-that-need-the-kiro-ide).

## Roadmap

Webhooks so the app reviews new PRs automatically, unhandled-promise detection (DET-20), automated contrast and target-size checks (A11Y-5, A11Y-6), and the demo video.

## License

[MIT](./LICENSE)
