import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Monster } from "../Monster";
import { WatchingWraith } from "../WatchingWraith";
import { MateklamarMark } from "../brand/MateklamarMark";
import type { MonsterKind } from "@/lib/types";

const HERO_LINES: { t: string; k: MonsterKind | null; c: string | null }[] = [
  { t: "export async function login(req) {", k: null, c: null },
  { t: "  const user = await db.query(", k: null, c: null },
  { t: "    `...WHERE name = '${req.body.name}'`", k: "possessor", c: "#C8243C" },
  { t: "  const API_KEY = 'sk-live-xxxx';", k: "gremlin", c: "#C8243C" },
  { t: "  if (user.profile.email) {", k: "wraith", c: "#C9A86A" },
  { t: "  for (let i = 0; i <= n; i++) {", k: "imp", c: "#8AC7D1" },
  { t: "}", k: null, c: null },
];

export function Hero() {
  return (
    <section className="mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-center gap-14 px-4 pt-10 pb-[72px] sm:px-7 sm:pt-14">
      <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
        <div className="flex items-center gap-4">
          <MateklamarMark size={64} className="flex-none drop-shadow-[0_0_18px_rgba(201,168,106,0.25)]" />
          <span className="codex-eyebrow flex flex-col gap-1">
            <span>The Haunted Codex</span>
            <span className="text-ink-4">A code review you can see</span>
          </span>
        </div>
        <h1 className="m-0 font-brand text-[64px] leading-[0.92] font-bold tracking-[-0.01em] text-balance sm:text-[96px]">
          Every bug is a <span className="text-[#E0566A] [text-shadow:0_0_32px_rgba(200,36,60,0.55)]">monster.</span>
        </h1>
        <div className="codex-rule max-w-[460px]" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M5 0L10 5L5 10L0 5Z" fill="currentColor" />
          </svg>
        </div>
        <p className="m-0 max-w-[520px] text-[19px] leading-[1.55] text-pretty text-ink-2">
          Open your code in the crypt. Bugs crawl out onto the exact lines where they hide. Fix them to banish them, and watch the room fill with light.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/crypt?sample=cursed-login" variant="primary" size="lg" className="text-[17px]">
            Enter the crypt
            <Icon name="arrowRight" strokeWidth={2.4} />
          </ButtonLink>
          <ButtonLink href="#how" variant="outline" size="lg">
            <Icon name="play" />
            Watch the demo
          </ButtonLink>
        </div>
      </div>

      <div className="relative min-w-0 flex-[1_1_480px] px-2 pt-9 pb-2" aria-hidden="true">
        <div className="absolute -top-1.5 right-1 z-10 animate-[ccr-float_3.4s_ease-in-out_infinite]">
          <WatchingWraith size={120} />
        </div>
        <div className="codex-frame -rotate-2 overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_220px_at_40%_55%,rgba(232,145,63,0.12),rgba(232,145,63,0)_72%),#0E0F14] font-mono text-sm text-[#E4DCCB] shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-xs text-ink-4">
            <span className="h-2.5 w-2.5 rounded-full bg-crimson" />
            <span className="h-2.5 w-2.5 rounded-full bg-gold" />
            <span className="h-2.5 w-2.5 rounded-full bg-toxic" />
            <span className="ml-2">cursed-login.js</span>
          </div>
          <div className="pt-3 pb-[18px]">
            {HERO_LINES.map((l, i) => (
              <div key={i} className="flex min-h-[46px] items-center gap-3.5 px-4">
                <span className="w-[22px] flex-none text-right text-ink-4">{i + 3}</span>
                <span
                  className="min-w-0 flex-auto overflow-hidden text-ellipsis whitespace-pre underline-offset-[7px]"
                  style={{ textDecoration: l.c ? `underline wavy ${l.c}` : "none" }}
                >
                  {l.t}
                </span>
                {l.k && (
                  <span className="block flex-none" style={{ animation: `ccr-float 3s ease-in-out ${(i * 0.45).toFixed(2)}s infinite` }}>
                    <Monster kind={l.k} size={40} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
