import { MONSTERS } from "./monsters";
import type { Finding, Review, ReviewFile } from "./types";

/** Where the banished fixes can go on GitHub, or why they can't. */
export type FixDestination =
  | { mode: "newBranch"; owner: string; repo: string; baseBranch: string; baseSha: string }
  | { mode: "prBranch"; owner: string; repo: string; number: number; headSha: string; branch: string }
  | { mode: null; reason: string };

export function fixDestination(review: Review): FixDestination {
  const src = review.source;
  if (src.kind === "pr") {
    if (!src.headSha) return { mode: null, reason: "Open the pull request in the crypt again to push fixes to it." };
    return { mode: "prBranch", owner: src.owner, repo: src.repo, number: src.number, headSha: src.headSha, branch: src.headRef };
  }
  if (src.kind === "github") {
    if (src.target === "commit")
      return { mode: null, reason: "A single commit has no branch to open a pull request into. Scan the branch, a folder or the repository instead." };
    // For a comparison, `ref` is the head branch: the fixes go into it.
    const baseBranch = src.ref;
    if (/^[0-9a-f]{40}$/.test(baseBranch)) return { mode: null, reason: "This scan points at a commit, not a branch." };
    return { mode: "newBranch", owner: src.owner, repo: src.repo, baseBranch, baseSha: src.sha };
  }
  return { mode: null, reason: "Applying fixes on GitHub works for code opened from a GitHub link." };
}

const banishedOf = (file: ReviewFile) => file.findings.filter((f) => f.status === "banished");
const lineOf = (file: ReviewFile, f: Finding) => {
  const init = file.initialFindings.find((i) => i.id === f.id) ?? f;
  return init.fix.startLine + init.lineOffsets[0];
};

/** Files whose code changed in the crypt, with one commit message each. */
export function changedFiles(review: Review): { file: ReviewFile; message: string; fixes: Finding[] }[] {
  return review.files
    .filter((f) => f.code !== f.originalCode)
    .map((file) => {
      const fixes = banishedOf(file);
      const name = file.path.split("/").pop();
      const message = [
        `Banish ${fixes.length} monster${fixes.length === 1 ? "" : "s"} in ${name}`,
        "",
        ...fixes.map((f) => `- ${MONSTERS[f.kind].name} · ${f.bug} (line ${lineOf(file, f)}, ${f.severity})`),
        "",
        "Fixed with Cursed Code Review",
      ].join("\n");
      return { file, message, fixes };
    });
}

export function fixPrTitle(review: Review): string {
  const n = review.files.reduce((sum, f) => sum + (f.code !== f.originalCode ? banishedOf(f).length : 0), 0);
  return `🔥 Banish ${n} monster${n === 1 ? "" : "s"}`;
}

export function fixPrBody(review: Review): string {
  const changed = changedFiles(review);
  const all = review.files.flatMap((f) => f.findings);
  const leftOver = all.filter((f) => f.status !== "banished");
  const out = [
    `Cursed Code Review found monsters in this code and banished **${changed.reduce((n, c) => n + c.fixes.length, 0)}** of them. Each file is its own commit, so you can review or revert them one by one.`,
    "",
  ];
  for (const { file, fixes } of changed) {
    out.push(`### \`${file.path}\``, "");
    for (const f of fixes) out.push(`- [x] **${MONSTERS[f.kind].name} · ${f.bug}** (${f.severity}), line ${lineOf(file, f)}`);
    const notes = Array.from(new Set(fixes.map((f) => f.fix.note).filter(Boolean)));
    for (const note of notes) out.push(`  > ${note}`);
    out.push("");
  }
  if (leftOver.length) {
    out.push(`**Not changed:** ${leftOver.length} monster${leftOver.length === 1 ? " was" : "s were"} ignored or left for review in the crypt.`, "");
  }
  out.push("---", "<sub>Opened by [Cursed Code Review](https://cursed-code-review.vercel.app). Every bug is a monster.</sub>");
  return out.join("\n");
}

/** e.g. "cursed-fixes/2026-11-05-a9607ea" */
export function defaultBranchName(review: Review, now = new Date()): string {
  const src = review.source;
  const sha = src.kind === "github" ? src.sha.slice(0, 7) : "fixes";
  return `cursed-fixes/${now.toISOString().slice(0, 10)}-${sha}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.replace(/\r\n?/g, "\n"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
