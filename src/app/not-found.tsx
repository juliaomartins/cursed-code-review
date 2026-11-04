import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Monster } from "@/components/Monster";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
        <span className="behave-wraith">
          <Monster kind="wraith" size={140} />
        </span>
        <p className="m-0 font-mono text-xs tracking-[0.14em] text-ink-3">ERROR 404 · NULL ACCESS</p>
        <h1 className="m-0 font-display text-6xl leading-none">This room does not exist.</h1>
        <p className="m-0 text-ink-2">A Void Wraith reached for a page that was never there.</p>
        <ButtonLink href="/" variant="primary" size="lg">
          Back to the entrance
        </ButtonLink>
      </main>
      <SiteFooter />
    </div>
  );
}
