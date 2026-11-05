export type MonsterKind = "wraith" | "leech" | "possessor" | "imp" | "twins" | "zombie" | "gremlin";

export type Severity = "HIGH" | "MED" | "LOW";

export type Language = "javascript" | "typescript" | "python" | "php";

export type FindingStatus = "lurking" | "banished" | "ignored";

/** A line-range replacement that banishes a monster. Lines are 1-based. */
export interface Fix {
  startLine: number;
  /** The exact source lines being replaced (used to re-locate the fix after other edits). */
  before: string[];
  /** Replacement lines. May be empty (delete) or longer than `before` (insert). */
  after: string[];
  /** Extra context shown under the diff, e.g. a helper the fix relies on. */
  note?: string;
}

export interface Finding {
  id: string;
  kind: MonsterKind;
  severity: Severity;
  /** Short bug label, e.g. "SQL injection". */
  bug: string;
  /** Technical explanation. */
  why: string;
  /** Explain-it-simply version. */
  eli5: string;
  fix: Fix;
  /** Offsets (relative to fix.startLine) of the lines the monster haunts. First is the primary line. */
  lineOffsets: number[];
  /** Offsets (relative to fix.startLine) of lines that should look "dead" (zombie). */
  dimOffsets?: number[];
  status: FindingStatus;
  /** Set when the code around the monster changed and the fix can no longer be applied cleanly. */
  stale?: boolean;
}

export interface ReviewFile {
  id: string;
  path: string;
  language: Language;
  originalCode: string;
  code: string;
  /** For PR reviews: lines touched by the diff (1-based, relative to the original file). */
  changedLines?: number[];
  findings: Finding[];
  /** The findings as first scanned, used to "summon them again". */
  initialFindings: Finding[];
  /** Lines a file link pointed at (#L10-L20), highlighted in the crypt. */
  focusLines?: [number, number];
}

/** Where a non-PR GitHub scan came from. */
export interface GitHubScanSource {
  kind: "github";
  target: "file" | "folder" | "repo" | "commit" | "compare";
  label: string;
  title: string;
  url: string;
  owner: string;
  repo: string;
  ref: string;
  sha: string;
  path?: string;
  skippedFiles?: number;
  truncated?: { total: number; scanned: number; folders: { path: string; count: number }[] };
  issueUrl?: string;
}

export type ReviewSource =
  | { kind: "sample"; label: string }
  | { kind: "paste"; label: string }
  | {
      kind: "pr";
      label: string;
      url: string;
      owner: string;
      repo: string;
      number: number;
      title: string;
      author: string;
      baseRef: string;
      headRef: string;
      headSha?: string;
      /** True when the PR came from the GitHub API. */
      live?: boolean;
      /** Changed files the crypt could not scan (other languages, removed, or over the limit). */
      skippedFiles?: number;
    }
  | GitHubScanSource;

export interface Review {
  id: string;
  createdAt: string;
  source: ReviewSource;
  files: ReviewFile[];
  activeFileId: string;
  selectedFindingId: string | null;
  postedReviewUrl?: string;
}
