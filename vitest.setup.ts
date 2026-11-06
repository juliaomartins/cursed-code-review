import { afterEach, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("./src/test/navigation")).navigationMock);

// Browser-only setup; server tests run with `@vitest-environment node`.
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  window.scrollTo = () => {};
}
