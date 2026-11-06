"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReview } from "@/providers/ReviewProvider";
import { MONSTERS } from "@/lib/monsters";
import { formatDate, reportFileName, toMarkdown } from "@/lib/report";
import { primaryLine } from "@/lib/review/apply";
import { isDaybreak, reviewStats, worstSeverity } from "@/lib/review/selectors";
import { useDaybreak } from "@/lib/useDaybreak";
import type { Finding } from "@/lib/types";
import { DaybreakSky, Sun } from "../Daybreak";
import { Logo } from "../layout/Logo";
import { Monster } from "../Monster";
import { Lantern } from "../crypt/RoomLight";
import { Button, ButtonLink } from "../ui/Button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { SeverityBadge } from "../ui/SeverityBadge";
import { useToast } from "../ui/Toast";
import { PatchView } from "./PatchView";
import { fixDestination } from "@/lib/fixes";
import { ApplyFixesDialog } from "./ApplyFixesDialog";
import { CreateIssueDialog } from "./CreateIssueDialog";
import { PostReviewDialog } from "./PostReviewDialog";

const STATUS: Record<Finding["status"], { label: string; cls: string }> = {
  banished: { label: "Banished", cls: "bg-banished/[0.12] text-banished" },
  ignored: { label: "Ignored", cls: "bg-chip text-ink-2" },
  lurking: { label: "Lurking", cls: "bg-ember/[0.14] text-ember-soft" },
};

