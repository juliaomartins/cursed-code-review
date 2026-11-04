import { NextResponse, type NextRequest } from "next/server";
import { getConfig, installUrlFor, missingEnv } from "@/server/config";
import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Tells the frontend whether GitHub sign-in is available and who is signed in. Never returns tokens. */
export function GET(req: NextRequest) {
  const config = getConfig();
  // `missing` lists variable names only, to help whoever sets up the deployment.
  if (!config) return NextResponse.json({ mode: "off", user: null, missing: missingEnv() });
  const session = readSession(req, config.sessionSecret);
  return NextResponse.json({ mode: "live", user: session?.user ?? null, installUrl: installUrlFor(config) }, { headers: { "Cache-Control": "no-store" } });
}
