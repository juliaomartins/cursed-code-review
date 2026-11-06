import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { ReactElement } from "react";
import { SignInDialog } from "../auth/SignInDialog";
import { ToastProvider } from "../ui/Toast";
import { AuthProvider } from "@/providers/AuthProvider";
import { ReviewProvider } from "@/providers/ReviewProvider";
import { KEYS } from "@/lib/storage";
import type { Review } from "@/lib/types";

export { router, setPathname, setSearch } from "@/test/navigation";

export function seedReview(review: Review) {
  window.localStorage.setItem(KEYS.review, JSON.stringify({ review, undo: [] }));
}

export function renderApp(ui: ReactElement) {
  return render(
    <ToastProvider>
      <AuthProvider>
        <ReviewProvider banishMs={0}>
          {ui}
          <SignInDialog />
        </ReviewProvider>
      </AuthProvider>
    </ToastProvider>,
  );
}

type Handler = (init?: RequestInit) => { status?: number; json?: unknown };

/** Fakes this app's own /api routes for component tests. Unmatched calls fail like a network error. */
export function mockApi(routes: Record<string, Handler>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    const route = routes[key];
    if (!route) throw new TypeError(`fetch failed: ${key}`);
    const r = route(init);
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
}
