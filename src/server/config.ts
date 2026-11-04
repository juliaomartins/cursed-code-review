import "server-only";

/**
 * GitHub App settings, read from environment variables.
 * When any required value is missing the app runs in demo mode (mock GitHub).
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

export function getConfig(): GitHubAppConfig | null {
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !slug || !sessionSecret || sessionSecret.length < 32) return null;
  return { clientId, clientSecret, slug, sessionSecret, appUrl: process.env.APP_URL?.trim().replace(/\/+$/, "") || undefined };
}

/** The public origin of this deployment, used to build the OAuth callback URL. */
export function originOf(req: Request, config: GitHubAppConfig): string {
  if (config.appUrl) return config.appUrl;
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
