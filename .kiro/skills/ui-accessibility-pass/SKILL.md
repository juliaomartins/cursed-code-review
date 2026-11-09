---
name: ui-accessibility-pass
description: Review and correct a UI change in Mateklamar Code Review for design-token use, accessibility and reduced motion. Use when editing anything in src/components or src/app, adding a button, dialog, card or animation, changing globals.css, or fixing a jsx-a11y lint error.
---

# Accessibility and design pass on a UI change

Applies to every change under `src/components/**` or `src/app/**`.
Requirements: `.kiro/specs/06-accessibility-performance/requirements.md` (A11Y-*).
Visual identity and conventions: `.kiro/steering/tech.md`.

Guiding principle from `.kiro/steering/product.md`: the theme decorates, it never obscures.
Severity, rule, `line:column` and the fix stay readable at all times.

## 1. Use the Haunted Codex tokens — no new raw hex

All colours come from the `@theme` tokens in `src/app/globals.css`, used through Tailwind
classes. **Never introduce a new hex value in a component.** Daybreak re-defines the same
tokens under `html[data-daybreak]`, so a hard-coded colour silently breaks the day theme.

The accent vocabulary: **gold** is the primary accent, **crimson** means danger, **toxic
green** means cleansed, **ghost cyan** means supernatural. Severity has its own tokens
(`sev-low`, `sev-med`, `sev-high`). If you need a colour that does not exist, add a token to
`globals.css` rather than inlining it.

Typography: `font-brand` only for page titles, `font-display` for headings, JetBrains Mono for
code with ligatures **off**, so `<=` stays two visible characters.

## 2. Keep .codex-frame square

`.codex-frame` is the signature surface and is defined with `border-radius: 0` so its gold
corner clasps sit exactly on the corners. The rule is unlayered deliberately, to win over any
`rounded-*` utility. Do not add a `rounded-*` class to a `.codex-frame` card, and do not round
it in CSS.

## 3. Respect reduced motion

Every new animation must be guarded, either by a `@media (prefers-reduced-motion: reduce)`
block in `globals.css` or by the `useReducedMotion` hook. Motion and sound are optional;
sound is off by default.

Per `.kiro/steering/tech.md`, animation belongs in CSS/SVG, creatures share one pointer
listener, and there is no continuous WebGL.

## 4. Never animate transform or filter on a page wrapper

Animating `transform` or `filter` on a page-level wrapper creates a containing block for
fixed-position descendants, which breaks every fixed overlay inside it (dialogs, toasts,
sticky headers). Animate a child element, or animate `opacity` only. Check
`src/app/template.tsx` before adding a page transition.

## 5. Check what lint cannot see

- Interactive targets at least **44 px** (`min-h-11`, or an explicit 44px) — thumb-sized.
- Real `<button>` and `<a>` elements, never a clickable `<div>`.
- Icon-only controls need an `aria-label`.
- Decorative SVG and ornament get `aria-hidden="true"`.
- Everything reachable by keyboard, with a visible focus style.
- Dialogs trap focus and close on Escape (see `src/components/crypt/ShortcutsDialog.tsx` and
  `BanishAllDialog.tsx` for the established pattern).
- Text contrast holds in **both** the night theme and Daybreak.
- An unavoidable lint exception carries an `eslint-disable` comment stating the reason — the
  scrollable code region in `src/components/crypt/CodeView.tsx` is the reference example.

## 6. Verify

```
npm run lint:a11y
npm run test:ui
```

`lint:a11y` runs the full `jsx-a11y` recommended set over `src/**/*.tsx` (configured in
`eslint.config.mjs`; `eslint-config-next` alone enables only a few of those rules). Fix every
error rather than suppressing it. `test:ui` runs the component tests in `src/components`.

For a flow-level change, also run `npm run test:e2e`, which covers desktop and Pixel 7.
