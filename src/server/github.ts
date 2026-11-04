import "server-only";
import { SUPPORTED_EXTENSIONS, type PrFile, type PullRequest, type PrRef, type ReviewComment } from "@/lib/github";
import { parsePatch, rangeIsCommentable, type ParsedPatch } from "@/lib/patch";
import { languageFromPath, MAX_LINES } from "@/lib/scanner";
import type { GitHubAppConfig } from "./config";
import type { Session, SessionUser } from "./session";

const API = "https://api.github.com";
const MAX_FILES = 15;

/** An error with an HTTP status and a code the frontend understands. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public installUrl?: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

export interface GitHubDeps {
  fetch?: Fetch;
  now?: () => number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(config: GitHubAppConfig, params: Record<string, string>, deps: GitHubDeps): Promise<Omit<Session, "user">> {
  const f = deps.fetch ?? fetch;
  const res = await f("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) throw new ApiError(401, "auth_required", data.error_description ?? "GitHub did not accept the sign-in. Please try again.");
  const now = (deps.now ?? Date.now)();
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_in ? now + data.expires_in * 1000 : undefined };
}

export const exchangeCode = (config: GitHubAppConfig, code: string, redirectUri: string, deps: GitHubDeps = {}) =>
  tokenRequest(config, { code, redirect_uri: redirectUri }, deps);

/** Refreshes the user token when it is about to expire. Returns the session unchanged otherwise. */
export async function ensureFresh(config: GitHubAppConfig, session: Session, deps: GitHubDeps = {}): Promise<{ session: Session; refreshed: boolean }> {
  const now = (deps.now ?? Date.now)();
  if (!session.expiresAt || session.expiresAt - now > 60_000) return { session, refreshed: false };
  if (!session.refreshToken) throw new ApiError(401, "auth_required", "Your GitHub session expired. Sign in again.");
  const tokens = await tokenRequest(config, { grant_type: "refresh_token", refresh_token: session.refreshToken }, deps);
  return { session: { ...session, ...tokens }, refreshed: true };
}

async function gh<T>(token: string | undefined, path: string, init: RequestInit & { raw?: boolean } = {}, deps: GitHubDeps = {}): Promise<T> {
  const f = deps.fetch ?? fetch;
  const res = await f(`${API}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cursed-code-review",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (res.ok) return (init.raw ? await res.text() : await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as { message?: string; errors?: unknown[] };
  if (res.status === 401) throw new ApiError(401, "auth_required", "Your GitHub session is no longer valid. Sign in again.");
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0")
    throw new ApiError(
      429,
      "rate_limited",
      token ? "GitHub is rate limiting requests. Wait a minute and try again." : "GitHub's limit for anonymous requests was reached. Try again later.",
    );
  if (res.status === 403) throw new ApiError(403, "forbidden", body.message ?? "GitHub refused this request.");
  if (res.status === 404) throw new ApiError(404, "not_found", body.message ?? "Not found.");
  if (res.status === 422) {
    const detail = Array.isArray(body.errors) ? body.errors.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("; ") : "";
    throw new ApiError(422, "bad_request", [body.message, detail].filter(Boolean).join(": ") || "GitHub rejected the request.");
  }
  throw new ApiError(502, "network", `GitHub returned ${res.status}.`);
}

interface GhUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export async function getUser(token: string, deps: GitHubDeps = {}): Promise<SessionUser> {
  const u = await gh<GhUser>(token, "/user", {}, deps);
  return { login: u.login, name: u.name || u.login, avatarUrl: u.avatar_url };
}

interface GhPull {
  title: string;
  html_url: string;
  user: { login: string } | null;
  base: { ref: string };
  head: { ref: string; sha: string; repo: { full_name: string } | null };
}

interface GhFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

const enc = encodeURIComponent;
const repoPath = (ref: PrRef) => `/repos/${enc(ref.owner)}/${enc(ref.repo)}`;
const filePath = (p: string) => p.split("/").map(enc).join("/");

async function listFiles(token: string | undefined, ref: PrRef, deps: GitHubDeps): Promise<GhFile[]> {
  const out: GhFile[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await gh<GhFile[]>(token, `${repoPath(ref)}/pulls/${ref.number}/files?per_page=100&page=${page}`, {}, deps);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function rawFile(repoFullName: string, sha: string, path: string, deps: GitHubDeps): Promise<string> {
  const f = deps.fetch ?? fetch;
  const res = await f(`https://raw.githubusercontent.com/${repoFullName.split("/").map(enc).join("/")}/${enc(sha)}/${filePath(path)}`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, "network", `Couldn't download ${path}.`);
  return res.text();
}

const supported = (path: string) => SUPPORTED_EXTENSIONS.includes(path.split(".").pop()?.toLowerCase() ?? "");

export interface PrAccess {
  /** A GitHub token: the signed-in user's, or an optional server token for public repos. */
  token?: string;
  /** True when `token` belongs to the signed-in user (private repos the app is installed on). */
  asUser: boolean;
  /** True when this deployment has a GitHub App, so users could sign in. */
  signInAvailable: boolean;
}

/**
 * Loads a pull request and the files the crypt can scan.
 * Public repositories work without signing in; contents then come from raw.githubusercontent.com,
 * which does not count against GitHub's API rate limit.
 */
export async function getPullRequest(ref: PrRef, access: PrAccess, deps: GitHubDeps = {}): Promise<PullRequest> {
  const { token, asUser, signInAvailable } = access;
  const label = `${ref.owner}/${ref.repo}#${ref.number}`;
  let pull: GhPull;
  try {
    pull = await gh<GhPull>(token, `${repoPath(ref)}/pulls/${ref.number}`, {}, deps);
  } catch (e) {
    if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 403)) throw e;
    if (asUser)
      throw new ApiError(
        404,
        "not_installed",
        `Couldn't open ${label}. Either it doesn't exist, or Cursed Code Review isn't installed on that repository yet.`,
        "/api/auth/github/login?install=1",
      );
    if (signInAvailable)
      throw new ApiError(401, "auth_required", `Couldn't find ${label} as a public pull request. If the repository is private, sign in with GitHub.`);
    throw new ApiError(404, "not_found", `Couldn't find ${label}. Check the link. Only public repositories can be opened on this site right now.`);
  }
  const files = await listFiles(token, ref, deps);
  const candidates = files.filter((f) => f.status !== "removed" && f.patch && supported(f.filename));
  const headRepo = pull.head.repo?.full_name ?? `${ref.owner}/${ref.repo}`;
  const picked = candidates.slice(0, MAX_FILES);
  const loaded = await Promise.all(
    picked.map(async (f): Promise<PrFile | null> => {
      const code = await (asUser
        ? gh<string>(token, `/repos/${headRepo.split("/").map(enc).join("/")}/contents/${filePath(f.filename)}?ref=${enc(pull.head.sha)}`, { raw: true }, deps)
        : rawFile(headRepo, pull.head.sha, f.filename, deps)
      ).catch(() => null);
      if (code === null || code.split("\n").length > MAX_LINES) return null;
      return {
        path: f.filename,
        language: languageFromPath(f.filename),
        code,
        changedLines: parsePatch(f.patch).added,
        additions: f.additions,
        deletions: f.deletions,
      };
    }),
  );
  const prFiles = loaded.filter((f): f is PrFile => f !== null);
  if (!prFiles.length)
    throw new ApiError(422, "unsupported", "This pull request doesn't change any JavaScript, TypeScript, Python or PHP files the crypt can read.");
  return {
    ...ref,
    url: pull.html_url,
    title: pull.title,
    author: pull.user?.login ?? "ghost",
    baseRef: pull.base.ref,
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    files: prFiles,
    skippedFiles: files.length - prFiles.length,
  };
}

