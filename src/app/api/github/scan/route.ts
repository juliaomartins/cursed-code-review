import { NextResponse, type NextRequest } from "next/server";
import { parseGitHubLink } from "@/lib/githubLinks";
import { getConfig } from "@/server/config";
import { getPullRequest, type PrAccess } from "@/server/github";
import { errorResponse, withGitHub } from "@/server/handler";
import { scanLink } from "@/server/scan";
import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/github/scan?url=<any GitHub link>
 * Pull requests, single files, folders, whole repositories, commits and branch comparisons.
 * Signed out: public repositories only.
 */
export async function GET(req: NextRequest) {
  const parsed = parseGitHubLink(req.nextUrl.searchParams.get("url") ?? "");
  if (!parsed.ok) return NextResponse.json({ code: "bad_request", message: parsed.error }, { status: 400 });
  const t = parsed.target;
  const run = (access: PrAccess) =>
    t.kind === "pr" ? getPullRequest({ owner: t.owner, repo: t.repo, number: t.number }, access).then((pr) => ({ target: "pr" as const, pr })) : scanLink(t, access);

  const config = getConfig();
  if (config && readSession(req, config.sessionSecret)) return withGitHub(req, ({ session }) => run({ token: session.accessToken, asUser: true, signInAvailable: true }));
  try {
    const data = await run({ token: process.env.GITHUB_TOKEN?.trim() || undefined, asUser: false, signInAvailable: !!config });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
