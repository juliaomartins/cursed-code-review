# Requirements — Accessibility and Performance

## Problem
A horror theme invites motion, darkness and tiny decorations, all of which can lock people out or slow the tool down.

## Goals
Usable with keyboard and screen readers, comfortable for people who prefer reduced motion, responsive on phones, fast on real files.

## Functional requirements
- **A11Y-1** All TSX SHALL pass the jsx-a11y "recommended" lint rules (`npm run lint`), with documented exceptions only.
- **A11Y-2** WHILE the system asks for reduced motion THEN creatures, particles and the sky SHALL not move, banishments SHALL apply at once, and sound SHALL stay off.
- **A11Y-3** Every page SHALL fit a phone viewport without horizontal page scroll.
- **A11Y-4** Dialogs (including the finale) SHALL trap focus and close with Escape; every action SHALL be reachable by keyboard.
- **A11Y-5** Interactive targets SHALL be at least 44 × 44 px.
- **A11Y-6** Text SHALL meet WCAG AA contrast in both night and Daybreak themes.
- **A11Y-7** Cursor tracking SHALL use one shared listener, and animation SHALL be CSS/SVG, not continuous WebGL.

## Non-functional requirements
Scanning performance is DET-18 (1,500 lines < 3 s).

## Edge cases
Scrollable code region must be focusable (documented lint exception in `CodeView.tsx`).

## Testing
Lint in CI; component tests with reduced motion emulated; e2e no-horizontal-scroll on desktop and Pixel 7. A11Y-5 and A11Y-6 are conventions checked by review (the accessibility hook), not by automated tests.
