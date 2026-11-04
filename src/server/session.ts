import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export interface SessionUser {
  login: string;
  name: string;
  avatarUrl: string;
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires (GitHub App user tokens last 8 hours). */
  expiresAt?: number;
}

export const SESSION_COOKIE = "ccr_session";
export const STATE_COOKIE = "ccr_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const keyOf = (secret: string) => createHash("sha256").update(secret).digest();

/** Encrypts and authenticates a value with AES-256-GCM. Output: base64url(iv | tag | ciphertext). */
export function seal(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** Returns null for anything tampered with, expired keys or garbage. */
export function unseal<T>(token: string | undefined, secret: string): T | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const cookieBase = (req: NextRequest) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
  path: "/",
});

export function readSession(req: NextRequest, secret: string): Session | null {
  return unseal<Session>(req.cookies.get(SESSION_COOKIE)?.value, secret);
}

export function writeSession(req: NextRequest, res: NextResponse, session: Session, secret: string) {
  res.cookies.set(SESSION_COOKIE, seal(session, secret), { ...cookieBase(req), maxAge: SESSION_MAX_AGE });
}

export function clearSession(req: NextRequest, res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieBase(req), maxAge: 0 });
}

export interface OAuthState {
  state: string;
  returnTo: string;
}

export function writeState(req: NextRequest, res: NextResponse, value: OAuthState, secret: string) {
  res.cookies.set(STATE_COOKIE, seal(value, secret), { ...cookieBase(req), maxAge: 600 });
}

export function readState(req: NextRequest, secret: string): OAuthState | null {
  return unseal<OAuthState>(req.cookies.get(STATE_COOKIE)?.value, secret);
}

export function clearState(req: NextRequest, res: NextResponse) {
  res.cookies.set(STATE_COOKIE, "", { ...cookieBase(req), maxAge: 0 });
}
