"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReview } from "@/providers/ReviewProvider";
import type { Review } from "@/lib/types";
import { Monster } from "../Monster";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";

const STEP_MS = 420;

interface SummonState {
  title: string;
  steps: string[];
  done: number;
}

/** Shows the "lighting the lantern" overlay while a review is built, then opens the crypt. */
export function useSummon() {
  const router = useRouter();
  const pathname = usePathname();
  const { start } = useReview();
  const [state, setState] = useState<SummonState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const summon = useCallback(
    (title: string, build: () => Review, stepLabels?: string[], destination?: (review: Review) => string) => {
      const review = build();
      const total = review.files.reduce((n, f) => n + f.findings.length, 0);
      const steps = stepLabels ?? [
        `Reading ${review.files.length === 1 ? review.files[0].path.split("/").pop() : `${review.files.length} files`}`,
        "Running 7 static checks",
        "Writing explanations and fixes",
        total ? `Summoning ${total} monster${total === 1 ? "" : "s"}` : "Searching every corner",
      ];
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const ms = reduced ? 60 : STEP_MS;
      setState({ title, steps, done: 0 });
      steps.forEach((_, i) => {
        timers.current.push(setTimeout(() => setState((s) => (s ? { ...s, done: i + 1 } : s)), ms * (i + 1)));
      });
      timers.current.push(
        setTimeout(
          () => {
            start(review);
            const to = destination?.(review) ?? "/crypt";
            if (to === pathname) {
              // Already on that page (e.g. scanning a folder from the map): the page redraws with the
              // new review, so close the overlay here; navigating would change nothing.
              timers.current = [];
              setState(null);
              window.scrollTo?.({ top: 0, behavior: reduced ? "auto" : "smooth" });
            } else router.push(to);
          },
          ms * (steps.length + 1),
        ),
      );
    },
    [router, start, pathname],
  );

  const overlay = state ? <SummonOverlay {...state} /> : null;
  return { summon, overlay, busy: state !== null };
}

function SummonOverlay({ title, steps, done }: SummonState) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05030a]/85 p-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="summon-title"
      aria-describedby="summon-steps"
    >
      <div className="flex w-full max-w-md animate-rise flex-col items-center gap-6 rounded-2xl border border-line bg-card p-8 text-center shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <span className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-ember/50" />
          <span className="absolute inset-3 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.3),rgba(255,138,61,0)_70%)]" />
          <span className="animate-float">
            <Monster kind="wraith" size={72} />
          </span>
        </div>
        <h2 id="summon-title" className="m-0 font-display text-4xl leading-none">
          {title}
        </h2>
        <ol id="summon-steps" className="m-0 flex w-full list-none flex-col gap-2.5 p-0 text-left">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 text-[15px] ${i < done ? "text-ink" : i === done ? "text-ink-2" : "text-ink-4"}`}>
              <span className="flex h-6 w-6 flex-none items-center justify-center">
                {i < done ? (
                  <span className="text-banished">
                    <Icon name="check" size={18} />
                  </span>
                ) : i === done ? (
                  <span className="text-ember">
                    <Spinner size={16} />
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
