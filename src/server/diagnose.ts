import "server-only";
import { ApiError, gh, type GitHubDeps } from "./github";

interface Installation {
  id: number;
  app_slug: string;
  html_url: string;
  repository_selection: "all" | "selected";
  permissions: Record<string, string>;
  account: { login: string } | null;
}

/**
 * When GitHub says "Resource not accessible by integration", work out why, from the signed-in
 * user's own view of the app's installations:
 * - the installation hasn't accepted the newer permission yet;
 * - the repository isn't one of the installation's selected repositories;
 * - the app isn't installed on that account at all.
 */
export async function explainMissingAccess(
  token: string,
  slug: string,
  owner: string,
  repo: string,
  need: { permission: "contents" | "issues" | "pull_requests"; label: string },
  deps: GitHubDeps = {},
): Promise<ApiError> {
  const settings = `https://github.com/settings/apps/${slug}/permissions`;
  let installs: Installation[] = [];
  try {
    installs = (await gh<{ installations: Installation[] }>(token, "/user/installations?per_page=100", {}, deps)).installations;
  } catch {
    return new ApiError(
      403,
      "missing_permission",
      `The GitHub App can't ${need.label} on ${owner}/${repo}. Check its ${need.permission} permission and that your installation accepted it.`,
      settings,
    );
  }
  const inst = installs.find((i) => i.app_slug === slug && i.account?.login.toLowerCase() === owner.toLowerCase());
  if (!inst)
    return new ApiError(
      404,
      "not_installed",
      `Cursed Code Review isn't installed on ${owner}'s account, so it can't ${need.label} on ${owner}/${repo}.`,
      "/api/auth/github/login?install=1",
    );

  const granted = inst.permissions[need.permission];
  if (granted !== "write")
    return new ApiError(
      403,
      "permission_not_accepted",
      `Your installation still grants “${need.permission.replace("_", " ")}: ${granted ?? "none"}”. GitHub waits for you to accept the app's new permissions: open the installation, click “Review request”, then “Accept new permissions”. Then try again.`,
      inst.html_url,
    );

  if (inst.repository_selection === "selected") {
    let included = false;
    for (let page = 1; page <= 10 && !included; page++) {
      const res = await gh<{ repositories: { full_name: string }[] }>(
        token,
        `/user/installations/${inst.id}/repositories?per_page=100&page=${page}`,
        {},
        deps,
      ).catch(() => null);
      if (!res) break;
      included = res.repositories.some((r) => r.full_name.toLowerCase() === `${owner}/${repo}`.toLowerCase());
      if (res.repositories.length < 100) break;
    }
    if (!included)
      return new ApiError(
        403,
        "repo_not_selected",
        `${owner}/${repo} isn't one of the repositories Cursed Code Review can access. Open the installation, add it under “Repository access” (or choose “All repositories”), save, then try again.`,
        inst.html_url,
      );
  }

  return new ApiError(
    403,
    "missing_permission",
    "The installation looks right, but GitHub still refused. Sign out of Cursed Code Review and sign in again to get a fresh token, then try again.",
    inst.html_url,
  );
}
