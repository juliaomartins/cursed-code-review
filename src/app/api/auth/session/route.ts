import { NextResponse, type NextRequest } from "next/server";
import { getConfig, installUrlFor } from "@/server/config";
import { readSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Tells the frontend whether real GitHub is configured and who is signed in. Never returns tokens. */
export function GET(req: NextRequest) {
  const config = getConfig();
  if (!config) return NextResponse.json({ mode: "demo", user: null });
  const session = readSession(req, config.sessionSecret);
  return NextResponse.json({ mode: "live", user: session?.user ?? null, installUrl: installUrlFor(config) }, { headers: { "Cache-Control": "no-store" } });
}