export interface CreateReviewInput {
  ref: PrRef;
  commitId: string;
  event: "COMMENT" | "REQUEST_CHANGES" | "APPROVE";
  body: string;
  comments: ReviewComment[];
}

/**
 * Splits comments into those GitHub will accept inline and those that must be folded into
 * the review body (lines outside the diff, or ranges that cross hunks).
 */
export function placeComments(comments: ReviewComment[], patches: Map<string, ParsedPatch>) {
  const inline: { path: string; line: number; start_line?: number; side: "RIGHT"; start_side?: "RIGHT"; body: string }[] = [];
  const folded: ReviewComment[] = [];
  for (const c of comments) {
    const p = patches.get(c.path);
    if (!p) {
      folded.push(c);
      continue;
    }
    if (c.startLine && c.startLine < c.line && rangeIsCommentable(p, c.startLine, c.line)) {
      inline.push({ path: c.path, line: c.line, start_line: c.startLine, side: "RIGHT", start_side: "RIGHT", body: c.body });
    } else if (p.commentable.has(c.line)) {
      inline.push({
        path: c.path,
        line: c.line,
        side: "RIGHT",
        body: c.body.replace(/```suggestion[\s\S]*?```/, (m) => (c.startLine ? m.replace("suggestion", "diff") : m)),
      });
    } else if (c.startLine && p.commentable.has(c.startLine)) {
      inline.push({ path: c.path, line: c.startLine, side: "RIGHT", body: c.body.replace("```suggestion", "```diff") });
    } else folded.push(c);
  }
  return { inline, folded };
}

export async function createReview(token: string, input: CreateReviewInput, deps: GitHubDeps = {}): Promise<{ url: string; inline: number; folded: number }> {
  const files = await listFiles(token, input.ref, deps);
  const patches = new Map(files.map((f) => [f.filename, parsePatch(f.patch)]));
  const { inline, folded } = placeComments(input.comments, patches);
  const extra = folded.length
    ? `\n\n---\n**Also found outside the changed lines:**\n\n${folded.map((c) => `- \`${c.path}:${c.line}\` ${c.body.split("\n")[0]}`).join("\n")}`
    : "";
  const review = await gh<{ html_url: string }>(
    token,
    `${repoPath(input.ref)}/pulls/${input.ref.number}/reviews`,
    { method: "POST", body: JSON.stringify({ commit_id: input.commitId, event: input.event, body: input.body + extra, comments: inline }) },
    deps,
  );
  return { url: review.html_url, inline: inline.length, folded: folded.length };
}
