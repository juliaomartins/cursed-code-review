import "server-only";
import type { PrRef, ScanFile, ScanResult } from "@/lib/github";
import type { LinkTarget } from "@/lib/githubLinks";
import { parsePatch } from "@/lib/patch";
import { languageFromPath, MAX_LINES } from "@/lib/scanner";
import { ApiError, enc, filePath, gh, rawFile, repoPath, supported, type GitHubDeps, type PrAccess } from "./github";

/** Most files a folder or repository scan reads; the rest are listed as skipped. */
export const REPO_SCAN_LIMIT = 40;
const DIFF_FILE_LIMIT = 15;
const MAX_BYTES = 300_000;
const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "out", ".next", "vendor", "coverage", "__pycache__", ".git", "venv", ".venv", "site-packages", "bower_components", ".nuxt", ".output"]);

/** True for files worth scanning: a supported language, not generated, not vendored. */
export function scannable(path: string): boolean {
  const segs = path.split("/");
  if (segs.some((s) => IGNORED_DIRS.has(s))) return false;
  const name = segs[segs.length - 1];
  if (/\.min\.(js|mjs|cjs)$|\.d\.ts$|\.bundle\.js$|-lock\.|\.lock$/.test(name)) return false;
  return supported(path);
}

/**
 * Folders to offer when a scan hit the limit: start with the top-level folders and split any
 * that still hold more than the limit into their subfolders, so each suggestion fits in one scan.
 */
export function suggestFolders(paths: string[], prefix = "", limit = REPO_SCAN_LIMIT, max = 10): { path: string; count: number }[] {
  const rel = paths.map((p) => (prefix ? p.slice(prefix.length + 1) : p));
  const join = (dir: string) => [prefix, dir].filter(Boolean).join("/");
  const group = (files: string[], depth: number, base: string): { path: string; count: number }[] => {
    const counts = new Map<string, string[]>();
    let loose = 0;
    for (const f of files) {
      const segs = f.split("/");
      if (segs.length <= depth + 1) loose++;
      else {
        const key = segs.slice(0, depth + 1).join("/");
        counts.set(key, [...(counts.get(key) ?? []), f]);
      }
    }
    const out: { path: string; count: number }[] = [];
    for (const [dir, list] of counts) {
      if (list.length > limit && depth < 4) out.push(...group(list, depth + 1, dir));
      else out.push({ path: join(dir), count: list.length });
    }
    if (loose) out.push({ path: base ? join(base) : prefix || "(root)", count: loose });
    return out;
  };
  return group(rel, 0, "")
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

/** Real source first, then everything else, then tests, then config files. */
export function scanPriority(path: string): number {
  const name = path.split("/").pop() ?? path;
  if (/(^|\/)(e2e|tests?|__tests__|spec|fixtures|mocks?)(\/|$)|\.(test|spec)\.[a-z]+$/i.test(path)) return 2;
  if (/\.config\.[a-z]+$|^\.?eslint|^(vite|webpack|rollup|babel|jest|vitest|playwright|tailwind|postcss|next)\b/i.test(name)) return 3;
  if (/^(src|lib|app|server|api|pages|components|routes|services|controllers|models|utils|packages)\//i.test(path)) return 0;
  return 1;
}

/** Turns "couldn't read it" into a message that fits who is asking. */
function accessError(e: unknown, label: string, access: PrAccess): never {
  if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 403)) throw e;
  if (access.asUser)
    throw new ApiError(404, "not_installed", `Couldn't open ${label}. Either it doesn't exist, or Cursed Code Review isn't installed on that repository yet.`, "/api/auth/github/login?install=1");
  if (access.signInAvailable) throw new ApiError(401, "auth_required", `Couldn't find ${label} publicly. If the repository is private, sign in with GitHub.`);
  throw new ApiError(404, "not_found", `Couldn't find ${label}. Check the link. Only public repositories can be opened on this site right now.`);
}

