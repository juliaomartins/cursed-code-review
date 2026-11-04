import { GitHubError, type PostReviewInput, type PrRef, type PullRequest } from "./github";

/** Browser-side client for the app's own /api/github routes (real GitHub mode). */
async function call<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new GitHubError("Could not reach the server. Check your connection and try again.", "network");
  }
  const data = (await res.json().catch(() => ({}))) as { code?: GitHubError["code"]; message?: string; installUrl?: string };
  if (!res.ok) throw new GitHubError(data.message ?? "Something went wrong talking to GitHub.", data.code ?? "network", data.installUrl);
  return data as T;
}

export function fetchPullRequestLive(ref: PrRef, signal?: AbortSignal): Promise<PullRequest> {
  const url = `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
  return call<PullRequest>(`/api/github/pr?url=${encodeURIComponent(url)}`, { signal });
}

export interface PostedReview {
  url: string;
  inline: number;
  folded: number;
}

export function postReviewLive(input: PostReviewInput & { commitId: string }): Promise<PostedReview> {
  return call<PostedReview>("/api/github/review", {
    method: "POST",
    body: JSON.stringify({ ...input.ref, commitId: input.commitId, event: input.event, body: input.body, comments: input.comments }),
  });
}

export function signInUrl(returnTo: string, install = false): string {
  const p = new URLSearchParams({ returnTo });
  if (install) p.set("install", "1");
  return `/api/auth/github/login?${p}`;
}
