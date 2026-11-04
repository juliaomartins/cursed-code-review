import { NextResponse, type NextRequest } from "next/server";
import { parsePrUrl } from "@/lib/github";
import { getConfig } from "@/server/config";
import { getPullRequest } from "@/server/github";
import { errorResponse, withGitHub } from "@/server/handler";
import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/github/pr?url=https://github.com/owner/repo/pull/12
 * Signed in: uses the user's token (public and private repos where the app is installed).
 * Signed out: public repositories only (optionally with a server GITHUB_TOKEN for a higher rate limit).
 */
export async function GET(req: NextRequest) {
  const parsed = parsePrUrl(req.nextUrl.searchParams.get("url") ?? "");
  if (!parsed.ok) return NextResponse.json({ code: "bad_request", message: parsed.error }, { status: 400 });
  const config = getConfig();
  if (config && readSession(req, config.sessionSecret))
    return withGitHub(req, ({ session }) => getPullRequest(parsed.ref, { token: session.accessToken, asUser: true, signInAvailable: true }));
  try {
    const pr = await getPullRequest(parsed.ref, { token: process.env.GITHUB_TOKEN?.trim() || undefined, asUser: false, signInAvailable: !!config });
    return NextResponse.json(pr, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
