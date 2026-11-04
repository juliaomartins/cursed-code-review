import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CopyBlock } from "@/components/setup/CopyBlock";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ApiError, convertManifest, type CreatedApp } from "@/server/github";

export const metadata: Metadata = { title: "Copy your GitHub keys", robots: { index: false } };
export const dynamic = "force-dynamic";

/** GitHub redirects here with a one-time ?code after "Create GitHub App". */
export default async function SetupCompletePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  let app: CreatedApp | null = null;
  let error: string | null = null;
  if (!code) error = "This page needs the link GitHub sends you back with. Start the setup again.";
  else {
    try {
      app = await convertManifest(code);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't reach GitHub to finish the setup. Start again.";
    }
  }

  const env = app ? `GITHUB_APP_CLIENT_ID=${app.clientId}\nGITHUB_APP_CLIENT_SECRET=${app.clientSecret}\nGITHUB_APP_SLUG=${app.slug}` : "";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto box-border flex w-full max-w-[760px] flex-col gap-7 px-4 pt-8 pb-24 sm:px-7">
        {!app ? (
          <section className="flex flex-col items-start gap-4 rounded-2xl border border-sev-high/40 bg-sev-high/[0.06] p-6">
            <h1 className="m-0 font-display text-4xl">Setup didn&apos;t finish</h1>
            <p className="m-0 text-ink-2">{error}</p>
            <ButtonLink href="/setup" variant="primary">
              Start again
            </ButtonLink>
          </section>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2 font-mono text-xs tracking-[0.16em] text-banished">
                <Icon name="check" size={16} /> GITHUB APP CREATED · {app.name.toUpperCase()}
              </span>
              <h1 className="m-0 font-display text-5xl leading-none">Copy your keys into Vercel</h1>
              <p className="m-0 rounded-xl border border-sev-med/40 bg-sev-med/[0.07] p-3 text-sm text-[#ffe0ad]">
                These keys are shown only once and are not saved anywhere. Keep this tab open until step 3 is done, and don&apos;t share them.
              </p>
            </div>

            <section className="flex flex-col gap-4 rounded-2xl border border-ember/50 bg-card p-6">
              <h2 className="m-0 text-xl">Step 2 · Copy all three keys</h2>
              <CopyBlock text={env} label="ENVIRONMENT VARIABLES" big />
            </section>

            <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6">
              <h2 className="m-0 text-xl">Step 3 · Paste into Vercel and redeploy</h2>
              <ol className="m-0 flex flex-col gap-3 pl-5 text-[15px] leading-relaxed text-ink-2">
                <li>
                  Open{" "}
                  <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">
                    vercel.com
                  </a>
                  , pick this project, then <strong>Settings → Environment Variables</strong>.
                </li>
                <li>
                  Click inside the first <strong>Key</strong> box and paste (<kbd className="font-mono">Ctrl+V</kbd> or <kbd className="font-mono">⌘V</kbd>).
                  Vercel splits the block into three rows by itself.
                </li>
                <li>
                  Leave <strong>Production</strong> ticked and click <strong>Save</strong>.
                </li>
                <li>
                  Open <strong>Deployments</strong>, click <strong>⋯</strong> on the newest one, then <strong>Redeploy</strong>.
                </li>
              </ol>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-6">
              <h2 className="m-0 text-xl">Step 4 · Check it</h2>
              <p className="m-0 text-[15px] text-ink-2">
                When the redeploy finishes, open <Link href="/setup">/setup</Link>. It should say <strong>GitHub is connected</strong>, and{" "}
                <strong>Sign in with GitHub</strong> appears in the header. The first time you sign in, GitHub asks which repositories the app may read.
              </p>
            </section>

            <details className="rounded-2xl border border-line bg-card p-5 text-sm text-ink-3">
              <summary className="cursor-pointer text-ink-2">Prefer to add them one by one?</summary>
              <div className="mt-4 flex flex-col gap-4">
                <CopyBlock text={app.clientId} label="GITHUB_APP_CLIENT_ID" />
                <CopyBlock text={app.clientSecret} label="GITHUB_APP_CLIENT_SECRET" />
                <CopyBlock text={app.slug} label="GITHUB_APP_SLUG" />
                <p className="m-0">
                  Your app on GitHub: <a href={app.htmlUrl}>{app.htmlUrl}</a>
                </p>
              </div>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
