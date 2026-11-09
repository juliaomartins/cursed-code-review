import "server-only";
import type { PullSummary, RepoSummary } from "@/lib/github";
import { ApiError, gh, repoPath, type GitHubDeps } from "./github";

interface GhInstallation {
  id: number;
  app_slug: string;
  html_url: string;
  repository_selection: "all" | "selected";
  account: { login: string } | null;
}

interface GhRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  language: string | null;
  pushed_at: string | null;
  default_branch: string;
  html_url: string;
  description: string | null;
  archived?: boolean;
}

const MAX_PAGES = 5; // up to 500 repositories per installation

/** Every repository the signed-in user can open through this app, most recently pushed first. */
export async function listRepos(token: string, slug: string, deps: GitHubDeps = {}) {
  const { installations } = await gh<{ installations: GhInstallation[] }>(token, "/user/installations?per_page=100", {}, deps);
  const mine = installations.filter((i) => i.app_slug === slug);
  const seen = new Set<string>();
  const repos: RepoSummary[] = [];
  for (const inst of mine) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await gh<{ repositories: GhRepo[] }>(token, `/user/installations/${inst.id}/repositories?per_page=100&page=${page}`, {}, deps);
      for (const r of res.repositories) {
        if (seen.has(r.full_name.toLowerCase())) continue;
        seen.add(r.full_name.toLowerCase());
        repos.push({
          owner: r.owner.login,
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          language: r.language,
          pushedAt: r.pushed_at,
          defaultBranch: r.default_branch,
          url: r.html_url,
          description: r.description,
          archived: !!r.archived,
        });
      }
      if (res.repositories.length < 100) break;
    }
  }
  repos.sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
  return {
    repos,
    installations: mine.map((i) => ({ account: i.account?.login ?? "", selection: i.repository_selection, manageUrl: i.html_url })),
  };
}

interface GhPull {
  number: number;
  title: string;
  draft?: boolean;
  user: { login: string } | null;
  head: { ref: string };
  base: { ref: string };
  updated_at: string;
  html_url: string;
}

/** Open pull requests, most recently updated first. */
export async function listPulls(token: string, owner: string, repo: string, deps: GitHubDeps = {}): Promise<PullSummary[]> {
  try {
    const pulls = await gh<GhPull[]>(token, `${repoPath({ owner, repo })}/pulls?state=open&sort=updated&direction=desc&per_page=50`, {}, deps);
    return pulls.map((p) => ({
      number: p.number,
      title: p.title,
      author: p.user?.login ?? "ghost",
      draft: !!p.draft,
      headRef: p.head.ref,
      baseRef: p.base.ref,
      updatedAt: p.updated_at,
      url: p.html_url,
    }));
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403))
      throw new ApiError(404, "not_installed", `Mateklamar Code Review can't see ${owner}/${repo}. Import it to give the app access.`, "/api/auth/github/login?install=1");
    throw e;
  }
}
