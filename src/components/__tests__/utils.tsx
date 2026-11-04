import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { SignInDialog } from "../auth/SignInDialog";
import { ToastProvider } from "../ui/Toast";
import { AuthProvider } from "@/providers/AuthProvider";
import { ReviewProvider } from "@/providers/ReviewProvider";
import { KEYS } from "@/lib/storage";
import type { Review } from "@/lib/types";

export { router, setSearch } from "@/test/navigation";

export function seedReview(review: Review) {
  window.localStorage.setItem(KEYS.review, JSON.stringify({ review, undo: [] }));
}

export function renderApp(ui: ReactElement) {
  return render(
    <ToastProvider>
      <AuthProvider signInDelayMs={0}>
        <ReviewProvider banishMs={0}>
          {ui}
          <SignInDialog />
        </ReviewProvider>
      </AuthProvider>
    </ToastProvider>,
  );
}
