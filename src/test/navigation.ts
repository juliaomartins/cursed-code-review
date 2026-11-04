import { vi } from "vitest";

export const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn(), forward: vi.fn() };
let searchParams = new URLSearchParams();
export const setSearch = (q: string) => {
  searchParams = new URLSearchParams(q);
};

export const navigationMock = {
  useRouter: () => router,
  useSearchParams: () => searchParams,
  usePathname: () => "/",
};
