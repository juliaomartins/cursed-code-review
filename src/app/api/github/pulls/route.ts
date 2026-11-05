import { NextResponse, type NextRequest } from "next/server";
import { withGitHub } from "@/server/handler";
import { listPulls } from "@/server/repos";

export const dynamic = "force-dynamic";

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** GET /api/github/pulls?owner=&repo=: open pull requests, most recently updated first. */
export function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  const repo = req.nextUrl.searchParams.get("repo") ?? "";
  if (!NAME.test(owner) || !NAME.test(repo)) return NextResponse.json({ code: "bad_request", message: "Pick a repository first." }, { status: 400 });
  return withGitHub(req, ({ session }) => listPulls(session.accessToken, owner, repo));
}
