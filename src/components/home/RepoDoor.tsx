"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { GitHubError, type InstallationSummary, type PullSummary, type RepoSummary } from "@/lib/github";
import { listPullsLive, listReposLive, scanLinkLive } from "@/lib/githubLive";
import { reviewFromPullRequest, reviewFromScan } from "@/lib/review/factory";
import type { Review } from "@/lib/types";
import { MateklamarMark } from "../brand/MateklamarMark";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";

type Build = () => Review;
export type OnLoaded = (build: Build, steps: string[], multi: boolean) => void;

const card = "codex-frame box-border flex flex-col gap-3 rounded-2xl border border-line bg-card p-6";
const field =
  "box-border w-full min-h-[46px] rounded-[10px] border border-line-strong bg-well px-3 text-sm text-ink transition-colors hover:border-ink-4 focus:border-ember";

/** "3m ago", "2h ago", "5d ago", or a date. */
export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Matches "play", "juliaomartins/play", or words from the description. */
export function filterRepos(repos: RepoSummary[], query: string): RepoSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return repos;
  return repos.filter((r) => r.fullName.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q));
}

export function filterPulls(pulls: PullSummary[], query: string): PullSummary[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return pulls;
  return pulls.filter(
    (p) => String(p.number) === q || p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q) || p.headRef.toLowerCase().includes(q),
  );
}

/** The GitHub door for signed-in users: pick a repository, then the whole repo or one of its open PRs. */
export function RepoDoor({ onLoaded, disabled }: { onLoaded: OnLoaded; disabled: boolean }) {
  const { user, hydrated, requestSignIn } = useAuth();
  if (!hydrated) return <div className={cx(card, "skeleton min-h-[420px]")} aria-busy="true" aria-label="Loading GitHub" />;
  if (!user) return <SignInCard onSignIn={requestSignIn} />;
  return <RepoPicker key={user.login} onLoaded={onLoaded} disabled={disabled} />;
}

function SignInCard({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className={cx(card, "items-center gap-4 text-center")}>
      <h3 className="m-0 self-stretch text-left text-[21px]">Bring your code from GitHub</h3>
      <MateklamarMark size={84} />
      <p className="m-0 max-w-[300px] text-[15px] leading-relaxed text-ink-2">Sign in to see your repositories, open pull requests, and send fixes back.</p>
      <Button variant="ember-outline" onClick={onSignIn} className="min-h-12 self-stretch">
        <Icon name="github" />
        Sign in with GitHub
      </Button>
      <p className="m-0 text-[13px] text-ink-3">Samples and pasted code work without it.</p>
    </div>
  );
}

