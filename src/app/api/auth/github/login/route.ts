import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { CALLBACK_PATH, getConfig, installUrlFor, originOf, safeReturnTo } from "@/server/config";
import { writeState } from "@/server/session";

/**
 * Starts "Sign in with GitHub".
 * - default: GitHub's authorize screen
 * - ?install=1: GitHub's install screen (choose repositories); GitHub then signs the user in too,
 *   because the app has "Request user authorization (OAuth) during installation" enabled.
 */
export function GET(req: NextRequest) {
  const config = getConfig();
  if (!config) return NextResponse.redirect(new URL("/?auth=not_configured", req.url));
  const params = req.nextUrl.searchParams;
  const state = randomBytes(16).toString("hex");
  const returnTo = safeReturnTo(params.get("returnTo"));
  const target = params.get("install")
    ? `${installUrlFor(config)}?state=${state}`
    : `https://github.com/login/oauth/authorize?${new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: `${originOf(req, config)}${CALLBACK_PATH}`,
        state,
      })}`;
  const res = NextResponse.redirect(target);
  writeState(req, res, { state, returnTo }, config.sessionSecret);
  return res;
}
