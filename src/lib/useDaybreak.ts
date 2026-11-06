"use client";

import { useEffect, useRef } from "react";

const SHIFT_MS = 1800;

/**
 * Puts the whole page in morning light while `active`: sets `data-daybreak` on <html>, which swaps the
 * colour tokens (globals.css). A change after the first `ready` render eases across instead of snapping.
 */
export function useDaybreak(active: boolean, ready = true): void {
  const known = useRef<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;
    const html = document.documentElement;
    const changed = known.current !== null && known.current !== active;
    known.current = active;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (changed && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      html.classList.add("day-shift");
      timer = setTimeout(() => html.classList.remove("day-shift"), SHIFT_MS);
    }
    if (active) html.dataset.daybreak = "on";
    else delete html.dataset.daybreak;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [active, ready]);

  // Leaving the page returns the rest of the app to night.
  useEffect(
    () => () => {
      const html = document.documentElement;
      delete html.dataset.daybreak;
      html.classList.remove("day-shift");
    },
    [],
  );
}
