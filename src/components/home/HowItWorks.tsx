import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Monster } from "../Monster";

const STEPS = [
  { n: "01", title: "Scan", body: "Static checks find real bugs. AI explains each one and writes the fix.", icon: <Icon name="search" size={24} /> },
  {
    n: "02",
    title: "Monsters spawn",
    body: "Every bug becomes a monster on its line, sized by how dangerous it is.",
    icon: <Monster kind="imp" size={38} glow={false} />,
  },
  { n: "03", title: "Banish", body: "Apply the fix. The monster burns away and the crypt gets brighter.", icon: <Icon name="flame" size={24} /> },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto box-border flex w-full max-w-[1280px] scroll-mt-6 flex-col gap-[22px] px-4 pb-24 sm:px-7">
      <h2 id="how-title" className="m-0 font-display text-[44px] font-bold">
        How the hunt works
      </h2>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5 p-0">
        {STEPS.map((s) => (
          <li key={s.n} className="flex items-start gap-4 rounded-2xl border border-line bg-card p-[22px]">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-well text-ember">{s.icon}</span>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-ink-3">{s.n}</span>
              <strong className="text-[19px]">{s.title}</strong>
              <span className="text-[15px] leading-normal text-ink-2">{s.body}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex justify-center pt-6">
        <ButtonLink href="/crypt?sample=cursed-login" variant="primary" size="lg" className="text-[17px]">
          Enter the crypt
        </ButtonLink>
      </div>
    </section>
  );
}
