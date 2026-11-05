"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** The GitHub App definition. GitHub pre-fills its "create app" form from this. */
export function buildManifest(origin: string) {
  return {
    name: "Cursed Code Review",
    url: origin,
    description: "A haunted code review: every bug is a monster on the line where it hides. Banish them to fix your pull requests.",
    redirect_url: `${origin}/setup/complete`,
    callback_urls: [`${origin}/api/auth/callback/github`],
    public: true,
    request_oauth_on_install: true,
    default_permissions: { contents: "read", pull_requests: "write", issues: "write", metadata: "read" },
    default_events: [],
  };
}

export function createAppUrl(org: string): string {
  const o = org.trim();
  return o ? `https://github.com/organizations/${encodeURIComponent(o)}/settings/apps/new` : "https://github.com/settings/apps/new";
}

/** Posts the manifest to GitHub, which shows a pre-filled "Create GitHub App" page. */
export function CreateAppForm() {
  const [origin, setOrigin] = useState("");
  const [org, setOrg] = useState("");
  const [useOrg, setUseOrg] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the deployment's own URL is only known in the browser
  useEffect(() => setOrigin(window.location.origin), []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!origin) e.preventDefault();
  };

  return (
    <form method="post" action={createAppUrl(useOrg ? org : "")} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="manifest" value={origin ? JSON.stringify(buildManifest(origin)) : ""} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-2">
        <input type="checkbox" checked={useOrg} onChange={(e) => setUseOrg(e.target.checked)} className="h-4 w-4 accent-[#FF8A3D]" />
        Create it under a GitHub organization instead of my personal account
      </label>
      {useOrg && (
        <div className="flex flex-col gap-2">
          <label htmlFor="org" className="text-sm font-medium text-ink-2">
            Organization name
          </label>
          <input
            id="org"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="my-org"
            required
            className="min-h-[46px] rounded-[10px] border border-line-strong bg-well px-3 text-sm text-ink focus:border-ember"
          />
        </div>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={!origin || (useOrg && !org.trim())} className="self-start">
        <Icon name="github" />
        Create the GitHub App
      </Button>
      <p className="m-0 text-[13px] text-ink-3">
        GitHub opens with every setting filled in. If the name is already taken, change it there, then click <strong>Create GitHub App</strong>.
      </p>
    </form>
  );
}
