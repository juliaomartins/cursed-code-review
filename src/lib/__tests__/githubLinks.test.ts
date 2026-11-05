import { describe, expect, it } from "vitest";
import { describeLink, parseGitHubLink } from "../githubLinks";

const ok = (input: string) => {
  const r = parseGitHubLink(input);
  if (!r.ok) throw new Error(r.error);
  return r.target;
};

describe("parseGitHubLink", () => {
  it.each([
    ["https://github.com/acme/shop/pull/12", { kind: "pr", owner: "acme", repo: "shop", number: 12 }],
    ["acme/shop#12", { kind: "pr", owner: "acme", repo: "shop", number: 12 }],
    ["https://github.com/acme/shop", { kind: "repo", owner: "acme", repo: "shop" }],
    ["github.com/acme/shop.git", { kind: "repo", owner: "acme", repo: "shop" }],
    ["acme/shop", { kind: "repo", owner: "acme", repo: "shop" }],
    ["https://github.com/acme/shop/tree/main", { kind: "folder", owner: "acme", repo: "shop", rest: ["main"] }],
    ["https://github.com/acme/shop/tree/main/src/api", { kind: "folder", owner: "acme", repo: "shop", rest: ["main", "src", "api"] }],
    ["https://github.com/acme/shop/blob/feature/login/src/a.js", { kind: "file", owner: "acme", repo: "shop", rest: ["feature", "login", "src", "a.js"] }],
    ["https://github.com/acme/shop/blob/main/a.js#L3-L9", { kind: "file", owner: "acme", repo: "shop", rest: ["main", "a.js"], lines: [3, 9] }],
    ["https://github.com/acme/shop/blob/main/a.js#L7", { kind: "file", owner: "acme", repo: "shop", rest: ["main", "a.js"], lines: [7, 7] }],
    ["https://raw.githubusercontent.com/acme/shop/main/src/a.js", { kind: "file", owner: "acme", repo: "shop", rest: ["main", "src", "a.js"] }],
    ["https://github.com/acme/shop/commit/abc1234", { kind: "commit", owner: "acme", repo: "shop", sha: "abc1234" }],
    ["https://github.com/acme/shop/compare/main...feature/x", { kind: "compare", owner: "acme", repo: "shop", base: "main", head: "feature/x" }],
    ["https://github.com/acme/shop/compare/v1..v2", { kind: "compare", owner: "acme", repo: "shop", base: "v1", head: "v2" }],
  ])("understands %s", (input, target) => {
    expect(ok(input)).toEqual(target);
  });

  it.each([
    ["", /Paste a GitHub link/],
    ["https://gitlab.com/a/b", /Only github.com/],
    ["https://github.com/acme", /Link to a repository/],
    ["https://github.com/acme/shop/issues/3", /pull request, file, folder/],
    ["https://github.com/acme/shop/commit/zzz", /no valid commit/],
    ["https://github.com/acme/shop/compare/main", /compare link looks like/],
    ["https://github.com/acme/shop/blob/main", /missing the file path/],
  ])("rejects %j", (input, msg) => {
    const r = parseGitHubLink(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });

  it("describes what was detected", () => {
    expect(describeLink(ok("github.com/acme/shop/tree/main/src/api"))).toBe("Folder · src/api in acme/shop");
    expect(describeLink(ok("github.com/acme/shop/commit/abc1234def"))).toBe("Commit · changed lines only · abc1234");
    expect(describeLink(ok("github.com/acme/shop/compare/main...feat"))).toBe("Branch comparison · changed lines only · feat → main");
  });
});
