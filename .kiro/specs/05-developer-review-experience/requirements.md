# Requirements — Developer Review Experience

## Problem
Findings are only useful if a developer can get code in quickly, understand what matters first, inspect each issue and its fix, and share the outcome.

## Goals
- From link or paste to the first finding in seconds; judges reach monsters in one click.
- The most important problem is obvious; every action is reviewable and reversible.

## Functional requirements
- **DRX-1** The home page SHALL offer three doors: a cursed sample (one click), pasted code (validated, language auto-detected), and GitHub (repository picker when signed in, link box otherwise).
- **DRX-2** In the crypt the developer SHALL move between findings and files with the mouse or keyboard spells (J/K, B, I, E, L, M, U/Ctrl+Z, [ ], ?).
- **DRX-3** The finding panel SHALL show rule id, category, confidence, line:column, CWE/OWASP links, an untrusted-input badge when seen, explanation, impact, how to fix, and the fix as a diff (or manual guidance).
- **DRX-4** The developer SHALL be able to dismiss a finding with a reason (false positive, accepted risk, fixed outside the app) and restore it.
- **DRX-5** "Re-scan file" SHALL re-run every rule on the current code and report resolved / new / remaining, undoable.
- **DRX-6** The Haunted Map SHALL show multi-file scans as a folder tree with search, filters and per-folder counts, mark explored folders, and offer the way back to the whole repository.
- **DRX-7** The report SHALL show a "Fix first" list (severity × confidence + exposure) and a findings table filterable by severity, category and status, searchable, sortable by priority, each finding linking to its code.
- **DRX-8** The Markdown export SHALL include source, timestamps, a severity × status summary, Fix first, and per-finding status, rule, references, explanation, impact and remediation, with secrets redacted.
- **DRX-9** Every banish, ignore, restore, reset and re-scan SHALL be undoable.

## Non-functional requirements
Clear technical language; the theme never obscures severity, line or fix.

## Edge cases
Empty review; a file without findings; all findings dismissed (no Daybreak); very long lines (code scrolls horizontally).

## Security
Exports and shares are redacted (see GH-12).

## Testing
Component tests for home, crypt, map, report and the developer workflow; e2e for the main journeys.
