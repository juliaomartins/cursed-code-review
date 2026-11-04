import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CreateAppForm } from "@/components/setup/CreateAppForm";
import { Icon } from "@/components/ui/Icon";
import { getConfig, missingEnv } from "@/server/config";

export const metadata: Metadata = { title: "Connect GitHub", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const config = getConfig();
  const missing = missingEnv();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto box-border flex w-full max-w-[760px] flex-col gap-8 px-4 pt-8 pb-24 sm:px-7">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-xs tracking-[0.16em] text-ink-3">FOR THE SITE OWNER · ONE-TIME SETUP</span>
          <h1 className="m-0 font-display text-5xl leading-none sm:text-6xl">Connect GitHub</h1>
          <p className="m-0 text-[17px] leading-relaxed text-ink-2">
            This lets visitors sign in with their own GitHub account, open private pull requests, and post reviews. Public pull requests already work without
            it.
          </p>
        </div>

        {config ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-banished/40 bg-banished/[0.06] p-6">
            <h2 className="m-0 flex items-center gap-2 text-xl">
              <span className="text-banished">
                <Icon name="check" size={22} />
              </span>
              GitHub is connected
            </h2>
            <p className="m-0 text-[15px] text-ink-2">
              This site uses the GitHub App <a href={`https://github.com/apps/${config.slug}`}>{config.slug}</a>. Visitors can sign in from the header.
            </p>
          </section>
        ) : (
          <>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {[
                ["Create the app", "One click below. GitHub fills in every setting for you."],
                ["Copy the keys", "GitHub sends you back here with the keys in one block and a Copy all button."],
                ["Paste into Vercel and redeploy", "One paste adds all three environment variables."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4 rounded-2xl border border-line bg-card p-5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ember font-bold text-ember-ink">{i + 1}</span>
                  <span className="flex flex-col gap-1">
                    <strong>{t}</strong>
                    <span className="text-sm text-ink-3">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <section className="flex flex-col gap-4 rounded-2xl border border-ember/50 bg-card p-6">
              <h2 className="m-0 text-xl">Step 1 · Create the GitHub App</h2>
              <CreateAppForm />
            </section>
            {missing.length < 3 && (
              <p className="m-0 rounded-xl border border-sev-med/40 bg-sev-med/[0.07] p-4 text-sm text-[#ffe0ad]">
                Some keys are already set, but these are still missing:{" "}
                {missing.map((m) => (
                  <code key={m} className="mx-1 font-mono">
                    {m}
                  </code>
                ))}
                . Add them in Vercel and redeploy.
              </p>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
