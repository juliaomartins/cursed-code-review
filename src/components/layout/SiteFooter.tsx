import Link from "next/link";

export const REPO_URL = "https://github.com/juliaomartins/cursed-code-review";

export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-wrap justify-between gap-3 border-t border-line px-4 py-[22px] text-sm text-ink-3 sm:px-7">
      <span>Built with Kiro for Kiroween 2026</span>
      <span className="flex gap-[22px]">
        <Link href="/bestiary">Bestiary</Link>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source code
        </a>
        <Link href="/#how">Demo video</Link>
      </span>
    </footer>
  );
}
