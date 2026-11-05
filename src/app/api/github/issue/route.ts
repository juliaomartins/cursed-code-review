import { NextResponse, type NextRequest } from "next/server";
import { createIssue } from "@/server/github";
import { withGitHub } from "@/server/handler";

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** POST /api/github/issue: creates an issue as the signed-in user. */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { owner?: string; repo?: string; title?: string; body?: string } | null;
  const ok =
    b &&
    NAME.test(b.owner ?? "") &&
    NAME.test(b.repo ?? "") &&
    typeof b.title === "string" &&
    b.title.trim().length > 0 &&
    b.title.length <= 256 &&
    typeof b.body === "string" &&
    b.body.length <= 65_000;
  if (!ok || !b) return NextResponse.json({ code: "bad_request", message: "The issue needs a title and a body." }, { status: 400 });
  return withGitHub(req, ({ session }) => createIssue(session.accessToken, { owner: b.owner!, repo: b.repo!, title: b.title!.trim(), body: b.body! }));
}
