"use client";

import { useCallback, useEffect, useState } from "react";
import { playCreak, setSoundEnabled, soundSupported, unlock } from "@/lib/sound";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useReview } from "@/providers/ReviewProvider";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

/** The visitor's sound choice, plus a toggle that works inside a click or key press. */
export function useSound() {
  const { prefs, setPrefs } = useReview();
  const reduced = useReducedMotion();
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only check after mount
    setSupported(soundSupported());
  }, []);

  const toggle = useCallback(() => {
    if (reduced || !supported) return;
    const next = !prefs.sound;
    setPrefs({ sound: next });
    // Switch the engine now, inside the gesture, so the browser lets it start.
    setSoundEnabled(next);
    if (next) {
      unlock();
      playCreak();
    }
  }, [prefs.sound, reduced, supported, setPrefs]);

  return { on: prefs.sound && !reduced, reduced, supported, toggle };
}

export function SoundToggle({ className, shortcut = false }: { className?: string; shortcut?: boolean }) {
  const { on, reduced, supported, toggle } = useSound();
  if (!supported) return null;
  const label = reduced ? "Sound off: your system asks for reduced motion" : on ? "Sound on" : "Sound off";
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      disabled={reduced}
      aria-pressed={on}
      aria-label={reduced ? label : "Sound"}
      title={reduced || !shortcut ? label : `${label} (M)`}
      className={`px-3 ${className ?? ""}`}
      data-sound={on ? "on" : "off"}
    >
      <Icon name={on ? "volume" : "volumeOff"} />
    </Button>
  );
}
