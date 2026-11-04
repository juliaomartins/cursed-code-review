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
        toast({ ...m, title: status === "success" && live?.user ? `Signed in as @${live.user.login}` : m.title });
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