export function ReportView() {
  const { review, hydrated } = useReview();
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the date is client-only to avoid hydration mismatch
  useEffect(() => setToday(formatDate(new Date().toISOString())), []);
  const daybreak = !!review && isDaybreak(reviewStats(review));
  useDaybreak(daybreak, hydrated);

  if (!hydrated) return <div className="skeleton m-8 h-[70vh] rounded-2xl" aria-busy="true" aria-label="Loading report" />;
  if (!review) return <NoReport />;

  const s = reviewStats(review);
  const all = review.files.flatMap((f) => f.findings.map((x) => ({ f: x, file: f })));
  const worst = worstSeverity(all.map((a) => a.f));
  const trapped = Array.from(new Set(all.filter((a) => a.f.status === "banished").map((a) => a.f.kind))).slice(0, 3);
  const multi = review.files.length > 1;
  const isPr = review.source.kind === "pr";
  const isGitHubScan = review.source.kind === "github";
  const canApply = fixDestination(review).mode !== null;
  const hasFixes = review.files.some((f) => f.code !== f.originalCode);
  const clear = s.lurking === 0;

  const download = () => {
    const md = toMarkdown(review);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFileName(review);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast({ title: "Report exported", description: a.download, tone: "success" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(review));
      toast({ title: "Markdown copied", description: "Paste it into a PR, issue or doc." });
    } catch {
      toast({ title: "Could not copy", description: "Your browser blocked clipboard access.", tone: "error" });
    }
  };

  const cards = [
    { label: "Monsters found", value: s.total, icon: <Monster kind="wraith" size={52} /> },
    {
      label: "Banished (fixed)",
      value: s.banished,
      icon: (
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-ember/[0.14] text-ember">
          <Icon name="flame" size={26} />
        </span>
      ),
    },
    {
      label: "Ignored",
      value: s.ignored,
      icon: (
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-track text-ink-3">
          <Icon name="eyeOff" size={26} />
        </span>
      ),
    },
    ...(s.lurking
      ? [
          {
            label: "Still lurking",
            value: s.lurking,
            icon: (
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-sev-high/[0.14] text-sev-high">
                <Icon name="alert" size={26} />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="report-root relative flex min-h-screen flex-col">
      {daybreak && <DaybreakSky />}
      <header className="relative z-10 mx-auto box-border flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-[18px] sm:px-7">
        <Logo size={38} />
        <ButtonLink href="/crypt" variant="outline">
          <Icon name="arrowLeft" size={16} strokeWidth={2.2} />
          Back to the crypt
        </ButtonLink>
      </header>

      <main id="main" className="relative z-10 mx-auto box-border flex w-full max-w-[1280px] flex-col gap-11 px-4 pt-10 pb-20 sm:px-7">
        <section className="flex flex-wrap items-center justify-between gap-8">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
            <span className="font-mono text-xs tracking-[0.14em] break-words text-ink-3">
              REVIEW REPORT · {review.source.label} {today ? `· ${today.toUpperCase()}` : ""}
            </span>
            <h1 className={cx("m-0 font-display text-[56px] leading-[0.95] font-bold sm:text-[88px]", clear && "[text-shadow:0_0_36px_rgba(255,178,90,0.45)]")}>
              {clear ? "The crypt is clear." : "The crypt still stirs."}
            </h1>
            <div className="flex flex-wrap items-center gap-3.5">
              {daybreak ? <Sun /> : <Lantern />}
              <div
                role="progressbar"
                aria-label="Room light"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={s.light}
                className="h-2 w-[200px] overflow-hidden rounded-full bg-track sm:w-[260px]"
              >
                <div className="h-full bg-gradient-to-r from-ember to-ember-gold shadow-[0_0_12px_#FF8A3D]" style={{ width: `${s.light}%` }} />
              </div>
              <span className="font-mono text-[13px] text-ember-gold">
                {daybreak ? "DAYLIGHT" : "ROOM LIGHT"} {s.light}%
              </span>
            </div>
            {!clear && (
              <p className="m-0 text-[15px] text-ink-2">
                {s.lurking} monster{s.lurking === 1 ? " is" : "s are"} still in the code. <Link href="/crypt">Return to the crypt</Link> to finish the hunt, or
                export the report as it stands.
              </p>
            )}
          </div>
          <div className="relative h-[220px] min-w-0 flex-[0_1_420px]" aria-hidden="true">
            <svg viewBox="0 0 420 220" width="100%" height="220" className="absolute inset-0">
              <defs>
                <radialGradient id="ccr-r-glow">
                  <stop offset="0" stopColor="#FFB25A" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#FFB25A" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="210" cy="120" rx="200" ry="100" fill="url(#ccr-r-glow)" />
              <path d="M150 140 L270 140 L262 214 L158 214 Z" fill="#1D1628" stroke="#3D3154" strokeWidth="2" />
              <path d="M140 132 H280 V142 H140 Z" fill="#3D3154" />
            </svg>
            <div className="absolute top-[18px] left-1/2 flex -translate-x-1/2 items-end gap-1 opacity-55 grayscale-[0.6]">
              {trapped.map((k) => (
                <Monster key={k} kind={k} size={56} glow={false} />
              ))}
            </div>
            <span className="absolute bottom-[26px] left-1/2 -translate-x-1/2 font-display text-[22px] text-ember-gold">
              {trapped.length ? "Trapped" : "Empty jar"}
            </span>
          </div>
        </section>

        <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
          {cards.map((c) => (
            <div key={c.label} className="flex items-center gap-4 rounded-2xl border border-line bg-card-2 p-[22px]">
              {c.icon}
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-ink-3">{c.label}</span>
                <span className="font-display text-[44px] leading-none font-bold" data-testid={`stat-${c.label}`}>
                  {c.value}
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-card-2 p-[22px]">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-3">Worst severity</span>
              {worst ? (
                <SeverityBadge severity={worst} className="self-start px-3 py-1 text-sm" />
              ) : (
                <span className="font-display text-[44px] leading-none">—</span>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="found" className="flex flex-col gap-3.5">
          <h2 id="found" className="m-0 font-display text-[40px] font-bold">
            What lurked in the code
          </h2>
          {all.length === 0 ? (
            <p className="m-0 rounded-2xl border border-line bg-card p-6 text-ink-2">No monsters were found. Every static check came back quiet.</p>
          ) : (
            <div className="scrollbar-thin relative overflow-x-auto rounded-2xl border border-line bg-card">
              <table aria-labelledby="found" className="w-full min-w-[720px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-left font-mono text-xs tracking-[0.12em] text-ink-3">
                    <th scope="col" className="px-[18px] py-3.5 font-medium">
                      MONSTER
                    </th>
                    {multi && (
                      <th scope="col" className="px-[18px] py-3.5 font-medium">
                        FILE
                      </th>
                    )}
                    <th scope="col" className="px-[18px] py-3.5 font-medium">
                      LINE
                    </th>
                    <th scope="col" className="px-[18px] py-3.5 font-medium">
                      BUG
                    </th>
                    <th scope="col" className="px-[18px] py-3.5 font-medium">
                      SEVERITY
                    </th>
                    <th scope="col" className="px-[18px] py-3.5 font-medium">
                      STATUS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {all.map(({ f, file }) => (
                    <tr key={f.id} className="border-t border-line">
                      <td className="px-[18px] py-2.5">
                        <span className="flex items-center gap-3">
                          <Monster kind={f.kind} size={40} glow={false} />
                          <strong>{MONSTERS[f.kind].name}</strong>
                        </span>
                      </td>
                      {multi && <td className="px-[18px] py-2.5 font-mono text-[13px] text-ink-2">{file.path.split("/").pop()}</td>}
                      <td className="px-[18px] py-2.5 font-mono">{primaryLine(f)}</td>
                      <td className="px-[18px] py-2.5 text-ink-2">{f.bug}</td>
                      <td className="px-[18px] py-2.5">
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td className="px-[18px] py-2.5">
                        <span className={cx("rounded-full px-2.5 py-1 text-[13px] font-medium", STATUS[f.status].cls)}>{STATUS[f.status].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="spellbook" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="spellbook" className="m-0 font-display text-[40px] font-bold">
              The spell book
            </h2>
            <p className="m-0 text-sm text-ink-3">Every fix you applied, as a patch.</p>
          </div>
          {review.files.map((f) => (
            <PatchView key={f.id} file={f} />
          ))}
        </section>

        <section className="flex flex-wrap items-center gap-3">
          {canApply &&
            (review.fixesUrl ? (
              <GitHubLink href={review.fixesUrl} primary>
                <Icon name="flame" strokeWidth={2.2} />
                {isPr ? "View the PR with your fixes" : "View fix PR on GitHub"}
              </GitHubLink>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={() => setApplying(true)}
                disabled={!hasFixes}
                aria-describedby={!hasFixes ? "apply-hint" : undefined}
                className="shadow-[0_0_28px_rgba(255,138,61,0.4)]"
              >
                <Icon name="flame" strokeWidth={2.2} />
                {isPr ? "Push fixes to this PR" : "Open a fix PR"}
              </Button>
            ))}
          {review.postedReviewUrl && (isGitHubScan || isPr) ? (
            <GitHubLink href={review.postedReviewUrl} primary={!canApply}>
              <Icon name="github" strokeWidth={2.2} />
              {isGitHubScan ? "View issue on GitHub" : "View review on GitHub"}
            </GitHubLink>
          ) : isGitHubScan ? (
            <Button variant={canApply ? "outline" : "primary"} size="lg" onClick={() => setIssuing(true)}>
              <Icon name="github" strokeWidth={2.2} />
              Create GitHub issue
            </Button>
          ) : (
            <Button
              variant={canApply ? "outline" : "primary"}
              size="lg"
              onClick={() => setPosting(true)}
              disabled={!isPr}
              aria-describedby={!isPr ? "post-hint" : undefined}
            >
              <Icon name="pr" strokeWidth={2.2} />
              Post review to GitHub PR
            </Button>
          )}
          {review.files.length > 1 && (
            <ButtonLink href="/map" variant="outline" size="lg">
              <Icon name="search" />
              Haunted Map
            </ButtonLink>
          )}
          <Button variant="outline" size="lg" onClick={download}>
            <Icon name="download" />
            Export report (.md)
          </Button>
          <Button variant="ghost" size="lg" onClick={copy}>
            <Icon name="copy" />
            Copy markdown
          </Button>
          <ButtonLink href="/#start" variant="outline" size="lg">
            Scan something else
          </ButtonLink>
          {canApply && !hasFixes && !review.fixesUrl && (
            <p id="apply-hint" className="m-0 w-full text-[13px] text-ink-3">
              Banish monsters in the crypt first, then send the fixed code to GitHub as {isPr ? "commits on this pull request" : "a new pull request"}.
            </p>
          )}
          {!isPr && !isGitHubScan && (
            <p id="post-hint" className="m-0 w-full text-[13px] text-ink-3">
              Posting to GitHub is available when you open a GitHub link in the crypt.
            </p>
          )}
        </section>
      </main>
      <PostReviewDialog open={posting} onClose={() => setPosting(false)} review={review} />
      <CreateIssueDialog open={issuing} onClose={() => setIssuing(false)} review={review} />
      {applying && <ApplyFixesDialog open onClose={() => setApplying(false)} review={review} />}
    </div>
  );
}

function NoReport() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center">
      <Monster kind="twins" size={120} />
      <h1 className="m-0 font-display text-5xl leading-none">No hunt to report.</h1>
      <p className="m-0 max-w-md text-ink-2">Open the crypt and face a few monsters first. Your report will appear here.</p>
      <ButtonLink href="/crypt?sample=cursed-login" variant="primary" size="lg">
        Enter the crypt
      </ButtonLink>
    </div>
  );
}

/** A link to something already on GitHub, styled like the report's buttons. Opens in a new tab. */
function GitHubLink({ href, primary = false, children }: { href: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx(
        "inline-flex min-h-14 items-center justify-center gap-2.5 rounded-xl px-6 text-base whitespace-nowrap no-underline transition-colors",
        primary
          ? "bg-ember font-bold text-ember-ink shadow-[0_0_28px_rgba(255,138,61,0.4)] hover:bg-[#ff9a55] hover:text-ember-ink"
          : "border border-line-strong font-medium text-ink hover:border-ink-4 hover:text-ink",
      )}
    >
      {children}
      <Icon name="external" size={16} />
    </a>
  );
}