function RepoPicker({ onLoaded, disabled }: { onLoaded: OnLoaded; disabled: boolean }) {
  const id = useId();
  const { installApp, requestSignIn } = useAuth();
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [installs, setInstalls] = useState<InstallationSummary[]>([]);
  const [error, setError] = useState<GitHubError | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<RepoSummary | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const res = await listReposLive(signal);
      setRepos(res.repos);
      setInstalls(res.installations);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof GitHubError ? e : new GitHubError("Couldn't load your repositories.", "network"));
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the repository list once signed in
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  if (picked) return <RepoPanel repo={picked} onBack={() => setPicked(null)} onLoaded={onLoaded} disabled={disabled} />;

  const shown = repos ? filterRepos(repos, query) : [];
  const allAccess = installs.length > 0 && installs.every((i) => i.selection === "all");

  return (
    <div className={card}>
      <h3 className="m-0 font-display text-[26px] font-semibold">Bring your code from GitHub</h3>
      <p className="m-0 text-[15px] text-ink-3">Pick a repository, then scan all of it or one of its pull requests.</p>
      <label htmlFor={`${id}-q`} className="sr-only">
        Search your repositories
      </label>
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-4" />
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your repositories…"
          autoComplete="off"
          className={cx(field, "pl-9")}
        />
      </div>

      {error ? (
        <div role="alert" className="flex flex-col gap-2 rounded-[10px] border border-sev-high/40 bg-sev-high/[0.07] p-3 text-[13px] text-[#ffc9c2]">
          <span className="flex gap-2">
            <Icon name="alert" size={16} className="mt-px flex-none text-sev-high" /> {error.message}
          </span>
          <span className="flex flex-wrap gap-2">
            {error.code === "auth_required" ? (
              <Button size="sm" variant="outline" onClick={requestSignIn}>
                <Icon name="github" size={16} /> Sign in again
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => load()}>
                <Icon name="refresh" size={16} /> Try again
              </Button>
            )}
          </span>
        </div>
      ) : !repos ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-busy="true" aria-label="Loading repositories">
          {[0, 1, 2].map((i) => (
            <li key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </ul>
      ) : (
        <ul className="scrollbar-thin m-0 flex max-h-[296px] list-none flex-col gap-1.5 overflow-y-auto p-0 pr-1" aria-label="Your repositories">
          {shown.map((r) => (
            <li key={r.fullName}>
              <button
                type="button"
                onClick={() => setPicked(r)}
                disabled={disabled}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-well/60 px-3 py-2 text-left transition-colors hover:border-ember/60 hover:bg-[#292B35] disabled:opacity-60"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 truncate font-mono text-sm text-ink">
                    {r.private && <span className="sr-only">Private repository </span>}
                    {r.name}
                    {r.private && (
                      <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        className="flex-none text-ink-3"
                      >
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate text-xs text-ink-3">
                    {r.owner} · {[r.language, timeAgo(r.pushedAt)].filter(Boolean).join(" · ")}
                    {r.archived ? " · archived" : ""}
                  </span>
                </span>
                <Icon name="arrowRight" size={16} className="flex-none text-ink-4" />
              </button>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-ink-2">
              {repos.length === 0 ? "The app can't see any repositories yet." : `No repository matches “${query}”.`}
            </li>
          )}
        </ul>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-[13px] text-ink-3">{allAccess ? "The app can see all your repositories." : "Not here?"}</span>
        <Button size="sm" variant={repos && (shown.length === 0 || repos.length === 0) ? "ember-outline" : "ghost"} onClick={installApp}>
          <Icon name="github" size={16} />
          {allAccess ? "Manage access" : "Import a repository"}
        </Button>
      </div>
    </div>
  );
}

function RepoPanel({ repo, onBack, onLoaded, disabled }: { repo: RepoSummary; onBack: () => void; onLoaded: OnLoaded; disabled: boolean }) {
  const id = useId();
  const { installApp } = useAuth();
  const [pulls, setPulls] = useState<PullSummary[] | null>(null);
  const [pullsError, setPullsError] = useState<GitHubError | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<GitHubError | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const c = new AbortController();
    listPullsLive(repo.owner, repo.name, c.signal)
      .then(setPulls)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setPullsError(e instanceof GitHubError ? e : new GitHubError("Couldn't load pull requests.", "network"));
      });
    return () => {
      c.abort();
      abort.current?.abort();
    };
  }, [repo.owner, repo.name]);

  const open = async (what: "repo" | number) => {
    setBusy(String(what));
    setError(null);
    abort.current = new AbortController();
    const url = what === "repo" ? `https://github.com/${repo.fullName}` : `https://github.com/${repo.fullName}/pull/${what}`;
    try {
      const res = await scanLinkLive(url, abort.current.signal);
      if (res.target === "pr") {
        const pr = res.pr;
        onLoaded(
          () => reviewFromPullRequest(pr),
          [`Fetched ${pr.owner}/${pr.repo}#${pr.number}`, "Scanning changed lines only", "Writing explanations and fixes", "Summoning monsters"],
          false,
        );
      } else {
        const n = res.files.length;
        onLoaded(
          () => reviewFromScan(res),
          [
            `Fetched ${n} file${n === 1 ? "" : "s"} from ${res.owner}/${res.repo}`,
            "Running 7 static checks on every line",
            "Writing explanations and fixes",
            "Drawing the Haunted Map",
          ],
          true,
        );
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof GitHubError ? e : new GitHubError("Couldn't reach GitHub. Try again.", "network"));
    } finally {
      setBusy(null);
    }
  };

  const shown = useMemo(() => (pulls ? filterPulls(pulls, query) : []), [pulls, query]);

  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to your repositories"
          className="-ml-2 inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink"
        >
          <Icon name="arrowLeft" size={18} />
        </button>
        <h3 className="m-0 min-w-0 truncate font-mono text-[17px]" title={repo.fullName}>
          {repo.fullName}
        </h3>
        {repo.private && <span className="flex-none rounded-full bg-chip px-2 py-0.5 text-[11px] text-ink-2">private</span>}
      </div>

      <button
        type="button"
        onClick={() => open("repo")}
        disabled={disabled || busy !== null}
        className="flex min-h-16 items-center gap-3 rounded-xl border border-ember/60 bg-ember/[0.06] px-4 py-3 text-left transition-colors hover:bg-ember/[0.12] disabled:opacity-60"
      >
        <span className="text-ember">{busy === "repo" ? <Spinner size={20} /> : <Icon name="search" size={20} />}</span>
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-bold text-ink">Whole repository</span>
          <span className="text-xs text-ink-3">{repo.defaultBranch} · up to 40 files · opens the Haunted Map</span>
        </span>
        <Icon name="arrowRight" size={16} className="text-ink-4" />
      </button>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <h4 className="m-0 font-mono text-[11px] font-normal tracking-[0.14em] text-ink-3">OPEN PULL REQUESTS{pulls ? ` · ${pulls.length}` : ""}</h4>
      </div>
      {pulls && pulls.length > 5 && (
        <>
          <label htmlFor={`${id}-pq`} className="sr-only">
            Search pull requests
          </label>
          <input
            id={`${id}-pq`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, number, author or branch…"
            className={field}
          />
        </>
      )}

      {pullsError ? (
        <div role="alert" className="flex flex-col gap-2 rounded-[10px] border border-sev-high/40 bg-sev-high/[0.07] p-3 text-[13px] text-[#ffc9c2]">
          {pullsError.message}
          {pullsError.code === "not_installed" && (
            <Button size="sm" variant="outline" onClick={installApp} className="self-start">
              <Icon name="github" size={16} /> Import this repository
            </Button>
          )}
        </div>
      ) : !pulls ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-busy="true" aria-label="Loading pull requests">
          {[0, 1].map((i) => (
            <li key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </ul>
      ) : pulls.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-ink-2">No open pull requests.</p>
      ) : (
        <ul className="scrollbar-thin m-0 flex max-h-[240px] list-none flex-col gap-1.5 overflow-y-auto p-0 pr-1" aria-label="Open pull requests">
          {shown.map((p) => (
            <li key={p.number}>
              <button
                type="button"
                onClick={() => open(p.number)}
                disabled={disabled || busy !== null}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-well/60 px-3 py-2 text-left transition-colors hover:border-ember/60 hover:bg-[#292B35] disabled:opacity-60"
              >
                <span className="flex-none font-mono text-sm text-ink-3">#{p.number}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-ink">{p.title}</span>
                  <span className="truncate text-xs text-ink-3">
                    @{p.author} · {p.headRef} · {timeAgo(p.updatedAt)}
                  </span>
                </span>
                {p.draft && <span className="flex-none rounded-full bg-chip px-2 py-0.5 text-[11px] text-ink-2">draft</span>}
                {busy === String(p.number) ? <Spinner size={16} /> : <Icon name="arrowRight" size={16} className="flex-none text-ink-4" />}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="p-3 text-center text-sm text-ink-3">No pull request matches “{query}”.</li>}
        </ul>
      )}

      {error && (
        <p role="alert" className="m-0 flex gap-2 text-[13px] text-sev-high">
          <Icon name="alert" size={16} className="mt-px flex-none" /> {error.message}
        </p>
      )}
    </div>
  );
}
