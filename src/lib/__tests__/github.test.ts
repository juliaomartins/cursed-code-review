import { describe, expect, it } from "vitest";
import { parsePrUrl } from "../github";

describe("parsePrUrl", () => {
  it.each([
    ["https://github.com/acme/shop/pull/42", { owner: "acme", repo: "shop", number: 42 }],
    ["github.com/acme/shop/pull/42/files", { owner: "acme", repo: "shop", number: 42 }],
    ["https://www.github.com/a-b/c.d/pull/1?x=1#y", { owner: "a-b", repo: "c.d", number: 1 }],
    ["acme/shop#7", { owner: "acme", repo: "shop", number: 7 }],
  ])("parses %s", (input, ref) => {
    expect(parsePrUrl(input)).toEqual({ ok: true, ref });
  });

  it.each([
    ["", /Paste a pull request link/],
    ["https://gitlab.com/a/b/pull/1", /Only github.com/],
    ["https://github.com/a/b/issues/1", /Link to a pull request/],
    ["https://github.com/a/b/pull/0", /positive whole number/],
    ["https://github.com/a/b/pull/abc", /positive whole number/],
    ["http://", /does not look like a link/],
  ])("rejects %j", (input, msg) => {
    const r = parsePrUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });
});
