import { NextResponse, type NextRequest } from "next/server";
import { parsePrUrl } from "@/lib/github";
import { getPullRequest } from "@/server/github";
import { withGitHub } from "@/server/handler";

export const dynamic = "force-dynamic";

/** GET /api/github/pr?url=https://github.com/owner/repo/pull/12 */
export async function GET(req: NextRequest) {
  const parsed = parsePrUrl(req.nextUrl.searchParams.get("url") ?? "");
  if (!parsed.ok) return NextResponse.json({ code: "bad_request", message: parsed.error }, { status: 400 });
  return withGitHub(req, ({ config, session }) => getPullRequest(config, session.accessToken, parsed.ref));
}
