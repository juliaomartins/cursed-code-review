import { NextResponse, type NextRequest } from "next/server";
import { CALLBACK_PATH, getConfig, originOf } from "@/server/config";
import { ApiError, exchangeCode, getUser } from "@/server/github";
import { clearState, readState, writeSession } from "@/server/session";

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

  if (params.get("error")) return back(params.get("error") === "access_denied" ? "denied" : "error");
  const code = params.get("code");
  if (!code) return back("error");
  // An install started on github.com (not from our button) carries no state; it is still a valid sign-in.
  const fromInstall = params.has("installation_id") && !params.get("state");
  if (!fromInstall && (!saved || saved.state !== params.get("state"))) return back("error", { reason: "state" });

  try {
    const tokens = await exchangeCode(config, code, `${originOf(req, config)}${CALLBACK_PATH}`);
    const user = await getUser(tokens.accessToken);
    const res = back(params.get("setup_action") === "install" ? "installed" : "success");
    writeSession(req, res, { user, ...tokens }, config.sessionSecret);
    return res;
  } catch (e) {
    return back("error", { reason: e instanceof ApiError ? e.code : "network" });
  }
}
