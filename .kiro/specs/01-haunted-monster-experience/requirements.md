# Requirements — Haunted Monster Experience

## Problem
Code review output is a wall of text that people skim. Mateklamar Code Review turns each finding into a creature on the line where the bug lives, so problems are noticed, remembered and dealt with. The theme must serve the review, never hide it.

## Goals
- Every bug type has one recognisable creature, the same everywhere in the app.
- The creature's life follows the finding: it appears with the finding, reacts when selected, and dies when the fix lands.
- Finishing a review feels like winning, and is reversible.

## Functional requirements
- **MON-1** The system SHALL map each rule family to one of seven creatures (Void Wraith, Leech, Possessor, Imp, Twin Ghosts, Zombie, Gremlin) and use the same artwork for that creature on every page.
- **MON-2** WHEN a file opens in the crypt THEN each lurking finding's creature SHALL emerge from its own code line, in reading order, with a creature-specific entrance, and the line SHALL flash in its severity colour.
- **MON-3** WHEN a finding is selected THEN its creature SHALL play a creature-specific reaction; creature intensity (aura, particles, banishment length) SHALL scale with severity.
- **MON-4** WHEN a fix is banished THEN the creature SHALL play its own death (smoke, energy, runes, embers, waves, ash, sparks) for the same duration as the timer that applies the fix, and the code SHALL change only when that timer ends.
- **MON-5** WHEN the last lurking finding in the review is banished THEN the crypt SHALL turn to daylight and show "THE CRYPT IS CLEANSED" with discovered, banished, ignored, fixes applied and room light; WHEN that banish is undone THEN the haunted state SHALL return.
- **MON-6** Sound SHALL be off by default; WHEN enabled THEN creatures SHALL have their own voices and deaths; the audio context SHALL only start after a user gesture.
- **MON-7** Creatures SHALL notice a nearby cursor (eyes, poses) using one shared pointer listener.

## Non-functional requirements
- Animations are CSS/SVG, one-shot where possible; no continuous WebGL.
- Severity, line, rule and fix stay readable whatever the animation state.

## Edge cases
- Undo of a banished finding: the creature climbs back out.
- A fix that no longer applies: the creature resists; no death is shown (see FIX-5).
- Reduced motion: no movement, banishment applies at once (see A11Y-2).

## Security
None specific; presentation never touches review state (`lib/horror.ts`, `components/fx/`).

## Testing
Component tests drive emergence, reaction, deaths, finale and sound with fake timers/AudioContext; see TRACEABILITY.md.
