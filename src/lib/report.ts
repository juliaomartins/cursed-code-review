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
  out.push(`_Generated ${formatDate(now.toISOString())}_${review.source.kind === "pr" ? ` · [${review.source.label}](${review.source.url})` : ""}`);
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

/** Inline comments for every monster that is still lurking or was banished (suggesting the fix). */
export function toReviewComments(review: Review): ReviewComment[] {
  return review.files.flatMap((file) =>
    file.findings
      .filter((f) => f.status !== "ignored")
      .map((f) => ({
        path: file.path,
        line: primaryLine(f),
        body: [
          `**${MONSTERS[f.kind].name} · ${f.bug}** (${f.severity})`,
          "",
          f.why,
          "",
          "```suggestion",
          ...f.fix.after,
          "```",
          f.fix.note ? `\n_${f.fix.note}_` : "",
        ]
          .join("\n")
          .trim(),
      })),
  );
}

export function reportFileName(review: Review): string {
  const base = review.source.label.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `cursed-review-${base || "report"}.md`;
}
