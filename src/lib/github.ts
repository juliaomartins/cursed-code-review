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

/** A file the crypt will scan. Without `changedLines`, the whole file is hunted. */
export interface ScanFile {
  path: string;
  language: Language;
  code: string;
  changedLines?: number[];
}

/** What /api/github/scan returns for anything that isn't a pull request. */
export interface ScanResult {
  target: "file" | "folder" | "repo" | "commit" | "compare";
  owner: string;
  repo: string;
  /** Branch, tag or commit the files were read at. */
  ref: string;
  /** Exact commit, for stable links in issues. */
  sha: string;
  /** Folder or file path, when the link pointed inside the repo. */
  path?: string;
  title: string;
  url: string;
  files: ScanFile[];
  /** Files seen but not scanned (other languages, generated, too big, over the limit). */
  skippedFiles: number;
  /** Set when a folder or repo had more files than the scan limit. */
  truncated?: { total: number; scanned: number; folders: { path: string; count: number }[] };
  /** For file links with #L10-L20. */
  lines?: [number, number];
  /** True for commits and comparisons: only changed lines are hunted. */
  changedLinesOnly?: boolean;
}

export type ScanResponse = { target: "pr"; pr: PullRequest } | ScanResult;

/** A repository the signed-in user gave the app access to. */
export interface RepoSummary {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  language: string | null;
  pushedAt: string | null;
  defaultBranch: string;
  url: string;
  description: string | null;
  archived: boolean;
}

export interface InstallationSummary {
  account: string;
  selection: "all" | "selected";
  manageUrl: string;
}

/** An open pull request, as listed in the repo picker. */
export interface PullSummary {
  number: number;
  title: string;
  author: string;
  draft: boolean;
  headRef: string;
  baseRef: string;
  updatedAt: string;
  url: string;
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
