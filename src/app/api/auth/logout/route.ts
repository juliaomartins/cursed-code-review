import { NextResponse, type NextRequest } from "next/server";
import { clearSession } from "@/server/session";

export function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearSession(req, res);
  return res;
}
