export type MonsterKind = "wraith" | "leech" | "possessor" | "imp" | "twins" | "zombie" | "gremlin";

/** CRITICAL is only used with evidence: untrusted input visibly reaching a sink, or a live-format secret. */
export type Severity = "CRITICAL" | "HIGH" | "MED" | "LOW";

export type Category = "Security" | "Correctness" | "Performance" | "Maintainability";

/** How sure the rule is. "low" means: a potential risk the scanner could not confirm. */
export type Confidence = "high" | "medium" | "low";

export type IgnoreReason = "false-positive" | "accepted-risk" | "fix-elsewhere";

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
  /** Stable rule identifier, e.g. "sql-injection". Optional only for reviews saved before rule ids existed. */
  ruleId?: string;
  category?: Category;
  confidence?: Confidence;
  /** 1-based column of the finding on its primary line. */
  column?: number;
  /** The rule saw untrusted input (request data, argv…) reach the sink on this line. Never guessed. */
  exposure?: "untrusted-input";
  /** False when no safe automatic fix exists: `fix` is unchanged code and remediation is manual. */
  autofix?: boolean;
  /** Why it was dismissed, when status is "ignored". */
  ignoreReason?: IgnoreReason;
  /** After banishing: did a re-scan of the fixed code still detect this rule there? */
  verification?: "resolved" | "still-detected";
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
  /** The fix pull request (or the PR that received the fix commits). */
  fixesUrl?: string;
}
