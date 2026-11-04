import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Monster } from "../Monster";
import type { MonsterKind } from "@/lib/types";

const HERO_LINES: { t: string; k: MonsterKind | null; c: string | null }[] = [
  { t: "export async function login(req) {", k: null, c: null },
  { t: "  const user = await db.query(", k: null, c: null },
  { t: "    `...WHERE name = '${req.body.name}'`", k: "possessor", c: "#FF6B5B" },
  { t: "  const API_KEY = 'sk-live-xxxx';", k: "gremlin", c: "#FF6B5B" },
  { t: "  if (user.profile.email) {", k: "wraith", c: "#FFB547" },
  { t: "  for (let i = 0; i <= n; i++) {", k: "imp", c: "#7FD8F5" },
  { t: "}", k: null, c: null },
];

export function Hero() {
  return (
    <section className="mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-center gap-14 px-4 pt-10 pb-[72px] sm:px-7 sm:pt-14">
      <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-line-strong px-3 py-1.5 font-mono text-xs tracking-[0.12em] text-ink-3">
          <span className="h-2 w-2 rounded-full bg-ember shadow-[0_0_8px_#FF8A3D]" />A CODE REVIEW YOU CAN SEE
        </span>
        <h1 className="m-0 font-display text-[64px] leading-[0.92] font-bold tracking-[-0.01em] text-balance sm:text-[96px]">
          Every bug is a <span className="text-ember [text-shadow:0_0_28px_rgba(255,138,61,0.55)]">monster.</span>
        </h1>
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
          <Monster kind="wraith" size={120} />
        </div>
        <div className="-rotate-2 overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_220px_at_40%_55%,rgba(255,138,61,0.16),rgba(255,138,61,0)_72%),#110D18] font-mono text-sm text-[#ECE4F6] shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-xs text-ink-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B5B]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFB547]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#6FF2B0]" />
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
