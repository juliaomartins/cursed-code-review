# Design — Accessibility and Performance

- Lint: `eslint.config.mjs` adds the full `jsx-a11y` recommended rule set to `src/**/*.tsx`.
- Reduced motion: `useReducedMotion` (`lib/useReducedMotion.ts`), CSS `@media (prefers-reduced-motion: reduce)` blocks in `globals.css`, `BanishBurst` renders nothing, the provider applies fixes with 0 ms.
- Focus: `components/ui/Dialog.tsx`, `crypt/CryptCleansed.tsx` trap focus; real `<button>`/`<a>` everywhere.
- Pointer: `LivingMonster.tsx` `subscribePointer` (one rAF-batched listener for all creatures).
