"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useReview } from "@/providers/ReviewProvider";
import { changedFiles, defaultBranchName, fixDestination, fixPrBody, fixPrTitle, sha256Hex } from "@/lib/fixes";
import { GitHubError } from "@/lib/github";
import { pushFixesLive, type PushedFixes } from "@/lib/githubLive";
import type { Review } from "@/lib/types";
import { Monster } from "../Monster";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

export function ApplyFixesDialog({ open, onClose, review }: { open: boolean; onClose: () => void; review: Review }) {
  const { user, requestSignIn, mode, installApp } = useAuth();
  const { dispatch } = useReview();
  const { toast } = useToast();
  const dest = fixDestination(review);
  const changed = useMemo(() => changedFiles(review), [review]);
  const [branch, setBranch] = useState(() => defaultBranchName(review));
  const [title, setTitle] = useState(() => fixPrTitle(review));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string; url?: string } | null>(null);
  const [result, setResult] = useState<PushedFixes | null>(null);
  const fixes = changed.reduce((n, c) => n + c.fixes.length, 0);
  const isPr = dest.mode === "prBranch";

  const submit = async () => {
    if (!dest.mode) return;
    setBusy(true);
    setError(null);
    try {
      const files = await Promise.all(
        changed.map(async ({ file, message }) => ({ path: file.path, content: file.code, originalHash: await sha256Hex(file.originalCode), message })),
      );
      const res = await pushFixesLive({
        owner: dest.owner,
        repo: dest.repo,
        files,
        target:
          dest.mode === "prBranch"
            ? { kind: "prBranch", number: dest.number, headSha: dest.headSha }
            : { kind: "newBranch", baseSha: dest.baseSha, baseBranch: dest.baseBranch, branch: branch.trim(), title: title.trim(), body: fixPrBody(review) },
      });
      setResult(res);
      dispatch({ type: "fixesPushed", url: res.url });
      toast({
        title: isPr ? "Fixes pushed to the pull request" : "Fix pull request opened",
        description: `${res.commits} commit${res.commits === 1 ? "" : "s"} on ${res.branch}.`,
        tone: "success",
      });
    } catch (e) {
      setError({
        message: (e as Error).message,
        code: e instanceof GitHubError ? e.code : undefined,
        url: e instanceof GitHubError ? e.installUrl : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const ready = dest.mode && mode === "live" && user && !result && !review.fixesUrl;
  const footer = ready ? (
    <>
      <Button variant="ghost" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button variant="primary" onClick={submit} loading={busy} disabled={!changed.length || (!isPr && (!branch.trim() || !title.trim()))}>
        <Icon name="pr" />
        {busy ? "Committing…" : isPr ? `Push ${changed.length} commit${changed.length === 1 ? "" : "s"}` : "Open fix pull request"}
      </Button>
    </>
  ) : undefined;

  const where = dest.mode ? `${dest.owner}/${dest.repo}` : "";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={busy}
      title={isPr ? "Push fixes to the pull request" : "Open a fix pull request"}
      description={
        dest.mode === "prBranch"
          ? `${where}#${dest.number} · branch ${dest.branch}`
          : dest.mode === "newBranch"
            ? `${where} · into ${dest.baseBranch}`
            : undefined
      }
      className="max-w-xl"
      footer={footer}
    >
      {!result && review.fixesUrl ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="m-0 text-[15px] text-ink-2">
            {isPr ? "Your fixes are already on this pull request." : "You already opened a fix pull request for this scan."}
          </p>
          <a href={review.fixesUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium">
            View on GitHub <Icon name="external" size={16} />
          </a>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : result ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-banished/15 text-banished">
            <Icon name="check" size={28} />
          </span>
          <p className="m-0 text-lg font-bold">{isPr ? "The pull request has your fixes." : "Your fix pull request is open."}</p>
          <p className="m-0 text-sm text-ink-3">
            {result.commits} commit{result.commits === 1 ? "" : "s"} on <span className="font-mono">{result.branch}</span>
          </p>
          {result.skipped.length > 0 && (
            <ul className="m-0 list-none p-0 text-left text-[13px] text-sev-med">
              {result.skipped.map((s) => (
                <li key={s.path}>
                  Skipped <span className="font-mono">{s.path}</span>: {s.reason}
                </li>
              ))}
            </ul>
          )}
          <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium">
            View on GitHub <Icon name="external" size={16} />
          </a>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : !dest.mode ? (
        <p className="m-0 py-4 text-center text-[15px] text-ink-2">{dest.reason}</p>
      ) : mode !== "live" ? (
        <p className="m-0 py-4 text-center text-[15px] text-ink-2">
          Changing code on GitHub needs GitHub sign-in, which isn&apos;t available on this site yet. Export the report&apos;s patch instead.
        </p>
      ) : !user ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="m-0 text-[15px] text-ink-2">Sign in with GitHub to commit the fixes as you.</p>
          <Button variant="primary" onClick={requestSignIn} data-autofocus>
            <Icon name="github" /> Sign in with GitHub
          </Button>
        </div>
      ) : !changed.length ? (
        <p className="m-0 py-4 text-center text-[15px] text-ink-2">Nothing to commit yet. Banish some monsters in the crypt first.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Commits">
            {changed.map(({ file, fixes: f }) => (
              <li key={file.id} className="flex items-center gap-3 rounded-xl border border-line bg-well/50 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{file.path}</span>
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {Array.from(new Set(f.map((x) => x.kind)))
                    .slice(0, 4)
                    .map((k) => (
                      <Monster key={k} kind={k} size={24} glow={false} />
                    ))}
                </span>
                <span className="font-mono text-sm text-ember-soft">
                  {f.length} fix{f.length === 1 ? "" : "es"}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[13px] text-ink-3">
            One commit per file ({changed.length} commit{changed.length === 1 ? "" : "s"}, {fixes} fix{fixes === 1 ? "" : "es"}). A file that changed on GitHub
            since the scan is skipped, never overwritten.
          </p>
          {!isPr && (
            <>
              <div className="flex flex-col gap-2">
                <label htmlFor="fix-branch" className="text-sm font-medium text-ink-2">
                  New branch
                </label>
                <input
                  id="fix-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="min-h-[46px] rounded-[10px] border border-line-strong bg-well px-3 font-mono text-sm text-ink focus:border-ember"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="fix-title" className="text-sm font-medium text-ink-2">
                  Pull request title
                </label>
                <input
                  id="fix-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={256}
                  className="min-h-[46px] rounded-[10px] border border-line-strong bg-well px-3 text-sm text-ink focus:border-ember"
                />
              </div>
            </>
          )}
          {isPr && <p className="m-0 text-[13px] text-ink-3">The commits go straight onto the PR&apos;s branch, so the pull request updates in place.</p>}
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
              {error.code !== "not_installed" && error.url?.startsWith("https://github.com/") && (
                <a
                  href={error.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center gap-2 self-start rounded-[10px] border border-line-strong px-3 text-sm font-medium text-ink no-underline hover:border-ink-4 hover:text-ink"
                >
                  <Icon name="github" size={16} />
                  {error.code === "permission_not_accepted"
                    ? "Review the permission request"
                    : error.code === "repo_not_selected"
                      ? "Choose repositories"
                      : "Open the GitHub settings"}
                  <Icon name="external" size={14} />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
