import { KEYS, readJson, writeJson } from "./storage";
import type { ReviewSource } from "./types";

/** What one scan of a folder (or the whole repository, path "") found. */
export interface ExploredScan {
  files: number;
  monsters: number;
  at: number;
}

/** Everything remembered about one repository at one branch. */
export interface ExploredRepo {
  /** Readable files in the repository, from the last whole-repository scan that hit the limit. */
  total?: number;
  /** How many files that scan read. */
  scanned?: number;
  /** Folder suggestions from that scan. */
  folders?: { path: string; count: number }[];
  scans: Record<string, ExploredScan>;
}

type Store = Record<string, ExploredRepo>;

/** Keep the store small: only the most recently explored repositories. */
const MAX_REPOS = 20;

type GitHubSource = Extract<ReviewSource, { kind: "github" }>;

export const repoKey = (s: Pick<GitHubSource, "owner" | "repo" | "ref">) => `${s.owner}/${s.repo}@${s.ref}`;

/** The folder a scan covered: "" for the whole repository, null for anything that isn't a folder. */
export function scannedFolder(s: GitHubSource): string | null {
  if (s.target === "repo") return "";
  if (s.target === "folder") return (s.path ?? "").replace(/^\/+|\/+$/g, "");
  return null;
}

export function readExplored(key: string): ExploredRepo | null {
  return readJson<Store>(KEYS.explored)?.[key] ?? null;
}

/** Remembers a repository or folder scan, so the map can mark that folder as explored. */
export function recordExplored(source: GitHubSource, files: number, monsters: number, now = Date.now()): ExploredRepo | null {
  const folder = scannedFolder(source);
  if (folder === null) return null;
  const store = readJson<Store>(KEYS.explored) ?? {};
  const key = repoKey(source);
  const prev = store[key] ?? { scans: {} };
  const next: ExploredRepo = {
    ...prev,
    ...(folder === "" && source.truncated ? { total: source.truncated.total, scanned: source.truncated.scanned, folders: source.truncated.folders } : {}),
    scans: { ...prev.scans, [folder]: { files, monsters, at: now } },
  };
  const others = Object.entries(store)
    .filter(([k]) => k !== key)
    .sort(([, a], [, b]) => latest(b) - latest(a))
    .slice(0, MAX_REPOS - 1);
  writeJson(KEYS.explored, Object.fromEntries([[key, next], ...others]));
  return next;
}

const latest = (r: ExploredRepo) => Math.max(0, ...Object.values(r.scans).map((s) => s.at));

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(at: number, now = Date.now()): string {
  const min = Math.floor((now - at) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
