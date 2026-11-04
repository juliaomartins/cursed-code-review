"use client";

import { useReview } from "@/providers/ReviewProvider";
import { reviewStats } from "@/lib/review/selectors";
import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

export function ResumeBanner() {
  const { review, hydrated } = useReview();
  if (!hydrated || !review) return null;
  const s = reviewStats(review);
  return (
    <div className="mx-auto box-border w-full max-w-[1280px] px-4 sm:px-7">
      <div className="flex animate-rise flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-strong bg-card-2 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-ember">
            <Icon name="flame" size={22} />
          </span>
          <p className="m-0 text-[15px]">
            <strong>Your hunt in {review.source.label} is waiting.</strong>{" "}
            <span className="text-ink-3">
              {s.lurking ? `${s.lurking} monster${s.lurking === 1 ? "" : "s"} still lurking` : "The crypt is clear"} · room light {s.light}%
            </span>
          </p>
        </div>
        <ButtonLink href={s.lurking ? "/crypt" : "/report"} variant="ember-outline" size="sm">
          {s.lurking ? "Return to the crypt" : "See the report"}
        </ButtonLink>
      </div>
    </div>
  );
}