async function content(access: PrAccess, repoFull: string, ref: string, path: string, deps: GitHubDeps): Promise<string> {
  if (access.asUser) return gh<string>(access.token, `/repos/${repoFull.split("/").map(enc).join("/")}/contents/${filePath(path)}?ref=${enc(ref)}`, { raw: true }, deps);
  return rawFile(repoFull, ref, path, deps);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

async function load(paths: { path: string; changedLines?: number[] }[], read: (p: string) => Promise<string>): Promise<ScanFile[]> {
  const files = await mapLimit(paths, 8, async (p) => {
    const code = await read(p.path).catch(() => null);
    if (code === null || code.length > MAX_BYTES || code.split("\n").length > MAX_LINES) return null;
    return { path: p.path, language: languageFromPath(p.path), code, ...(p.changedLines ? { changedLines: p.changedLines } : {}) } as ScanFile;
  });
  return files.filter((f): f is ScanFile => f !== null);
}

interface GhCommit {
  sha: string;
  html_url?: string;
  commit?: { message?: string };
  files?: { filename: string; status: string; patch?: string }[];
}

/** Finds which leading segments of a /blob or /tree path are the ref ("feature/login" has a slash). */
async function resolveRef(ref: PrRef | Pick<PrRef, "owner" | "repo">, rest: string[], minPath: number, access: PrAccess, deps: GitHubDeps) {
  const maxRef = Math.min(4, rest.length - minPath);
  let lastError: unknown = null;
  for (let k = 1; k <= maxRef; k++) {
    const name = rest.slice(0, k).join("/");
    try {
      const c = await gh<GhCommit>(access.token, `${repoPath(ref)}/commits/${enc(name)}`, {}, deps);
      return { ref: name, sha: c.sha, path: rest.slice(k).join("/") };
    } catch (e) {
      lastError = e;
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 422)) throw e;
    }
  }
  throw lastError;
}

