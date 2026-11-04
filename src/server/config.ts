import "server-only";
import { hkdfSync } from "node:crypto";

/**
 * GitHub App settings, read from environment variables.
 * Only three are required; when any is missing, sign-in is off and public PRs still work.
 */
export interface GitHubAppConfig {
  clientId: string;
  clientSecret: string;
  /** The app's URL name, e.g. "cursed-code-review" in github.com/apps/cursed-code-review */
  slug: string;
  sessionSecret: string;
  /** Optional fixed public URL. Defaults to the URL of the incoming request. */
  appUrl?: string;
}

export const REQUIRED_ENV = ["GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_SLUG"] as const;

/** Names (never values) of required variables that are missing. */
export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
}

/**
 * The key that encrypts session cookies. SESSION_SECRET is optional: without it, a key is
 * derived from the client secret (which never leaves the server either).
 */
function sessionKey(clientSecret: string): string {
  const own = process.env.SESSION_SECRET?.trim();
  if (own && own.length >= 32) return own;
  return Buffer.from(hkdfSync("sha256", clientSecret, "cursed-code-review", "session-cookie-v1", 32)).toString("base64url");
}

export function getConfig(): GitHubAppConfig | null {
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  if (!clientId || !clientSecret || !slug) return null;
  return { clientId, clientSecret, slug, sessionSecret: sessionKey(clientSecret), appUrl: process.env.APP_URL?.trim().replace(/\/+$/, "") || undefined };
}

/** The public origin of this deployment, used to build the OAuth callback URL. */
export function originOf(req: Request, config?: Pick<GitHubAppConfig, "appUrl"> | null): string {
  if (config?.appUrl) return config.appUrl;
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const CALLBACK_PATH = "/api/auth/callback/github";

export const installUrlFor = (config: GitHubAppConfig) => `https://github.com/apps/${config.slug}/installations/new`;

/** Only allow same-site relative paths as post-login destinations. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
