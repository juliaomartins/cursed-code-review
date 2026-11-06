import { unifiedDiff } from "./diff";
import { MONSTERS } from "./monsters";
import { primaryLine } from "./review/apply";
import { byPriority, SEVERITY_LABEL } from "./review/priority";
import { reviewStats } from "./review/selectors";
import { findingMeta } from "./scanner/rules";
import { secretValues } from "./scanner/secrets";
import type { Finding, Review, Severity } from "./types";
import type { ReviewComment } from "./github";

export function formatDate(iso: string, locale = "en-US"): string {
  return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

const IGNORE_LABEL: Record<NonNullable<Finding["ignoreReason"]>, string> = {
  "false-positive": "false positive",
  "accepted-risk": "accepted risk",
  "fix-elsewhere": "fixed outside the app",
};

/** Status as a developer reads it: Open, Fixed (and whether the re-scan confirmed it), Dismissed (why). */
export function statusLabel(f: Finding): string {
  if (f.status === "banished")
    return f.verification === "still-detected" ? "Fixed · re-scan still detects it" : f.verification === "resolved" ? "Fixed · verified by re-scan" : "Fixed";
  if (f.status === "ignored") return f.ignoreReason ? `Dismissed · ${IGNORE_LABEL[f.ignoreReason]}` : "Dismissed";
  return f.stale ? "Open · fix no longer applies" : "Open";
}

/** Replaces secret values with a marker, so reports and issues never carry a credential. */
export function redactSecrets(text: string): string {
  return text
    .split("\n")
    .map((line) => secretValues(line).reduce((l, v) => l.split(v).join("«redacted»"), line))
    .join("\n");
}

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MED", "LOW"];

/** Markdown export of a whole review, written to be shared with a team. */
export function toMarkdown(review: Review, now = new Date()): string {
  const s = reviewStats(review);
  const items = review.files.flatMap((file) => file.findings.map((f) => ({ f, file, path: file.path })));
  const open = items.filter((x) => x.f.status === "lurking");
  const out: string[] = [];
  const src = review.source;
  out.push(`# Code review report — ${src.label}`);
  out.push("");
  out.push(
    `- **Source:** ${src.kind === "pr" || src.kind === "github" ? `[${src.label}](${src.url})` : src.label}${src.kind === "github" ? ` at \`${src.sha.slice(0, 7)}\`` : src.kind === "pr" && src.headSha ? ` at \`${src.headSha.slice(0, 7)}\`` : ""}`,
  );
  out.push(`- **Files analysed:** ${review.files.length}`);
  out.push(`- **Scanned:** ${review.createdAt} · **Report generated:** ${now.toISOString()} (${formatDate(now.toISOString())})`);
  out.push(`- **Analysis:** static rules, one file at a time (Cursed Code Review). Findings are leads to review, not proof of exploitability.`);
  out.push("");
  out.push("## Summary");
  out.push("");
  out.push(
    s.lurking === 0
      ? s.total
        ? "**No open findings.**"
        : "**No findings.**"
      : `**${s.lurking} open finding${s.lurking === 1 ? "" : "s"}** out of ${s.total}.`,
  );
  out.push("");
  out.push("| Severity | Open | Fixed | Dismissed |");
  out.push("| --- | --- | --- | --- |");
  for (const sev of SEVERITIES) {
    const of = items.filter((x) => x.f.severity === sev);
    if (!of.length) continue;
    out.push(
      `| ${SEVERITY_LABEL[sev]} | ${of.filter((x) => x.f.status === "lurking").length} | ${of.filter((x) => x.f.status === "banished").length} | ${of.filter((x) => x.f.status === "ignored").length} |`,
    );
  }
  out.push(`| **Total** | **${s.lurking}** | **${s.banished}** | **${s.ignored}** |`);
  const categories = Array.from(new Set(items.map((x) => findingMeta(x.f).category)));
  if (categories.length) {
    out.push("");
    out.push(`By category: ${categories.map((c) => `${c} ${items.filter((x) => findingMeta(x.f).category === c).length}`).join(" · ")}.`);
  }

  if (open.length) {
    out.push("");
    out.push("## Fix first");
    out.push("");
    out.push("Open findings ranked by severity, confidence and whether untrusted input was seen reaching them.");
    out.push("");
    byPriority(open)
      .slice(0, 10)
      .forEach(({ f, path }, i) => {
        const m = findingMeta(f);
        out.push(
          `${i + 1}. **${SEVERITY_LABEL[f.severity]} · ${m.rule.title}** — \`${path}:${primaryLine(f)}${f.column ? `:${f.column}` : ""}\`${f.exposure ? " · takes untrusted input" : ""} · confidence ${m.confidence}`,
        );
      });
  }

  out.push("");
  out.push("## Findings");
  for (const file of review.files) {
    out.push("");
    out.push(`### \`${file.path}\``);
    out.push("");
    if (!file.findings.length) {
      out.push("No findings.");
      continue;
    }
    for (const f of [...file.findings].sort((a, b) => primaryLine(a) - primaryLine(b))) {
      const m = findingMeta(f);
      const loc = `${primaryLine(f)}${f.column ? `:${f.column}` : ""}`;
      out.push(`#### ${SEVERITY_LABEL[f.severity]} · ${m.rule.title} — line ${loc}`);
      out.push("");
      out.push(`- **Status:** ${statusLabel(f)}`);
      out.push(
        `- **Rule:** \`${m.ruleId}\` · ${m.category} · confidence ${m.confidence}${f.exposure ? " · untrusted input reaches it" : ""} · ${m.references.map((r) => `[${r.label}](${r.url})`).join(" · ")}`,
      );
      out.push(`- **What is wrong:** ${redactSecrets(f.why)}`);
      out.push(`- **Impact:** ${m.rule.impact}`);
      out.push(`- **How to fix:** ${m.rule.remediation}${f.fix.note ? ` ${f.fix.note}` : ""}`);
      if (m.autofix && f.status !== "banished") {
        out.push("");
        out.push("```diff");
        out.push(...f.fix.before.map((l) => `- ${redactSecrets(l)}`));
        out.push(...(f.fix.after.length ? f.fix.after.map((l) => `+ ${redactSecrets(l)}`) : ["(delete these lines)"]));
        out.push("```");
      }
      out.push("");
    }
    const patch = unifiedDiff(file.path, file.originalCode, file.code);
    if (patch) {
      out.push("<details><summary>Applied changes (patch)</summary>");
      out.push("");
      out.push("```diff");
      out.push(redactSecrets(patch));
      out.push("```");
      out.push("");
      out.push("</details>");
    }
  }
  out.push("");
  out.push("---");
  out.push("Generated by Cursed Code Review. Secret values are redacted. Built with Kiro for Kiroween 2026.");
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
        const manual = findingMeta(f).autofix === false;
        const body = [
          `**${MONSTERS[f.kind].name} · ${f.bug}** (${f.severity}) · \`${findingMeta(f).ruleId}\``,
          "",
          redactSecrets(f.why),
          "",
          ...(manual ? [`**How to fix:** ${findingMeta(f).rule.remediation}`] : ["```suggestion", ...init.fix.after, "```"]),
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
  const blob = (path: string, line: number) => (src.kind === "github" ? `https://github.com/${src.owner}/${src.repo}/blob/${src.sha}/${path}#L${line}` : "");
  const items = review.files.flatMap((file) =>
    file.findings.filter((f) => f.status !== "ignored").map((f) => ({ file, f, init: file.initialFindings.find((i) => i.id === f.id) ?? f })),
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
        `  ${redactSecrets(f.why)}`,
        ...(findingMeta(f).autofix === false
          ? [`  **How to fix:** ${findingMeta(f).rule.remediation}`]
          : [
              "  ```diff",
              ...init.fix.before.map((l) => `  - ${redactSecrets(l)}`),
              ...(init.fix.after.length ? init.fix.after.map((l) => `  + ${redactSecrets(l)}`) : ["  (delete these lines)"]),
              "  ```",
            ]),
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
