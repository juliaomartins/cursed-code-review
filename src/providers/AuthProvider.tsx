"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { signInUrl } from "@/lib/githubLive";

export interface GitHubUser {
  login: string;
  name: string;
  avatarUrl?: string;
}

/** "live" = a GitHub App is configured on the server, so users can sign in; "off" = public repositories only. */
export type AuthMode = "off" | "live";

interface AuthValue {
  user: GitHubUser | null;
  mode: AuthMode;
  hydrated: boolean;
  /** Opens the sign-in dialog. */
  requestSignIn: () => void;
  signInOpen: boolean;
  closeSignIn: () => void;
  /** Navigates to GitHub to sign in. */
  completeSignIn: () => void;
  /** Live only: sends the user to GitHub to install the app on more repositories. */
  installApp: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const AUTH_MESSAGES: Record<string, { title: string; description?: string; tone: "success" | "error" | "default" }> = {
  success: { title: "Connected to GitHub", description: "You can open pull requests from your repositories.", tone: "success" },
  installed: { title: "Cursed Code Review installed", description: "The repositories you picked are ready for the crypt.", tone: "success" },
  denied: { title: "Sign-in cancelled", description: "GitHub access was not granted.", tone: "default" },
  error: { title: "GitHub sign-in failed", description: "Please try again.", tone: "error" },
  not_configured: { title: "GitHub sign-in isn't available yet", description: "Public pull requests still work without signing in.", tone: "error" },
};

/** What went wrong during sign-in, keyed by the `reason` the callback reports. */
export const SIGN_IN_REASONS: Record<string, string> = {
  incorrect_client_credentials:
    "GitHub rejected this site's Client ID + client secret pair. Generate a new client secret on the GitHub App, put it in Vercel as GITHUB_APP_CLIENT_SECRET, and redeploy. /setup checks it for you.",
  redirect_uri_mismatch: "The GitHub App's Callback URL doesn't match this site. It must be exactly <this site>/api/auth/callback/github.",
  bad_verification_code: "The connection to GitHub dropped twice in a row. Check your connection (or turn off a VPN or web shield), then try again.",
  state_missing: "The sign-in started on a different address, or took longer than 10 minutes. Start again from this page.",
  state_mismatch: "Another sign-in was started in a different tab. Start again from this page.",
  unverified_user_email: "GitHub needs you to verify your email address before signing in to apps.",
  no_code: "GitHub didn't send a sign-in code back. Please try again.",
  network: "This site couldn't reach GitHub. Please try again.",
};

const currentPath = () => window.location.pathname + window.location.search.replace(/([?&])auth=[^&]*&?/, "$1").replace(/[?&]$/, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [mode, setMode] = useState<AuthMode>("off");
  const [hydrated, setHydrated] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let live: { mode: string; user: GitHubUser | null } | null = null;
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (res.ok) live = await res.json();
      } catch {
        /* offline: sign-in stays unavailable */
      }
      if (cancelled) return;
      if (live?.mode === "live") {
        setMode("live");
        setUser(live.user);
      }
      setHydrated(true);

      // Show the result of a GitHub round-trip (?auth=success|installed|denied|error), then clean the URL.
      const params = new URLSearchParams(window.location.search);
      const status = params.get("auth");
      if (status && AUTH_MESSAGES[status]) {
        const m = AUTH_MESSAGES[status];
        const reason = params.get("reason");
        const description = status === "error" && reason ? `${SIGN_IN_REASONS[reason] ?? "Please try again."} (GitHub: ${reason})` : m.description;
        toast({
          ...m,
          description,
          title: status === "success" && live?.user ? `Signed in as @${live.user.login}` : m.title,
          durationMs: status === "error" ? 20000 : undefined,
          // One click to start over, for anything that isn't a configuration problem.
          action:
            status === "error" && live?.mode === "live" && reason !== "incorrect_client_credentials" && reason !== "redirect_uri_mismatch"
              ? { label: "Try again", onClick: () => window.location.assign(signInUrl(currentPath())) }
              : undefined,
        });
        params.delete("auth");
        params.delete("reason");
        const q = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const completeSignIn = useCallback(() => window.location.assign(signInUrl(currentPath())), []);

  const installApp = useCallback(() => window.location.assign(signInUrl(currentPath(), true)), []);

  const signOut = useCallback(async () => {
    setUser(null);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      mode,
      hydrated,
      signInOpen,
      requestSignIn: () => mode === "live" && setSignInOpen(true),
      closeSignIn: () => setSignInOpen(false),
      completeSignIn,
      installApp,
      signOut,
    }),
    [user, mode, hydrated, signInOpen, completeSignIn, installApp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
