"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { KEYS, readJson, writeJson } from "@/lib/storage";

export interface GitHubUser {
  login: string;
  name: string;
}

interface AuthValue {
  user: GitHubUser | null;
  hydrated: boolean;
  /** Opens the sign-in dialog. Resolves once the user has signed in (or rejects if they cancel). */
  requestSignIn: () => void;
  signInOpen: boolean;
  closeSignIn: () => void;
  completeSignIn: () => Promise<GitHubUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export const DEMO_USER: GitHubUser = { login: "midnight-dev", name: "Midnight Dev" };

export function AuthProvider({ children, signInDelayMs = 800 }: { children: ReactNode; signInDelayMs?: number }) {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount to avoid SSR mismatch
    setUser(readJson<GitHubUser>(KEYS.user));
    setHydrated(true);
  }, []);

  const completeSignIn = useCallback(
    () =>
      new Promise<GitHubUser>((resolve) => {
        setTimeout(() => {
          setUser(DEMO_USER);
          writeJson(KEYS.user, DEMO_USER);
          setSignInOpen(false);
          resolve(DEMO_USER);
        }, signInDelayMs);
      }),
    [signInDelayMs],
  );

  const signOut = useCallback(() => {
    setUser(null);
    writeJson(KEYS.user, null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      hydrated,
      signInOpen,
      requestSignIn: () => setSignInOpen(true),
      closeSignIn: () => setSignInOpen(false),
      completeSignIn,
      signOut,
    }),
    [user, hydrated, signInOpen, completeSignIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
