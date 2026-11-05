/**
 * Understands every kind of GitHub link the crypt can open.
 * Refs containing slashes (e.g. "feature/login") are ambiguous inside /blob and /tree links;
 * the parser keeps the remaining segments in `rest` so the server can try both splits.
 */
export type LinkTarget =
  | { kind: "pr"; owner: string; repo: string; number: number }
  | { kind: "file"; owner: string; repo: string; rest: string[]; lines?: [number, number] }
  | { kind: "folder"; owner: string; repo: string; rest: string[] }
  | { kind: "repo"; owner: string; repo: string }
  | { kind: "commit"; owner: string; repo: string; sha: string }
  | { kind: "compare"; owner: string; repo: string; base: string; head: string };

export type LinkParse = { ok: true; target: LinkTarget } | { ok: false; error: string };

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const SHA = /^[0-9a-f]{7,40}$/i;
const REF = /^[A-Za-z0-9._\-/:]{1,200}$/;

export const LINK_LABEL: Record<LinkTarget["kind"], string> = {
  pr: "Pull request · changed lines only",
  file: "Single file",
  folder: "Folder",
  repo: "Whole repository",
  commit: "Commit · changed lines only",
  compare: "Branch comparison · changed lines only",
};

function lineRange(hash: string): [number, number] | undefined {
  const m = /^#L(\d+)(?:-L(\d+))?$/.exec(hash);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = Number(m[2] ?? m[1]);
  return [Math.min(a, b), Math.max(a, b)];
}

export function parseGitHubLink(input: string): LinkParse {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Paste a GitHub link to continue." };

  const short = /^([^/\s#]+)\/([^/\s#]+)#(\d+)$/.exec(raw);
  if (short) return check({ kind: "pr", owner: short[1], repo: short[2], number: Number(short[3]) });
  const bare = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(raw);
  if (bare && !raw.includes(".com")) return check({ kind: "repo", owner: bare[1], repo: bare[2] });

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "That doesn't look like a link. Try https://github.com/owner/repo" };
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (host === "raw.githubusercontent.com") {
    if (parts.length < 4) return { ok: false, error: "That raw link is missing the file path." };
    return check({ kind: "file", owner: parts[0], repo: parts[1], rest: parts.slice(2) });
  }
  if (host !== "github.com" && host !== "www.github.com") return { ok: false, error: "Only github.com links are supported right now." };
  if (parts.length < 2) return { ok: false, error: "Link to a repository, like github.com/owner/repo" };

  const [owner, repoRaw, section, ...tail] = parts;
  const repo = repoRaw.replace(/\.git$/, "");
  switch (section) {
    case undefined:
      return check({ kind: "repo", owner, repo });
    case "pull": {
      const n = Number(tail[0]);
      if (!Number.isInteger(n) || n < 1) return { ok: false, error: "The pull request number must be a positive whole number." };
      return check({ kind: "pr", owner, repo, number: n });
    }
    case "blob":
      if (tail.length < 2) return { ok: false, error: "That file link is missing the file path." };
      return check({ kind: "file", owner, repo, rest: tail, lines: lineRange(url.hash) });
    case "tree":
      if (tail.length < 1) return check({ kind: "repo", owner, repo });
      return check({ kind: "folder", owner, repo, rest: tail });
    case "commit":
      if (!SHA.test(tail[0] ?? "")) return { ok: false, error: "That commit link has no valid commit id." };
      return check({ kind: "commit", owner, repo, sha: tail[0] });
    case "compare": {
      const spec = tail.join("/");
      const m = /^(.+?)\.{2,3}(.+)$/.exec(spec);
      if (!m) return { ok: false, error: "A compare link looks like github.com/owner/repo/compare/main...feature" };
      return check({ kind: "compare", owner, repo, base: m[1], head: m[2] });
    }
    default:
      return { ok: false, error: "Link to a pull request, file, folder, commit, comparison or the repository itself." };
  }
}

function check(t: LinkTarget): LinkParse {
  if (!NAME.test(t.owner) || !NAME.test(t.repo)) return { ok: false, error: "The owner or repository name is not valid." };
  if ("rest" in t && t.rest.some((s) => s === ".." || s === "." || s === "")) return { ok: false, error: "That path is not valid." };
  if (t.kind === "compare" && (!REF.test(t.base) || !REF.test(t.head))) return { ok: false, error: "Those branch names are not valid." };
  return { ok: true, target: t };
}

/** Short description shown under the link box, e.g. "Single file · login.js". */
export function describeLink(t: LinkTarget): string {
  switch (t.kind) {
    case "pr":
      return `${LINK_LABEL.pr} · ${t.owner}/${t.repo}#${t.number}`;
    case "file":
      return `${LINK_LABEL.file} · ${t.rest[t.rest.length - 1]}${t.lines ? ` · lines ${t.lines[0]}–${t.lines[1]}` : ""}`;
    case "folder":
      return `${LINK_LABEL.folder} · ${t.rest.slice(1).join("/") || t.rest[0]} in ${t.owner}/${t.repo}`;
    case "repo":
      return `${LINK_LABEL.repo} · ${t.owner}/${t.repo}`;
    case "commit":
      return `${LINK_LABEL.commit} · ${t.sha.slice(0, 7)}`;
    case "compare":
      return `${LINK_LABEL.compare} · ${t.head} → ${t.base}`;
  }
}
