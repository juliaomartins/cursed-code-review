import { NextResponse, type NextRequest } from "next/server";
import type { ReviewComment } from "@/lib/github";
import { createReview } from "@/server/github";
import { withGitHub } from "@/server/handler";

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const EVENTS = ["COMMENT", "REQUEST_CHANGES", "APPROVE"] as const;

interface Body {
  owner?: string;
  repo?: string;
  number?: number;
  commitId?: string;
  event?: (typeof EVENTS)[number];
  body?: string;
  comments?: ReviewComment[];
}

/** POST /api/github/review — posts the review as the signed-in user. */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as Body | null;
  const valid =
    b &&
    NAME.test(b.owner ?? "") &&
    NAME.test(b.repo ?? "") &&
    Number.isInteger(b.number) &&
    (b.number ?? 0) > 0 &&
    /^[0-9a-f]{40}$/.test(b.commitId ?? "") &&
    EVENTS.includes(b.event as (typeof EVENTS)[number]) &&
    typeof b.body === "string" &&
    b.body.length <= 60_000 &&
    Array.isArray(b.comments) &&
    b.comments.length <= 200 &&
    b.comments.every((c) => typeof c.path === "string" && Number.isInteger(c.line) && typeof c.body === "string" && c.body.length <= 20_000);
  if (!valid || !b) return NextResponse.json({ code: "bad_request", message: "The review request is incomplete." }, { status: 400 });
  return withGitHub(req, ({ session }) =>
    createReview(session.accessToken, {
      ref: { owner: b.owner!, repo: b.repo!, number: b.number! },
      commitId: b.commitId!,
      event: b.event!,
      body: b.body!,
      comments: b.comments!,
    }),
  );
}
