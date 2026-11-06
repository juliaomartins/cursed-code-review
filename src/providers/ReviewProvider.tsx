"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { banishDuration } from "@/lib/horror";
import { applyFix } from "@/lib/review/apply";
import { initialState, reviewReducer, type ReviewAction, type ReviewState } from "@/lib/review/reducer";
import { setSoundEnabled } from "@/lib/sound";
import { KEYS, readJson, writeJson } from "@/lib/storage";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { Review } from "@/lib/types";

export interface Prefs {
  lights: boolean;
  explainSimple: boolean;
  /** Crypt sounds. Off until the visitor turns them on. */
  sound: boolean;
}

const DEFAULT_PREFS: Prefs = { lights: false, explainSimple: false, sound: false };

interface ReviewValue {
  state: ReviewState;
  review: Review | null;
  hydrated: boolean;
  dispatch: (a: ReviewAction) => void;
  start: (r: Review) => void;
  /**
   * Checks the fix applies, then plays the banishment and applies it.
   * Returns how long the banishment plays (ms), or `false` when the fix no longer applies: then nothing
   * is animated as a success, and the finding is marked stale instead.
   */
  banish: (findingId: string) => number | false;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
}

const ReviewContext = createContext<ReviewValue | null>(null);

export const BANISH_MS = 700;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function ReviewProvider({ children, banishMs = BANISH_MS }: { children: ReactNode; banishMs?: number }) {
  const [state, dispatch] = useReducer(reviewReducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = readJson<Pick<ReviewState, "review" | "undo">>(KEYS.review);
    if (saved?.review) dispatch({ type: "hydrate", state: { review: saved.review, undo: saved.undo ?? [] } });
    const savedPrefs = readJson<Prefs>(KEYS.prefs);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount to avoid SSR mismatch
    if (savedPrefs) setPrefsState({ ...DEFAULT_PREFS, ...savedPrefs });
    setHydrated(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(KEYS.review, state.review ? { review: state.review, undo: state.undo } : null);
  }, [hydrated, state.review, state.undo]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      writeJson(KEYS.prefs, next);
      return next;
    });
  }, []);

  // Sound follows the saved choice, and stays silent while the system asks for reduced motion.
  const reduced = useReducedMotion();
  useEffect(() => {
    setSoundEnabled(hydrated && prefs.sound && !reduced);
  }, [hydrated, prefs.sound, reduced]);

  const banishingRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    banishingRef.current = state.banishing;
    stateRef.current = state;
  }, [state]);

  const banish = useCallback(
    (findingId: string): number | false => {
      if (banishingRef.current) return false;
      const review = stateRef.current.review;
      const file = review?.files.find((f) => f.findings.some((x) => x.id === findingId));
      const finding = file?.findings.find((x) => x.id === findingId);
      if (!file || !finding || finding.status !== "lurking" || finding.autofix === false) return false;
      // Fix first, spectacle second: a dry run on the current code. If it fails, the reducer marks the
      // finding stale and no banishment is shown.
      if (!applyFix(file.code, finding)) {
        dispatch({ type: "banish", findingId });
        return false;
      }
      const ms = prefersReducedMotion() ? 0 : banishDuration(banishMs, finding.severity);
      if (ms === 0) {
        dispatch({ type: "banish", findingId });
        return 0;
      }
      banishingRef.current = findingId;
      dispatch({ type: "beginBanish", findingId });
      timer.current = setTimeout(() => dispatch({ type: "banish", findingId }), ms);
      return ms;
    },
    [banishMs],
  );

  const start = useCallback((review: Review) => dispatch({ type: "start", review }), []);

  const value = useMemo<ReviewValue>(
    () => ({ state, review: state.review, hydrated, dispatch, start, banish, prefs, setPrefs }),
    [state, hydrated, start, banish, prefs, setPrefs],
  );
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview(): ReviewValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used inside <ReviewProvider>");
  return ctx;
}
