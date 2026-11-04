import Link from "next/link";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

export function SiteHeader() {
  return (
    <header className="mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-[18px] sm:px-7">
      <Logo />
      <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
        <Link href="/#how" className="hidden text-ink-2 no-underline hover:text-ink md:inline">
          How it works
        </Link>
        <Link href="/bestiary" className="text-ink-2 no-underline hover:text-ink">
          Bestiary
        </Link>
        <UserMenu compact />
      </nav>
    </header>
  );
}