export async function scanLink(target: Exclude<LinkTarget, { kind: "pr" }>, access: PrAccess, deps: GitHubDeps = {}): Promise<ScanResult> {
  const { owner, repo } = target;
  const full = `${owner}/${repo}`;
  const base = `https://github.com/${full}`;

  if (target.kind === "file") {
    const r = await resolveRef(target, target.rest, 1, access, deps).catch((e) => accessError(e, `${full}/${target.rest.slice(1).join("/")}`, access));
    if (!supported(r.path)) throw new ApiError(422, "unsupported", "The crypt can read JavaScript, TypeScript, Python and PHP files.");
    const files = await load([{ path: r.path }], (p) => content(access, full, r.sha, p, deps));
    if (!files.length) throw new ApiError(422, "unsupported", `Couldn't read ${r.path}. It may be too large (over ${MAX_LINES} lines).`);
    return { target: "file", owner, repo, ref: r.ref, sha: r.sha, path: r.path, title: r.path, url: `${base}/blob/${r.ref}/${r.path}`, files, skippedFiles: 0, lines: target.lines };
  }

  if (target.kind === "folder" || target.kind === "repo") {
    let ref: string;
    let sha: string;
    let prefix = "";
    let description = "";
    if (target.kind === "repo") {
      const info = await gh<{ default_branch: string; description: string | null }>(access.token, repoPath(target), {}, deps).catch((e) => accessError(e, full, access));
      ref = info.default_branch;
      description = info.description ?? "";
      sha = (await gh<GhCommit>(access.token, `${repoPath(target)}/commits/${enc(ref)}`, {}, deps)).sha;
    } else {
      const r = await resolveRef(target, target.rest, 0, access, deps).catch((e) => accessError(e, `${full}/tree/${target.rest.join("/")}`, access));
      ({ ref, sha } = r);
      prefix = r.path.replace(/\/+$/, "");
    }
    const tree = await gh<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
      access.token,
      `${repoPath(target)}/git/trees/${enc(sha)}?recursive=1`,
      {},
      deps,
    );
    const inScope = tree.tree.filter((t) => t.type === "blob" && (!prefix || t.path.startsWith(`${prefix}/`)));
    const candidates = inScope.filter((t) => scannable(t.path) && (t.size ?? 0) <= MAX_BYTES).sort((a, b) => scanPriority(a.path) - scanPriority(b.path) || a.path.localeCompare(b.path));
    if (prefix && !inScope.length) throw new ApiError(404, "not_found", `There's no folder "${prefix}" on ${ref}.`);
    const picked = candidates.slice(0, REPO_SCAN_LIMIT);
    const files = await load(picked, (p) => content(access, full, sha, p, deps));
    if (!files.length) throw new ApiError(422, "unsupported", `No JavaScript, TypeScript, Python or PHP files found in ${prefix || full}.`);
    let truncated: ScanResult["truncated"];
    if (candidates.length > picked.length) {
      truncated = { total: candidates.length, scanned: files.length, folders: suggestFolders(candidates.map((c) => c.path), prefix) };
    }
    return {
      target: target.kind,
      owner,
      repo,
      ref,
      sha,
      path: prefix || undefined,
      title: target.kind === "repo" ? (description ? `${full}: ${description}` : full) : `${prefix} @ ${ref}`,
      url: target.kind === "repo" ? base : `${base}/tree/${ref}/${prefix}`,
      files,
      skippedFiles: inScope.length - files.length,
      truncated,
    };
  }

  if (target.kind === "commit") {
    const c = await gh<GhCommit>(access.token, `${repoPath(target)}/commits/${enc(target.sha)}`, {}, deps).catch((e) => accessError(e, `commit ${target.sha.slice(0, 7)}`, access));
    const changed = (c.files ?? []).filter((f) => f.status !== "removed" && f.patch && scannable(f.filename));
    const files = await load(
      changed.slice(0, DIFF_FILE_LIMIT).map((f) => ({ path: f.filename, changedLines: parsePatch(f.patch).added })),
      (p) => content(access, full, c.sha, p, deps),
    );
    if (!files.length) throw new ApiError(422, "unsupported", "This commit doesn't change any JavaScript, TypeScript, Python or PHP files the crypt can read.");
    return {
      target: "commit",
      changedLinesOnly: true,
      owner,
      repo,
      ref: c.sha,
      sha: c.sha,
      title: (c.commit?.message ?? "").split("\n")[0] || `Commit ${c.sha.slice(0, 7)}`,
      url: c.html_url ?? `${base}/commit/${c.sha}`,
      files,
      skippedFiles: (c.files ?? []).length - files.length,
    };
  }

  // compare
  const cmp = await gh<{ html_url: string; commits: { sha: string }[]; files?: { filename: string; status: string; patch?: string }[] }>(
    access.token,
    `${repoPath(target)}/compare/${enc(target.base)}...${enc(target.head)}`,
    {},
    deps,
  ).catch((e) => accessError(e, `${target.base}...${target.head}`, access));
  const headSha = cmp.commits[cmp.commits.length - 1]?.sha;
  if (!headSha) throw new ApiError(422, "unsupported", `${target.head} has no changes compared to ${target.base}.`);
  const headRepo = target.head.includes(":") ? `${target.head.split(":")[0]}/${repo}` : full;
  const changed = (cmp.files ?? []).filter((f) => f.status !== "removed" && f.patch && scannable(f.filename));
  const files = await load(
    changed.slice(0, DIFF_FILE_LIMIT).map((f) => ({ path: f.filename, changedLines: parsePatch(f.patch).added })),
    (p) => content(access, headRepo, headSha, p, deps),
  );
  if (!files.length) throw new ApiError(422, "unsupported", "This comparison doesn't change any JavaScript, TypeScript, Python or PHP files the crypt can read.");
  return {
    target: "compare",
    changedLinesOnly: true,
    owner,
    repo,
    ref: target.head,
    sha: headSha,
    title: `${target.head} → ${target.base}`,
    url: cmp.html_url,
    files,
    skippedFiles: (cmp.files ?? []).length - files.length,
  };
}
