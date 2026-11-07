"use client";

import { useMemo, useState } from "react";
import { MONSTERS } from "@/lib/monsters";
import { banishAllPlan, REVIEW_FIRST } from "@/lib/review/bulk";
import type { Review } from "@/lib/types";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { Monster } from "../Monster";

type Scope = "file" | "all";

export function BanishAllDialog({
  open,
  onClose,
  review,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  review: Review;
  onConfirm: (fileIds: string[], includeTwins: boolean) => void;
}) {
  const multi = review.files.length > 1;
  const [scope, setScope] = useState<Scope>(multi ? "all" : "file");
  const [includeTwins, setIncludeTwins] = useState(false);
  const fileIds = useMemo(() => (scope === "all" ? review.files.map((f) => f.id) : [review.activeFileId]), [scope, review.files, review.activeFileId]);
  const plan = useMemo(() => banishAllPlan(review, fileIds, includeTwins ? [] : REVIEW_FIRST), [review, fileIds, includeTwins]);
  const applying = plan.reduce((n, p) => n + p.apply.length, 0);
  const skipped = plan.flatMap((p) => p.skip.map((f) => ({ f, path: p.file.path })));
  const hasTwins = review.files.some((f) => fileIds.includes(f.id) && f.findings.some((x) => x.status === "lurking" && x.kind === "twins"));

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button
        variant="primary"
        disabled={!applying}
        onClick={() => {
          onConfirm(fileIds, includeTwins);
          onClose();
        }}
      >
        <Icon name="flame" />
        Banish {applying} monster{applying === 1 ? "" : "s"}
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Banish all"
      description="Apply every remaining fix at once. You can undo it in one step."
      className="max-w-xl"
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        {multi && (
          <div role="radiogroup" aria-label="Which files" className="flex gap-1.5 rounded-xl bg-well p-1">
            {(
              [
                ["file", "This file"],
                ["all", `All ${review.files.length} files`],
              ] as [Scope, string][]
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={scope === v}
                onClick={() => setScope(v)}
                className={cx(
                  "min-h-11 flex-1 rounded-[9px] text-sm font-medium",
                  scope === v ? "bg-line-strong text-ink" : "text-ink-2 hover:bg-white/[0.04]",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {hasTwins && (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink-2">
            <input type="checkbox" checked={includeTwins} onChange={(e) => setIncludeTwins(e.target.checked)} className="mt-1 h-4 w-4 accent-[#C9A86A]" />
            <span>
              Include <strong className="text-ink">Twin Ghosts</strong> (race conditions). Their fix wraps code in a lock you need to define, so they&apos;re
              left for you to review by default.
            </span>
          </label>
        )}

        {plan.length === 0 ? (
          <p className="m-0 text-[15px] text-ink-2">Nothing left to banish here.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Fixes to apply">
            {plan.map((p) => (
              <li key={p.file.id} className="flex items-center gap-3 rounded-xl border border-line bg-well/50 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{p.file.path}</span>
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {Array.from(new Set(p.apply.map((f) => f.kind)))
                    .slice(0, 4)
                    .map((k) => (
                      <Monster key={k} kind={k} size={24} glow={false} />
                    ))}
                </span>
                <span className="font-mono text-sm text-ember-soft">
                  {p.apply.length} fix{p.apply.length === 1 ? "" : "es"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {skipped.length > 0 && (
          <details className="rounded-xl border border-line text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-ink-2">{skipped.length} left for you to review</summary>
            <ul className="m-0 flex list-none flex-col gap-1 border-t border-line p-3">
              {skipped.map(({ f, path }) => (
                <li key={f.id} className="text-ink-3">
                  {MONSTERS[f.kind].name} · {f.bug} in <span className="font-mono">{path.split("/").pop()}</span>
                  {f.stale ? " (its code changed)" : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Dialog>
  );
}
