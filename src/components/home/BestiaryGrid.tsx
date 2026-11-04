import Link from "next/link";
import { MONSTER_ORDER, MONSTERS } from "@/lib/monsters";
import { Monster } from "../Monster";

export function BestiaryGrid() {
  return (
    <section id="bestiary" aria-labelledby="bestiary-title" className="mx-auto box-border flex w-full max-w-[1280px] scroll-mt-6 flex-col gap-[22px] px-4 pb-[88px] sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="bestiary-title" className="m-0 font-display text-[44px] font-bold">
          Meet the bestiary
        </h2>
        <p className="m-0 max-w-[460px] text-[15px] text-ink-3">Each kind of bug has its own monster. Worse bugs grow bigger monsters.</p>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-4 p-0">
        {MONSTER_ORDER.map((k, i) => {
          const m = MONSTERS[k];
          return (
            <li key={k}>
              <Link
                href={`/bestiary#${k}`}
                className="group box-border flex h-full flex-col items-center gap-2.5 rounded-2xl border border-line bg-card px-3.5 pt-5 pb-[18px] text-center text-ink no-underline transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong hover:text-ink"
              >
                <span style={{ animation: `ccr-float 3.2s ease-in-out ${(i * 0.4).toFixed(2)}s infinite` }}>
                  <Monster kind={k} size={96} />
                </span>
                <span className="font-display text-2xl leading-none font-bold">{m.name}</span>
                <span className="font-mono text-xs text-ink-3">{m.bug}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
