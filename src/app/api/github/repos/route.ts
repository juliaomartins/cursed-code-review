import type { NextRequest } from "next/server";
import { withGitHub } from "@/server/handler";
import { listRepos } from "@/server/repos";

export const dynamic = "force-dynamic";

/** GET /api/github/repos: repositories the signed-in user can open, newest activity first. */
export function GET(req: NextRequest) {
  return withGitHub(req, ({ session, config }) => listRepos(session.accessToken, config.slug));
}
