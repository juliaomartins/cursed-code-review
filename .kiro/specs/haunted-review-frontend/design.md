# Design — Haunted review frontend

Visual source: the "Styled UI — Haunted Crypt" and "Monster icon set" boards (Home, The Crypt, Report, Bestiary).

## Data model (`src/lib/types.ts`)
`Review` → `ReviewFile[]` → `Finding[]`. A `Finding` owns a `Fix { startLine, before[], after[] }` plus `lineOffsets` (lines it haunts) and `dimOffsets` (zombie lines).

## Pipeline
1. `scan(code, language)` runs seven pure rules (`src/lib/scanner/*`). Each rule returns findings with ready-to-apply fixes and explanations.
2. `reviewFrom*` factories build a `Review` (samples, paste, PR with `onlyLines`).
3. `reviewReducer` handles `select`, `step`, `banish`, `ignore`, `restore`, `undo`, `resetFile`, `posted`.
4. `applyFix` locates `before` by trimmed content nearest the hint line, re-indents `after`, splices it in. `relocate` moves all other lurking findings and flags stale ones.
5. Selectors derive stats, light, next monster; `report.ts` renders Markdown and PR comments; `diff.ts` renders patches.

## Mocks
- `fetchPullRequest`: deterministic per URL; `private` repos need sign-in, numbers ≥ 9000 are 404, repo `rate-limit` is rate-limited.
- `postReview`: needs sign-in, returns a review URL.
- Sign-in: a consent dialog that stores a demo user.

## Screens
- Home: hero code card with floating monsters, three doors, bestiary, how-it-works.
- Crypt: sticky header (logo, room light, undo, shortcuts, lights switch, finish), files + legend, code view with lantern, detail panel with rune circle, explanation toggle, fix diff, Banish/Ignore, graveyard.
- Report: verdict, light bar, "Trapped" jar of banished monsters, stat cards, findings table, spell book (patches), actions.
