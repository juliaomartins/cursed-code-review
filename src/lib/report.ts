import { unifiedDiff } from "./diff";
import { MONSTERS } from "./monsters";
import { primaryLine } from "./review/apply";
import { reviewStats, worstSeverity } from "./review/selectors";
import type { Finding, Review } from "./types";
import type { ReviewComment } from "./github";

const STATUS_LABEL: Record<Finding["status"], string> = { lurking: "Lurking", banished: "Banished", ignored: "Ignored" };

export function formatDate(iso: string, locale = "en-US"): string {
  return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

/** Markdown export of a whole review. */
export function toMarkdown(review: Review, now = new Date()): string {
  const s = reviewStats(review);
  const all = review.files.flatMap((f) => f.findings);
  const worst = worstSeverity(all);
  const out: string[] = [];
  out.push(`# Cursed Code Review — ${review.source.label}`);
  out.push("");
  out.push(`_Generated ${formatDate(now.toISOString())}_${review.source.kind === "pr" || review.source.kind === "github" ? ` · [${review.source.label}](${review.source.url})` : ""}`);
  out.push("");
  out.push(s.lurking === 0 ? "**The crypt is clear.**" : `**${s.lurking} monster${s.lurking === 1 ? " still lurks" : "s still lurk"}.**`);
  out.push("");
  out.push("| Monsters found | Banished | Ignored | Lurking | Worst severity | Room light |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  out.push(`| ${s.total} | ${s.banished} | ${s.ignored} | ${s.lurking} | ${worst ?? "—"} | ${s.light}% |`);
  for (const file of review.files) {
    out.push("");
    out.push(`## \`${file.path}\``);
    out.push("");
    if (!file.findings.length) {
      out.push("No monsters found.");
      continue;
    }
    out.push("| Line | Monster | Bug | Severity | Status |");
    out.push("| --- | --- | --- | --- | --- |");
    for (const f of file.findings) {
      out.push(`| ${primaryLine(f)} | ${MONSTERS[f.kind].name} | ${f.bug} | ${f.severity} | ${STATUS_LABEL[f.status]} |`);
    }
    const patch = unifiedDiff(file.path, file.originalCode, file.code);
    if (patch) {
      out.push("");
      out.push("<details><summary>Patch</summary>");
      out.push("");
      out.push("```diff");
      out.push(patch);
      out.push("```");
      out.push("");
      out.push("</details>");
    }
  }
  out.push("");
  out.push("---");
  out.push("Built with Kiro for Kiroween 2026.");
  return out.join("\n") + "\n";
}

/**
 * Inline review comments for every monster that is lurking or was banished (ignored ones are skipped).
 * Positions and suggestions come from the original scan, because GitHub comments refer to the
 * PR's code, not to the fixes applied in the crypt.
 */
export function toReviewComments(review: Review): ReviewComment[] {
  return review.files.flatMap((file) =>
    file.findings
      .filter((f) => f.status !== "ignored")
      .map((f) => {
        const init = file.initialFindings.find((i) => i.id === f.id) ?? f;
        const start = init.fix.startLine;
        const end = start + Math.max(init.fix.before.length, 1) - 1;
        const body = [
          `**${MONSTERS[f.kind].name} · ${f.bug}** (${f.severity})`,
          "",
          f.why,
          "",
          "```suggestion",
          ...init.fix.after,
          "```",
          f.fix.note ? `\n_${f.fix.note}_` : "",
          "",
          "<sub>Found by Cursed Code Review</sub>",
        ]
          .join("\n")
          .trim();
        return end > start ? { path: file.path, line: end, startLine: start, body } : { path: file.path, line: start, body };
      }),
  );
}

export function reportFileName(review: Review): string {
  const base = review.source.label.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `cursed-review-${base || "report"}.md`;
}

const ISSUE_BODY_LIMIT = 60_000;

/**
 * A GitHub issue for a file, folder, repository, commit or comparison scan.
 * Lists every monster that wasn't ignored, linked to the exact line at the scanned commit,
 * with the suggested fix. Positions come from the original scan (the repo hasn't changed).
 */
export function toIssue(review: Review): { title: string; body: string } {
  const src = review.source;
  const blob = (path: string, line: number) =>
    src.kind === "github" ? `https://github.com/${src.owner}/${src.repo}/blob/${src.sha}/${path}#L${line}` : "";
  const items = review.files.flatMap((file) =>
    file.findings
      .filter((f) => f.status !== "ignored")
      .map((f) => ({ file, f, init: file.initialFindings.find((i) => i.id === f.id) ?? f })),
  );
  const count = items.length;
  const where = src.kind === "github" ? `${src.owner}/${src.repo}${src.path ? `/${src.path}` : ""}` : src.label;
  const title = `🎃 Cursed Code Review: ${count} monster${count === 1 ? "" : "s"} in ${where}`;
  const head = [
    `Cursed Code Review scanned **${review.files.length} file${review.files.length === 1 ? "" : "s"}**${src.kind === "github" ? ` at \`${src.sha.slice(0, 7)}\`` : ""} and found these bugs. Each one has a suggested fix.`,
    "",
  ];
  const parts: string[] = [];
  for (const file of review.files) {
    const mine = items.filter((x) => x.file === file);
    if (!mine.length) continue;
    parts.push(`### \`${file.path}\``, "");
    for (const { f, init } of mine) {
      const line = init.fix.startLine + init.lineOffsets[0];
      const loc = src.kind === "github" ? `[line ${line}](${blob(file.path, line)})` : `line ${line}`;
      parts.push(
        `- [ ] **${MONSTERS[f.kind].name} · ${f.bug}** (${f.severity}), ${loc}${f.status === "banished" ? " · _fix ready_" : ""}`,
        `  ${f.why}`,
        "  ```diff",
        ...init.fix.before.map((l) => `  - ${l}`),
        ...(init.fix.after.length ? init.fix.after.map((l) => `  + ${l}`) : ["  (delete these lines)"]),
        "  ```",
      );
    }
    parts.push("");
  }
  const foot = ["---", "<sub>Found by [Cursed Code Review](https://cursed-code-review.vercel.app). Every bug is a monster.</sub>"];
  let body = [...head, ...parts, ...foot].join("\n");
  if (body.length > ISSUE_BODY_LIMIT) {
    const cut = body.lastIndexOf("\n### ", ISSUE_BODY_LIMIT - 400);
    body = `${body.slice(0, cut > 0 ? cut : ISSUE_BODY_LIMIT - 400)}\n\n_…more monsters were found than fit in one issue. Export the full report from the app._\n\n${foot.join("\n")}`;
  }
  return { title, body };
}
