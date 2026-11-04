import { SAMPLES } from "./samples";
import type { Language } from "./types";

export interface PrRef {
  owner: string;
  repo: string;
  number: number;
}

export type ParseResult = { ok: true; ref: PrRef } | { ok: false; error: string };

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** Validates and parses a GitHub pull request URL (or `owner/repo#12` shorthand). */
export function parsePrUrl(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Paste a pull request link to continue." };
  const short = /^([^/\s#]+)\/([^/\s#]+)#(\d+)$/.exec(raw);
  if (short) return finish(short[1], short[2], short[3]);
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "That does not look like a link. Try https://github.com/owner/repo/pull/12" };
  }
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) return { ok: false, error: "Only github.com pull requests are supported right now." };
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[2] !== "pull") return { ok: false, error: "Link to a pull request, like github.com/owner/repo/pull/12" };
  return finish(parts[0], parts[1], parts[3]);
}

function finish(owner: string, repo: string, num: string): ParseResult {
  if (!NAME.test(owner) || !NAME.test(repo)) return { ok: false, error: "The owner or repository name is not valid." };
  const number = Number(num);
  if (!Number.isInteger(number) || number < 1) return { ok: false, error: "The pull request number must be a positive whole number." };
  return { ok: true, ref: { owner, repo: repo.replace(/\.git$/, ""), number } };
}

export interface PrFile {
  path: string;
  language: Language;
  code: string;
  changedLines: number[];
  additions: number;
  deletions: number;
}

export interface PullRequest extends PrRef {
  url: string;
  title: string;
  author: string;
  baseRef: string;
  headRef: string;
  files: PrFile[];
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "auth_required" | "rate_limited" | "network",
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

const TITLES = [
  "Add session caching to login",
  "Paginate the ghosts endpoint",
  "Speed up token parsing",
  "Refactor withdraw flow",
  "Render ghost cards on the client",
];

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Lines that a mock diff "touched": every non-blank line from the first function onward. */
function mockChangedLines(code: string, seed: number): number[] {
  const lines = code.split("\n");
  const start = Math.max(0, lines.findIndex((l) => /function|def |async /.test(l)));
  const out: number[] = [];
  lines.forEach((l, i) => {
    if (i >= start && l.trim() !== "" && (i + seed) % 7 !== 0) out.push(i + 1);
  });
  return out;
}

export interface FetchOptions {
  signedIn: boolean;
  signal?: AbortSignal;
  latencyMs?: number;
}

/**
 * Mock GitHub API. Deterministic per URL so demos are repeatable.
 * - repo names containing "private" need sign-in
 * - PR numbers ≥ 9000 do not exist
 * - repo "rate-limit" simulates a rate limit
 */
export async function fetchPullRequest(ref: PrRef, opts: FetchOptions): Promise<PullRequest> {
  await delay(opts.latencyMs ?? 900, opts.signal);
  if (/rate-limit/i.test(ref.repo)) throw new GitHubError("GitHub is rate limiting us. Wait a minute and try again.", "rate_limited");
  if (/private/i.test(ref.repo) && !opts.signedIn)
    throw new GitHubError("This repository is private. Sign in with GitHub to open it.", "auth_required");
  if (ref.number >= 9000) throw new GitHubError(`Pull request #${ref.number} was not found in ${ref.owner}/${ref.repo}.`, "not_found");

  const h = hash(`${ref.owner}/${ref.repo}#${ref.number}`);
  const picks = [SAMPLES[(h % 3 + 3) % 3], SAMPLES[((h >> 3) % 3 + 4) % 3]].filter((s, i, a) => a.indexOf(s) === i);
  if (picks.length === 1) picks.push(SAMPLES[(SAMPLES.indexOf(picks[0]) + 1) % 3]);
  const files: PrFile[] = picks.map((s, i) => {
    const changedLines = mockChangedLines(s.code, (h >> (i * 4)) & 7);
    return {
      path: s.path,
      language: s.language,
      code: s.code,
      changedLines,
      additions: changedLines.length,
      deletions: Math.max(1, Math.round(changedLines.length / 3)),
    };
  });
  return {
    ...ref,
    url: `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`,
    title: TITLES[h % TITLES.length],
    author: ["mara-lantern", "dev-ghoul", "night-coder", "hexbyte"][h % 4],
    baseRef: "main",
    headRef: ["feat/session-cache", "fix/pagination", "chore/refactor"][h % 3],
    files,
  };
}

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

export interface PostReviewInput {
  ref: PrRef;
  event: "COMMENT" | "REQUEST_CHANGES" | "APPROVE";
  body: string;
  comments: ReviewComment[];
}

/** Mock "create review" call. Returns the URL of the posted review. */
export async function postReview(input: PostReviewInput, opts: { signedIn: boolean; latencyMs?: number }): Promise<string> {
  await delay(opts.latencyMs ?? 1100);
  if (!opts.signedIn) throw new GitHubError("Sign in with GitHub to post a review.", "auth_required");
  const id = hash(JSON.stringify(input)) % 1_000_000_000;
  return `https://github.com/${input.ref.owner}/${input.ref.repo}/pull/${input.ref.number}#pullrequestreview-${id}`;
}
