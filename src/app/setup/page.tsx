import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CreateAppForm } from "@/components/setup/CreateAppForm";
import { Icon } from "@/components/ui/Icon";
import { CopyBlock } from "@/components/setup/CopyBlock";
import { CALLBACK_PATH, getConfig, missingEnv } from "@/server/config";
import { checkSetup, type SetupCheck } from "@/server/github";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Connect GitHub", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const config = getConfig();
  const missing = missingEnv();
  const checks: SetupCheck[] = config ? await checkSetup(config) : [];
  const h = await headers();
  const origin = config?.appUrl ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const allOk = checks.length > 0 && checks.every((c) => c.ok === true);
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
          <section className={`flex flex-col gap-5 rounded-2xl border p-6 ${allOk ? "border-banished/40 bg-banished/[0.06]" : "border-sev-med/40 bg-card"}`}>
            <h2 className="m-0 flex items-center gap-2 text-xl">
              <span className={allOk ? "text-banished" : "text-sev-med"}>
                <Icon name={allOk ? "check" : "alert"} size={22} />
              </span>
              {allOk ? "GitHub is connected" : "GitHub is configured, but something needs fixing"}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Setup checks">
              {checks.map((c) => (
                <li key={c.id} className="flex gap-3 text-[15px]">
                  <span className={`mt-0.5 flex-none ${c.ok === true ? "text-banished" : c.ok === false ? "text-sev-high" : "text-ink-3"}`}>
                    <Icon name={c.ok === true ? "check" : c.ok === false ? "close" : "alert"} size={18} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-ink">{c.label}</span>
                    {c.fix && <span className="text-sm text-ink-3">{c.fix}</span>}
                  </span>
                </li>
              ))}
              <li className="flex gap-3 text-[15px]">
                <span className="mt-0.5 flex-none text-ink-3">
                  <Icon name="alert" size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-ink">The app&apos;s Callback URL on GitHub must be exactly:</span>
                  <CopyBlock text={`${origin}${CALLBACK_PATH}`} label="CALLBACK URL" />
                  <span className="text-sm text-ink-3">
                    GitHub doesn&apos;t let this site read it, so check it yourself in{" "}
                    <a href={`https://github.com/settings/apps/${config.slug}`} target="_blank" rel="noreferrer">
                      the app&apos;s settings
                    </a>
                    .
                  </span>
                </span>
              </li>
            </ul>
            {!allOk && <p className="m-0 text-sm text-ink-3">After changing a variable in Vercel, redeploy, then reload this page.</p>}
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
