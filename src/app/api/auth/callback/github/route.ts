import { NextResponse, type NextRequest } from "next/server";
import { CALLBACK_PATH, getConfig, originOf } from "@/server/config";
import { ApiError, exchangeCode, getUser } from "@/server/github";
import { clearState, readSession, readState, writeSession } from "@/server/session";

/** GitHub sends the user back here after they authorize (or install) the app. */
export async function GET(req: NextRequest) {
  const config = getConfig();
  if (!config) return NextResponse.redirect(new URL("/?auth=not_configured", req.url));
  const params = req.nextUrl.searchParams;
  const saved = readState(req, config.sessionSecret);
  const returnTo = saved?.returnTo ?? "/";
  const back = (status: string, extra: Record<string, string> = {}) => {
    const url = new URL(returnTo, originOf(req, config));
    url.searchParams.set("auth", status);
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    clearState(req, res);
    return res;
  };

  const ghError = params.get("error");
  if (ghError) return back(ghError === "access_denied" ? "denied" : "error", { reason: ghError.replace(/[^a-z_]/gi, "").slice(0, 40) });
  const code = params.get("code");
  if (!code) return back("error", { reason: "no_code" });
  // An install started on github.com (not from our button) carries no state; it is still a valid sign-in.
  const fromInstall = params.has("installation_id") && !params.get("state");
  if (!fromInstall && (!saved || saved.state !== params.get("state"))) {
    console.error("GitHub sign-in failed: state", { hasStateCookie: !!saved, hasStateParam: params.has("state"), installation: params.has("installation_id") });
    return back("error", { reason: saved ? "state_mismatch" : "state_missing" });
  }

  try {
    const tokens = await exchangeCode(config, code, `${originOf(req, config)}${CALLBACK_PATH}`);
    const user = await getUser(tokens.accessToken);
    const res = back(params.get("setup_action") === "install" ? "installed" : "success");
    writeSession(req, res, { user, ...tokens }, config.sessionSecret);
    return res;
  } catch (e) {
    const reason = e instanceof ApiError ? (e.detail ?? e.code) : "network";
    // Reloading this page (e.g. after a dropped connection) resends a code GitHub already used.
    // If that first attempt signed the user in, this is a success, not an error.
    if (reason === "bad_verification_code" && readSession(req, config.sessionSecret))
      return back(params.get("setup_action") === "install" ? "installed" : "success");
    console.error("GitHub sign-in failed:", reason, e instanceof Error ? e.message : e);
    return back("error", { reason: reason.replace(/[^a-z0-9_]/gi, "").slice(0, 40) });
  }
}
