"use client";

import type { ReactNode } from "react";
import { SignInDialog } from "@/components/auth/SignInDialog";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "./AuthProvider";
import { ReviewProvider } from "./ReviewProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ReviewProvider>
          {children}
          <SignInDialog />
        </ReviewProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
