"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { Monster } from "../Monster";

const SCOPES = [
  { title: "Read pull requests", detail: "Fetch the changed files of PRs you open in the crypt." },
  { title: "Write review comments", detail: "Post your findings back as an inline review, only when you ask." },
  { title: "Only the repositories you choose", detail: "You pick them when you install the app. Change them any time on GitHub." },
];

export function SignInDialog() {
  const { signInOpen, closeSignIn, completeSignIn, mode } = useAuth();
  const live = mode === "live";
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const authorize = async () => {
    setBusy(true);
    if (live) {
      void completeSignIn(); // navigates to GitHub
      return;
    }
    const user = await completeSignIn();
    setBusy(false);
    toast({ title: `Signed in as @${user.login}`, description: "Private repos and review posting are unlocked.", tone: "success" });
  };

  return (
    <Dialog open={signInOpen} onClose={closeSignIn} locked={busy} title="Sign in with GitHub" description={live ? "You'll continue on github.com. We never see your password." : "Demo mode. No real GitHub account is contacted."}
      footer={
        <>
          <Button variant="ghost" onClick={closeSignIn} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={authorize} loading={busy} data-autofocus>
            <Icon name="github" />
            {live ? (busy ? "Opening GitHub…" : "Continue to GitHub") : busy ? "Authorizing…" : "Authorize"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-center gap-4 py-2">
          <Monster kind="wraith" size={56} />
          <span className="flex gap-1 text-ink-4" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line-strong bg-well text-ink">
            <Icon name="github" size={28} />
          </span>
        </div>
        <p className="m-0 text-center text-[15px] text-ink-2">
          <strong className="text-ink">Cursed Code Review</strong> would like to:
        </p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {SCOPES.map((s) => (
            <li key={s.title} className="flex gap-3 rounded-xl border border-line bg-well/60 p-3">
              <span className="mt-0.5 text-banished">
                <Icon name="check" size={18} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold">{s.title}</span>
                <span className="text-[13px] text-ink-3">{s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
