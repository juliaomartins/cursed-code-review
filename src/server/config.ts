import "server-only";
import { hkdfSync } from "node:crypto";

/**
 * GitHub App settings, read from environment variables.
 * Only three are required; when any is missing, sign-in is off and public PRs still work.
 */
export interface GitHubAppConfig {
  clientId: string;
  clientSecret: string;
  /** The app's URL name, e.g. "mateklamar-code-review" in github.com/apps/mateklamar-code-review */
  slug: string;
  sessionSecret: string;
  /** Optional fixed public URL. Defaults to the URL of the incoming request. */
  appUrl?: string;
}

export const REQUIRED_ENV = ["GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_SLUG"] as const;

/** Names (never values) of required variables that are missing. */
export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => (k === "GITHUB_APP_SLUG" ? !normalizeSlug(process.env[k]) : !process.env[k]?.trim()));
}

/**
 * The key that encrypts session cookies. SESSION_SECRET is optional: without it, a key is
 * derived from the client secret (which never leaves the server either).
 */
function sessionKey(clientSecret: string): string {
  const own = process.env.SESSION_SECRET?.trim();
  if (own && own.length >= 32) return own;
  // The salt below is a fixed cryptographic constant, not a brand string. Changing it derives a
  // different key, which invalidates every session cookie already issued and signs everyone out.
  // It deliberately kept its original value through the Mateklamar rename. Do not "tidy" it.
  return Buffer.from(hkdfSync("sha256", clientSecret, "cursed-code-review", "session-cookie-v1", 32)).toString("base64url");
}

/**
 * Accepts the slug itself or any GitHub App address people tend to paste:
 * "mateklamar-code-review", "https://github.com/apps/mateklamar-code-review",
 * "github.com/settings/apps/mateklamar-code-review/installations/new",
 * "https://github.com/organizations/acme/settings/apps/mateklamar-code-review".
 */
export function normalizeSlug(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/^["']|["']$/g, "");
  if (!v) return undefined;
  const fromUrl = /(?:^|\/)(?:settings\/)?apps\/([A-Za-z0-9-]+)/.exec(v);
  const slug = (fromUrl ? fromUrl[1] : v).replace(/\/+$/, "").toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(slug) ? slug : undefined;
}

export function getConfig(): GitHubAppConfig | null {
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const slug = normalizeSlug(process.env.GITHUB_APP_SLUG);
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
