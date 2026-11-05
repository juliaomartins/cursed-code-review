import Link from "next/link";
import { WatchingWraith } from "../WatchingWraith";

export function Logo({ tagline = false, size = 40 }: { tagline?: boolean; size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink" aria-label="Cursed Code Review home">
      <WatchingWraith size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[26px] font-bold tracking-[0.01em] sm:text-[30px]">Cursed Code Review</span>
        {tagline && <span className="mt-1 hidden font-mono text-[11px] tracking-[0.14em] text-ink-3 sm:block">EVERY BUG IS A MONSTER</span>}
      </span>
    </Link>
  );
}
