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

export const SUPPORTED_EXTENSIONS = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "php"];

export interface PullRequest extends PrRef {
  url: string;
  title: string;
  author: string;
  baseRef: string;
  headRef: string;
  /** Head commit SHA. Required to post a real review. */
  headSha?: string;
  files: PrFile[];
  /** How many changed files were skipped (unsupported language, removed, too large). */
  skippedFiles?: number;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "auth_required" | "rate_limited" | "network" | "not_installed" | "unsupported" | "bad_request" | "forbidden",
    /** Where the user can install the GitHub App on this repository. */
    public installUrl?: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface ReviewComment {
  path: string;
  /** Last line of the comment (new-file numbering). */
  line: number;
  /** First line, for multi-line suggestions. */
  startLine?: number;
  body: string;
}

export interface PostReviewInput {
  ref: PrRef;
  event: "COMMENT" | "REQUEST_CHANGES" | "APPROVE";
  body: string;
  comments: ReviewComment[];
}
