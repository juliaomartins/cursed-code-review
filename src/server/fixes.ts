import "server-only";
import { createHash } from "node:crypto";
import { ApiError, enc, filePath, gh, repoPath, type GitHubDeps } from "./github";

export interface FixFile {
  path: string;
  /** The fixed file, with "\n" line endings. */
  content: string;
  /** sha256 (hex) of the file as it was scanned, "\n" line endings. Files that changed on GitHub since are skipped. */
  originalHash: string;
  message: string;
}

export type FixTarget =
  | { kind: "newBranch"; baseSha: string; baseBranch: string; branch: string; title: string; body: string }
  | { kind: "prBranch"; number: number; headSha: string };

export interface PushFixesInput {
  owner: string;
  repo: string;
  files: FixFile[];
  target: FixTarget;
}

export interface PushFixesResult {
  url: string;
  branch: string;
  commits: number;
  skipped: { path: string; reason: string }[];
}

const normalize = (s: string) => s.replace(/\r\n?/g, "\n");
export const sha256 = (s: string) => createHash("sha256").update(normalize(s), "utf8").digest("hex");

/** GitHub's wording when the app lacks a permission, turned into what to change. */
function permissionError(e: unknown): never {
  if (e instanceof ApiError && e.status === 403 && /not accessible by integration/i.test(e.message))
    throw new ApiError(
      403,
      "missing_permission",
      "The GitHub App isn't allowed to change code yet. In the app's settings open Permissions → Repository → Contents → Read and write, save, then accept the new permission on your installation (GitHub sends you an email).",
    );
  if (e instanceof ApiError && e.status === 403 && /protected branch|branch protection/i.test(e.message))
    throw new ApiError(403, "protected_branch", "That branch is protected, so commits can't be pushed to it directly. Open a fix PR instead.");
  throw e;
}

/**
 * Commits each file separately (one commit per file) onto `branch`, in order.
 * Before writing, checks the file on GitHub still matches what was scanned.
 */
export async function commitFiles(token: string, owner: string, repo: string, branch: string, files: FixFile[], deps: GitHubDeps = {}) {
  const base = repoPath({ owner, repo });
  let commits = 0;
  const skipped: PushFixesResult["skipped"] = [];
  for (const f of files) {
    let current: { sha: string; content: string; encoding: string };
    try {
      current = await gh(token, `${base}/contents/${filePath(f.path)}?ref=${enc(branch)}`, {}, deps);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        skipped.push({ path: f.path, reason: "It no longer exists on the branch." });
        continue;
      }
      permissionError(e);
    }
    const text = Buffer.from(current.content, (current.encoding as BufferEncoding) || "base64").toString("utf8");
    if (sha256(text) !== f.originalHash) {
      skipped.push({ path: f.path, reason: "It changed on GitHub since the scan." });
      continue;
    }
    const crlf = text.includes("\r\n");
    const body = crlf ? normalize(f.content).replace(/\n/g, "\r\n") : normalize(f.content);
    try {
      await gh(
        token,
        `${base}/contents/${filePath(f.path)}`,
        { method: "PUT", body: JSON.stringify({ message: f.message, content: Buffer.from(body, "utf8").toString("base64"), sha: current.sha, branch }) },
        deps,
      );
      commits++;
    } catch (e) {
      permissionError(e);
    }
  }
  return { commits, skipped };
}

export async function pushFixes(token: string, input: PushFixesInput, deps: GitHubDeps = {}): Promise<PushFixesResult> {
  const { owner, repo, target } = input;
  const base = repoPath({ owner, repo });
  if (!input.files.length) throw new ApiError(400, "bad_request", "Banish at least one monster first.");

  if (target.kind === "prBranch") {
    const pr = await gh<{ html_url: string; state: string; head: { ref: string; sha: string; repo: { full_name: string } | null } }>(
      token,
      `${base}/pulls/${target.number}`,
      {},
      deps,
    ).catch((e) => {
      if (e instanceof ApiError && e.status === 404) throw new ApiError(404, "not_installed", "Couldn't open that pull request. Is Mateklamar Code Review installed on the repository?", "/api/auth/github/login?install=1");
      throw e;
    });
    if (pr.state !== "open") throw new ApiError(422, "pr_closed", "That pull request is closed, so it can't take new commits. Open a fix PR instead.");
    if (pr.head.repo?.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase())
      throw new ApiError(422, "fork_pr", "That pull request comes from a fork, so its branch lives in another repository. Open a fix PR instead.");
    if (pr.head.sha !== target.headSha)
      throw new ApiError(409, "stale_commit", "The pull request has new commits since you opened it. Open it in the crypt again so the fixes match its latest code.");
    const { commits, skipped } = await commitFiles(token, owner, repo, pr.head.ref, input.files, deps);
    if (!commits) throw new ApiError(409, "nothing_committed", `Nothing was committed: ${skipped.map((s) => `${s.path}: ${s.reason}`).join(" ")}`);
    return { url: pr.html_url, branch: pr.head.ref, commits, skipped };
  }

  // New branch + pull request.
  await gh(token, `${base}/branches/${enc(target.baseBranch)}`, {}, deps).catch((e) => {
    if (e instanceof ApiError && e.status === 404)
      throw new ApiError(422, "not_a_branch", `“${target.baseBranch}” isn't a branch, so a pull request can't target it. Scan a branch, folder or the repository instead.`);
    throw e;
  });
  let branch = target.branch;
  for (let attempt = 1; ; attempt++) {
    try {
      await gh(token, `${base}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: target.baseSha }) }, deps);
      break;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && /already exists/i.test(e.message) && attempt < 6) {
        branch = `${target.branch}-${attempt + 1}`;
        continue;
      }
      permissionError(e);
    }
  }
  const { commits, skipped } = await commitFiles(token, owner, repo, branch, input.files, deps);
  if (!commits) {
    await gh(token, `${base}/git/refs/heads/${branch.split("/").map(enc).join("/")}`, { method: "DELETE" }, deps).catch(() => undefined);
    throw new ApiError(409, "nothing_committed", `Nothing was committed, so no pull request was opened: ${skipped.map((s) => `${s.path}: ${s.reason}`).join(" ")}`);
  }
  const pr = await gh<{ html_url: string }>(
    token,
    `${base}/pulls`,
    { method: "POST", body: JSON.stringify({ title: target.title, head: branch, base: target.baseBranch, body: target.body, maintainer_can_modify: true }) },
    deps,
  ).catch(permissionError);
  return { url: pr.html_url, branch, commits, skipped };
}
