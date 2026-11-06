"use client";

import { useEffect } from "react";

export const CLEANSED_MS = 4200;

/** The last monster is gone: warm light floods the crypt and a short message rises. */
export function Cleansed({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, CLEANSED_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <div aria-hidden="true" className="cleanse-flare pointer-events-none fixed inset-0 z-40" />
      <div className="pointer-events-none fixed inset-x-0 top-[28vh] z-50 flex justify-center px-4">
        <div
          role="status"
          className="cleanse-banner flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-card/80 px-6 py-5 text-center shadow-[0_24px_70px_rgba(140,70,10,0.22)] backdrop-blur-md sm:px-10 sm:py-6"
        >
          <span className="font-display text-[44px] leading-none font-bold text-ember-pale sm:text-[56px]">The room is cleansed</span>
          <span className="text-base text-ink-2">Every monster is gone. The light is back.</span>
        </div>
      </div>
    </>
  );
}
