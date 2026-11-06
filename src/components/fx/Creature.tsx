"use client";

import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from "react";
import type { MonsterKind, Severity } from "@/lib/types";
import { cx } from "../ui/cx";
import { BanishBurst } from "./BanishBurst";

export interface CreatureProps {
  kind: MonsterKind;
  severity: Severity;
  children: ReactNode;
  /** Climb out of the code when first shown, after this many seconds. Omit to skip the entrance. */
  emergeAfter?: number;
  /** Changing this plays the creature's threat reaction (selection, focus). */
  reactKey?: unknown;
  /** Play the threat reaction on mount too (the big monster in the side panel). */
  reactOnMount?: boolean;
  banishing?: boolean;
  /** Banishment length in ms, matching the timer that applies the fix. */
  banishMs?: number;
  /** The fix didn't apply: the creature shrugs the spell off. */
  resisting?: boolean;
  /** Idle movement (the existing per-monster behaviours). */
  idle?: boolean;
  /** Particle scale for big renderings. */
  scale?: number;
  seed?: number;
  /** Offsets the idle loop so neighbours don't move in lockstep. */
  idleDelay?: number;
  className?: string;
}

/**
 * Wraps a monster drawing with its life cycle: emerge → idle → react → banish (or resist).
 * Purely presentational: it never changes review state, it only follows the props it is given.
 */
export function Creature({
  kind,
  severity,
  children,
  emergeAfter,
  reactKey,
  reactOnMount = false,
  banishing = false,
  banishMs = 700,
  resisting = false,
  idle = true,
  scale = 1,
  seed = 1,
  idleDelay = 0,
  className,
}: CreatureProps) {
  const [emerging, setEmerging] = useState(emergeAfter !== undefined);
  const [reacting, setReacting] = useState(reactOnMount);
  const firstKey = useRef(true);

  useEffect(() => {
    if (firstKey.current) {
      firstKey.current = false;
      return;
    }
    setReacting(false);
    const raf = requestAnimationFrame(() => setReacting(true));
    return () => cancelAnimationFrame(raf);
  }, [reactKey]);

  const onEnd = (e: AnimationEvent<HTMLSpanElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName.startsWith("cr-emerge")) setEmerging(false);
    if (e.animationName.startsWith("cr-react")) setReacting(false);
  };

  return (
    <span
      className={cx(
        "cr",
        `cr-${kind}`,
        `cr-sev-${severity}`,
        banishing ? "cr-banishing" : resisting ? "cr-resisting" : reacting ? "cr-reacting" : emerging ? "cr-emerging" : null,
        className,
      )}
      data-creature={kind}
      data-state={banishing ? "banishing" : resisting ? "resisting" : reacting ? "reacting" : emerging ? "emerging" : "idle"}
      style={{ "--ed": `${emergeAfter ?? 0}s`, "--bd": `${banishMs}ms` } as CSSProperties}
      onAnimationEnd={onEnd}
    >
      <span
        className={cx("cr-body", idle && !banishing && `behave-${kind}`, kind === "gremlin" && idle && !banishing && "gremlin-dart")}
        style={idle ? { animationDelay: `${idleDelay}s` } : undefined}
      >
        {children}
      </span>
      {severity === "HIGH" && !banishing && (
        <span className="cr-aura-embers" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
      {banishing && <BanishBurst kind={kind} severity={severity} seed={seed} scale={scale} />}
    </span>
  );
}
