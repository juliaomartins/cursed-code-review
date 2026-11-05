"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useReview } from "@/providers/ReviewProvider";
import { postReviewLive } from "@/lib/githubLive";
import { toReviewComments } from "@/lib/report";
import { reviewStats } from "@/lib/review/selectors";
import type { Review } from "@/lib/types";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

type Event = "COMMENT" | "REQUEST_CHANGES" | "APPROVE";

export function PostReviewDialog({ open, onClose, review }: { open: boolean; onClose: () => void; review: Review }) {
  const { user, requestSignIn, mode } = useAuth();
  const { dispatch } = useReview();
  const { toast } = useToast();
  const stats = reviewStats(review);
  const comments = useMemo(() => toReviewComments(review), [review]);
  const hasHighLurking = review.files.some((f) => f.findings.some((x) => x.status === "lurking" && x.severity === "HIGH"));
  const [chosen, setEvent] = useState<Event>(hasHighLurking ? "REQUEST_CHANGES" : stats.lurking === 0 ? "APPROVE" : "COMMENT");
  // GitHub only allows "Comment" on a pull request you opened yourself.
  const ownPr = review.source.kind === "pr" && !!user && review.source.author.toLowerCase() === user.login.toLowerCase();
  const event: Event = ownPr ? "COMMENT" : chosen;
  const [body, setBody] = useState(
    stats.lurking === 0
      ? `The crypt is clear. ${stats.banished} monster${stats.banished === 1 ? "" : "s"} banished with suggested fixes below.`
      : `Found ${stats.total} monster${stats.total === 1 ? "" : "s"}. ${stats.lurking} still lurk${stats.lurking === 1 ? "s" : ""} in the code. Suggested fixes are inline.`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posted = review.postedReviewUrl;
  if (review.source.kind !== "pr") return null;
  const src = review.source;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!src.headSha) throw new Error("This review was opened before the PR's commit was known. Open the PR again from the home page.");
      const res = await postReviewLive({ ref: { owner: src.owner, repo: src.repo, number: src.number }, event, body, comments, commitId: src.headSha });
      const { url, inline } = res;
      dispatch({ type: "posted", url });
      toast({ title: "Review posted", description: `${inline} inline comment${inline === 1 ? "" : "s"} on ${src.label}.`, tone: "success" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const OWN = "GitHub doesn't allow this on a pull request you opened yourself.";
  const options: { v: Event; label: string; hint: string; disabled?: boolean }[] = [
    { v: "COMMENT", label: "Comment", hint: "Leave feedback without a verdict." },
    { v: "REQUEST_CHANGES", label: "Request changes", hint: ownPr ? OWN : "Block merging until the monsters are gone.", disabled: ownPr },
    {
      v: "APPROVE",
      label: "Approve",
      hint: ownPr ? OWN : stats.lurking ? "Banish or ignore every monster first." : "The crypt is clear. Ship it.",
      disabled: ownPr || stats.lurking > 0,
    },
  ];

  const footer =
    !posted && user ? (
      <>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} loading={busy} disabled={!body.trim()}>
          <Icon name="pr" />
          {busy ? "Posting…" : `Post ${event === "APPROVE" ? "approval" : event === "REQUEST_CHANGES" ? "change request" : "review"}`}
        </Button>
      </>
    ) : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={busy}
      title="Post review to GitHub"
      description={`${src.label} · ${src.title}`}
      className="max-w-xl"
      footer={footer}
    >
      {posted ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-banished/15 text-banished">
            <Icon name="check" size={28} />
          </span>
          <p className="m-0 text-lg font-bold">Your review is on the pull request.</p>
          <a href={posted} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium">
            View review on GitHub <Icon name="external" size={16} />
          </a>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : mode !== "live" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="m-0 text-[15px] text-ink-2">Posting reviews to GitHub needs GitHub sign-in, which isn&apos;t available on this site yet.</p>
          <p className="m-0 text-sm text-ink-3">You can still export the report as Markdown and paste it into the pull request.</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : !user ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="m-0 text-[15px] text-ink-2">Sign in with GitHub to post your findings as an inline review.</p>
          <Button variant="primary" onClick={requestSignIn} data-autofocus>
            <Icon name="github" />
            Sign in with GitHub
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-sm font-medium text-ink-2">Review type</legend>
            {ownPr && (
              <p className="m-0 mb-1 text-[13px] text-ink-3">
                This is your own pull request, so GitHub only allows a <strong>Comment</strong>. The suggested fixes are still posted inline.
              </p>
            )}
            {options.map((o) => (
              <label
                key={o.v}
                className={cx(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  event === o.v ? "border-ember bg-ember/[0.07]" : "border-line hover:border-line-strong",
                  o.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="event"
                  value={o.v}
                  checked={event === o.v}
                  disabled={o.disabled}
                  onChange={() => setEvent(o.v)}
                  className="mt-1 accent-[#FF8A3D]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold">{o.label}</span>
                  <span className="text-[13px] text-ink-3">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2">
            <label htmlFor="review-body" className="text-sm font-medium text-ink-2">
              Summary
            </label>
            <textarea
              id="review-body"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-[10px] border border-line-strong bg-well p-3 text-sm text-ink focus:border-ember"
            />
          </div>
          <details className="rounded-xl border border-line bg-well/50">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">
              {comments.length} inline comment{comments.length === 1 ? "" : "s"} will be posted
            </summary>
            <ul className="m-0 flex max-h-60 list-none flex-col gap-3 overflow-y-auto border-t border-line p-3">
              {comments.map((c) => (
                <li key={`${c.path}:${c.line}`} className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-ember-soft">
                    {c.path}:{c.startLine ? `${c.startLine}-` : ""}
                    {c.line}
                  </span>
                  <pre className="m-0 font-mono text-xs whitespace-pre-wrap text-ink-2">{c.body}</pre>
                </li>
              ))}
            </ul>
          </details>
          {error && (
            <p role="alert" className="m-0 flex gap-2 text-[13px] text-sev-high">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
