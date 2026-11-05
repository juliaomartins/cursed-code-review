"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useReview } from "@/providers/ReviewProvider";
import { GitHubError } from "@/lib/github";
import { createIssueLive } from "@/lib/githubLive";
import { toIssue } from "@/lib/report";
import type { Review } from "@/lib/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

export function CreateIssueDialog({ open, onClose, review }: { open: boolean; onClose: () => void; review: Review }) {
  const { user, requestSignIn, mode, installApp } = useAuth();
  const { dispatch } = useReview();
  const { toast } = useToast();
  const draft = useMemo(() => toIssue(review), [review]);
  const [title, setTitle] = useState(draft.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  if (review.source.kind !== "github") return null;
  const src = review.source;
  const created = review.postedReviewUrl;
  const monsters = review.files.flatMap((f) => f.findings).filter((f) => f.status !== "ignored").length;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const issue = await createIssueLive({ owner: src.owner, repo: src.repo, title, body: draft.body });
      dispatch({ type: "posted", url: issue.url });
      toast({ title: `Issue #${issue.number} created`, description: `${monsters} monsters listed on ${src.owner}/${src.repo}.`, tone: "success" });
    } catch (e) {
      setError({ message: (e as Error).message, code: e instanceof GitHubError ? e.code : undefined });
    } finally {
      setBusy(false);
    }
  };

  const footer =
    !created && mode === "live" && user ? (
      <>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} loading={busy} disabled={!title.trim() || monsters === 0}>
          <Icon name="github" />
          {busy ? "Creating…" : "Create issue"}
        </Button>
      </>
    ) : undefined;

  return (
    <Dialog open={open} onClose={onClose} locked={busy} title="Create a GitHub issue" description={`On ${src.owner}/${src.repo}`} className="max-w-xl" footer={footer}>
      {created ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-banished/15 text-banished">
            <Icon name="check" size={28} />
          </span>
          <p className="m-0 text-lg font-bold">The issue is on GitHub.</p>
          <a href={created} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium">
            View the issue <Icon name="external" size={16} />
          </a>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : mode !== "live" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="m-0 text-[15px] text-ink-2">Creating issues needs GitHub sign-in, which isn&apos;t available on this site yet.</p>
          <p className="m-0 text-sm text-ink-3">You can export the report as Markdown and paste it into a new issue yourself.</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : !user ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="m-0 text-[15px] text-ink-2">Sign in with GitHub to create the issue as you.</p>
          <Button variant="primary" onClick={requestSignIn} data-autofocus>
            <Icon name="github" />
            Sign in with GitHub
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {monsters === 0 && <p className="m-0 text-sm text-ink-3">Every monster was ignored, so there&apos;s nothing to report.</p>}
          <div className="flex flex-col gap-2">
            <label htmlFor="issue-title" className="text-sm font-medium text-ink-2">
              Title
            </label>
            <input
              id="issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={256}
              className="min-h-[46px] rounded-[10px] border border-line-strong bg-well px-3 text-sm text-ink focus:border-ember"
            />
          </div>
          <details className="rounded-xl border border-line bg-well/50">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
              Preview: {monsters} monster{monsters === 1 ? "" : "s"} as a checklist, with links and fixes
            </summary>
            <pre className="m-0 max-h-72 overflow-auto border-t border-line p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">{draft.body}</pre>
          </details>
          <p className="m-0 text-[13px] text-ink-3">Ignored monsters are left out. Banished ones are marked &ldquo;fix ready&rdquo;, since the fix was only applied here, not in the repository.</p>
          {error && (
            <div role="alert" className="flex flex-col gap-2 rounded-[10px] border border-sev-high/40 bg-sev-high/[0.07] p-3 text-[13px] text-[#ffc9c2]">
              <span className="flex gap-2">
                <Icon name="alert" size={16} className="mt-px flex-none text-sev-high" /> {error.message}
              </span>
              {error.code === "not_installed" && (
                <Button size="sm" variant="outline" onClick={installApp} className="self-start">
                  <Icon name="github" size={16} /> Install on this repository
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
