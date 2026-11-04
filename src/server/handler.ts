import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getConfig, type GitHubAppConfig } from "./config";
import { ApiError, ensureFresh } from "./github";
import { clearSession, readSession, writeSession, type Session } from "./session";

/**
 * Wraps an API route that needs the signed-in user's GitHub token:
 * checks configuration and session, refreshes the token if needed, and turns errors into JSON.
 */
export async function withGitHub(req: NextRequest, run: (ctx: { config: GitHubAppConfig; session: Session }) => Promise<unknown>) {
  const config = getConfig();
  if (!config) return NextResponse.json({ code: "not_configured", message: "GitHub is not connected on this deployment." }, { status: 503 });
  const current = readSession(req, config.sessionSecret);
  if (!current) return NextResponse.json({ code: "auth_required", message: "Sign in with GitHub to continue." }, { status: 401 });
  try {
    const { session, refreshed } = await ensureFresh(config, current);
    const data = await run({ config, session });
    const res = NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    if (refreshed) writeSession(req, res, session, config.sessionSecret);
    return res;
  } catch (e) {
    const res = errorResponse(e);
    if (e instanceof ApiError && e.code === "auth_required") clearSession(req, res);
    return res;
  }
}

/** Turns any thrown error into the JSON shape the frontend expects. */
export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ code: e.code, message: e.message, installUrl: e.installUrl }, { status: e.status });
  console.error("GitHub route failed", e);
  return NextResponse.json({ code: "network", message: "Could not reach GitHub. Try again." }, { status: 502 });
}
