# Requirements — Haunted review frontend

## 1. Enter the crypt
- **1.1** WHEN a visitor clicks a cursed sample THEN the system SHALL show a summoning progress overlay and open the crypt with that file active and its first monster selected.
- **1.2** WHEN a visitor submits pasted code THEN the system SHALL scan it in the browser; IF the code is empty or longer than 1500 lines THEN it SHALL show an inline error and not navigate.
- **1.3** WHILE a visitor types or pastes code with an untouched language picker, the system SHALL auto-detect the language.
- **1.4** WHEN a visitor submits a GitHub PR link THEN the system SHALL validate it, fetch the PR and scan only changed lines; IF the repo is private and the visitor is signed out THEN it SHALL offer GitHub sign-in inline.
- **1.5** WHEN a review exists THEN the home page SHALL offer to resume it.

## 2. Monsters
- **2.1** The system SHALL detect seven bug kinds, each mapped to one monster: null access (Void Wraith), memory leak (Leech), injection (Possessor), off-by-one (Imp), race condition (Twin Ghosts), dead code (Zombie), hardcoded secret (Gremlin).
- **2.2** Each monster SHALL appear on its line, sized by severity (LOW 30, MED 34, HIGH 40) with a wavy underline in the severity colour.
- **2.3** Twin Ghosts SHALL appear on both lines of the race; Zombies SHALL grey out every unreachable line.
- **2.4** Each monster SHALL carry a technical explanation, a simple explanation and a concrete fix.

## 3. Banish
- **3.1** WHEN the visitor banishes a monster THEN the system SHALL play the burn-away animation, apply the fix to the code, raise the room light (25% + 75% × banished/total) and select the next monster.
- **3.2** WHEN a fix inserts or removes lines THEN every other monster SHALL move with its code.
- **3.3** IF a monster's code no longer exists THEN it SHALL be marked stale and its Banish action disabled.
- **3.4** Ignore SHALL resolve a monster without changing code or light; ignored monsters SHALL be restorable from the graveyard.
- **3.5** Every banish/ignore/restore/reset SHALL be undoable (button, toast action, `U`, `Ctrl+Z`).
- **3.6** Keyboard spells: J/N next, K/P previous, B banish, I ignore, E explain simply, L lights, [ ] files, ? help.
- **3.7** "Lights on" SHALL switch the editor to a parchment theme; the lantern glow SHALL follow the cursor in the dark theme.

## 4. Report
- **4.1** The report SHALL show found / banished / ignored / lurking counts, worst severity, room light and a table of all monsters with status.
- **4.2** The report SHALL show the patch of every applied fix.
- **4.3** The visitor SHALL be able to export the report as Markdown and copy it.
- **4.4** WHEN the review came from a PR THEN the visitor SHALL be able to post it as a GitHub review (Comment / Request changes / Approve, Approve only when nothing lurks) after signing in.

## 5. Quality
- **5.1** No horizontal page scroll at 390px wide; code and tables scroll inside their own boxes.
- **5.2** All interactive elements are real buttons/links with ≥44px targets and visible focus.
- **5.3** Animations SHALL stop under `prefers-reduced-motion`.
