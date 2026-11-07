# Design — Haunted Monster Experience

- Art: `src/components/monster-art.tsx` (static), `src/components/living-art.tsx` + `LivingMonster.tsx` (cursor-aware, one shared rAF-batched listener).
- Life cycle: `src/components/fx/Creature.tsx` wraps a drawing with emerge → idle → react → banish/resist classes; `fx/BanishBurst.tsx` draws the particles. Per-creature config in `src/lib/horror.ts` (particle type, colours, intensity per severity, deterministic layouts).
- Timing contract: `ReviewProvider.banish` returns the banishment length (`banishDuration`); the same value drives the CSS (`--bd`) and the timer that dispatches the fix.
- Environment: `crypt/CryptAtmosphere.tsx` (night), `Daybreak.tsx` + `lib/useDaybreak.ts` (day tokens under `html[data-daybreak]`), finale `crypt/CryptCleansed.tsx`.
- Sound: `src/lib/sound.ts` (Web Audio, no files), toggle in `SoundToggle.tsx`.
