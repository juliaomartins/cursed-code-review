import Link from "next/link";
import { CodexSeal } from "../brand/CodexSeal";

export function Logo({ tagline = false, size = 40 }: { tagline?: boolean; size?: number }) {
  return (
    <Link href="/" className="group flex items-center gap-3 text-ink no-underline hover:text-ink" aria-label="Cursed Code Review home">
      <CodexSeal size={size} className="flex-none transition-transform duration-500 ease-[var(--ease-codex)] group-hover:rotate-[-8deg]" />
      <span className="flex flex-col leading-none">
        <span className="font-brand text-[26px] font-bold tracking-[0.01em] sm:text-[30px]">Cursed Code Review</span>
        {tagline && <span className="codex-eyebrow mt-1.5 hidden text-[10px] sm:block">The Haunted Codex</span>}
      </span>
    </Link>
  );
}
