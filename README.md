# Cursed Code Review

**Every bug is a monster.** Open your code in the crypt and bugs crawl out onto the exact lines where they hide. Apply the fix to banish them, and watch the room fill with light.

Built for **Kiroween 2026 · Costume Contest**.

> **Status: frontend prototype.** Everything runs in the browser. The static checks are real (a rule-based scanner), but GitHub sign-in, the PR API and "AI" explanations are mocked so the product can be demoed end to end without a backend.

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
| **Home** `/` | Three doors: cursed samples (one click), paste code (validation, language auto-detect, Ctrl+Enter), GitHub PR link (validation, loading, private-repo sign-in). Summoning progress overlay. Resume banner for an unfinished hunt. |
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

### Demo switches for the mocked GitHub

- Any `github.com/<owner>/<repo>/pull/<n>` link (or `owner/repo#n`) returns a deterministic PR.
- Repo names containing `private` need **Sign in with GitHub** (a demo consent screen).
- PR numbers `≥ 9000` return "not found"; a repo named `rate-limit` simulates a rate limit.

## Keyboard spells (in the crypt)

`J`/`N` next · `K`/`P` previous · `B` banish · `I` ignore · `E` explain simply · `L` lights · `U` or `Ctrl+Z` undo · `[` `]` switch file · `?` help

## Tests

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

- **Vitest** (79 tests): every scanner rule, the fix engine (apply / relocate / stale), reducer, selectors, PR URL parsing, mock API, diff, Markdown export, highlighter, and component tests for the crypt, home doors and report.
- **Playwright** on desktop and Pixel 7: full hunt → report → export, keyboard + undo, private PR → sign in → post review, paste flow, and a no-horizontal-scroll check on every page.

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

Replace the mocks with a backend: GitHub OAuth, the PR files API and review API, and an LLM for richer explanations. Deploy and record the demo video.

## License

[MIT](./LICENSE)
