import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LivingMonster } from "@/components/LivingMonster";
import { Monster } from "@/components/Monster";
import { ButtonLink } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { MONSTER_ORDER, MONSTERS, SEVERITY } from "@/lib/monsters";
import type { Severity } from "@/lib/types";

export const metadata: Metadata = { title: "Bestiary", description: "Seven monsters, one per bug type." };

export default function BestiaryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_900px_500px_at_80%_0%,rgba(127,140,255,0.10),rgba(127,140,255,0)_70%),#0D0A12]">
      <SiteHeader />
      <main id="main" className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-10 px-4 pt-10 pb-24 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-[0.16em] text-ink-3">CURSED CODE REVIEW · FIELD GUIDE</span>
            <h1 className="m-0 font-display text-6xl leading-none font-bold sm:text-[72px]">The Bestiary</h1>
          </div>
          <p className="m-0 max-w-[460px] text-[15px] leading-normal text-ink-3">
            Seven monsters, one per bug type. All share a 120×120 grid, a 3px ink outline and a glow in their own colour. The worse the bug, the bigger the monster.
            Bring your cursor close, then hover one: each has its own move.
          </p>
        </div>

        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-[18px] p-0">
          {MONSTER_ORDER.map((k) => {
            const m = MONSTERS[k];
            return (
              <li key={k} id={k} className="flex scroll-mt-8 flex-col gap-3 rounded-[18px] border border-line bg-card p-5 target:border-ember target:shadow-[0_0_0_1px_#FF8A3D,0_0_40px_rgba(255,138,61,0.2)]">
                <div
                  className="flex h-[170px] items-center justify-center rounded-xl"
                  style={{ background: `radial-gradient(circle 90px at 50% 55%, ${m.glow}47, rgba(0,0,0,0) 72%), #110D18` }}
                >
                  <span className={`behave-${k}`}>
                    <LivingMonster kind={k} size={124} label={m.name} />
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="m-0 font-display text-[28px] leading-none font-bold">{m.name}</h2>
                  <span className="font-mono text-[11px] text-ink-3">{m.hex}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs tracking-[0.08em] text-ember-soft">{m.category}</span>
                  <SeverityBadge severity={m.defaultSeverity} />
                </div>
                <p className="m-0 text-sm leading-[1.5] text-ink-2">{m.lore}</p>
                <p className="m-0 text-sm leading-[1.45] text-ink-3 italic">{m.behavior}</p>
                <div className="mt-auto relative overflow-x-auto rounded-[10px] border border-line font-mono text-xs scrollbar-thin">
                  {m.example.before.split("\n").map((l, i) => (
                    <div key={`b${i}`} className="bg-[rgba(255,107,91,0.10)] px-3 py-1.5 whitespace-pre text-fix-del">
                      - {l}
                    </div>
                  ))}
                  {m.example.after.split("\n").map((l, i) => (
                    <div key={`a${i}`} className="bg-[rgba(111,242,176,0.08)] px-3 py-1.5 whitespace-pre text-fix-add">
                      + {l}
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
          <li className="flex flex-col gap-3.5 rounded-[18px] border border-dashed border-line-strong p-5">
            <h2 className="m-0 font-mono text-xs font-normal tracking-[0.14em] text-ink-3">SIZE BY SEVERITY</h2>
            <div className="flex items-end gap-[18px]">
              {(["LOW", "MED", "HIGH"] as Severity[]).map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <Monster kind="wraith" size={SEVERITY[s].size} />
                  <span className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold" style={{ background: SEVERITY[s].bg, color: SEVERITY[s].fg }}>
                    {s} {SEVERITY[s].size}
                  </span>
                </div>
              ))}
            </div>
            <h2 className="m-0 mt-1.5 font-mono text-xs font-normal tracking-[0.14em] text-ink-3">ON LIGHTS-ON MODE</h2>
            <div className="flex justify-between rounded-xl bg-parchment p-2.5">
              {(["possessor", "imp", "leech", "gremlin"] as const).map((k) => (
                <Monster key={k} kind={k} size={40} glow={false} />
              ))}
            </div>
            <ButtonLink href="/crypt?sample=cursed-login" variant="primary" className="mt-auto">
              Hunt them in the crypt
            </ButtonLink>
          </li>
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
