import { beforeEach, describe, expect, it } from "vitest";
import { readExplored, recordExplored, repoKey, scannedFolder, timeAgo } from "../explored";
import { buildTree, defaultOpen, filterTree, folderPaths, type TreeFolder } from "../fileTree";
import { reviewFromScan } from "../review/factory";
import type { ReviewSource } from "../types";
import { fixtureScan } from "@/test/fixtures";

type GitHubSource = Extract<ReviewSource, { kind: "github" }>;

describe("file tree", () => {
  const files = () => reviewFromScan(fixtureScan()).files;

  it("nests folders, rolls monster counts up and lists folders before files", () => {
    const root = buildTree(files());
    expect(root.children.map((c) => c.name)).toEqual(["services", "src"]);
    const src = root.children[1] as TreeFolder;
    expect(src.children.map((c) => c.name)).toEqual(["auth", "routes"]);
    expect(src.files).toBe(2);
    expect(root.lurking).toBe(14);
    expect(src.lurking).toBe(src.children.reduce((n, c) => n + c.lurking, 0));
    expect(root.worst).toBe("CRITICAL");
  });

  it("joins chains of single folders into one row", () => {
    const [f] = files();
    const root = buildTree([{ ...f, path: "src/app/api/route.js" }]);
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({ type: "folder", name: "src/app/api", path: "src/app/api" });
  });

  it("filters files and drops folders left empty", () => {
    const root = buildTree(files());
    const only = filterTree(root, (f) => f.name.endsWith(".py"))!;
    expect(only.children.map((c) => c.name)).toEqual(["services"]);
    expect(only.files).toBe(1);
    expect(filterTree(root, () => false)!.children).toEqual([]);
  });

  it("opens the haunted folders first, or the top level when everything is clear", () => {
    const root = buildTree(files());
    expect([...defaultOpen(root)].sort()).toEqual(folderPaths(root).sort());
    const clean = buildTree(files().map((f) => ({ ...f, findings: [] })));
    expect([...defaultOpen(clean)].sort()).toEqual(["services", "src"]);
  });
});

describe("explored folders", () => {
  beforeEach(() => window.localStorage.clear());
  const source = (over: Partial<GitHubSource> = {}) => reviewFromScan(fixtureScan(over)).source as GitHubSource;

  it("knows which folder a scan covered", () => {
    expect(scannedFolder(source())).toBe("");
    expect(scannedFolder(source({ target: "folder", path: "/src/api/" }))).toBe("src/api");
    expect(scannedFolder(source({ target: "file", path: "a.js" }))).toBeNull();
  });

  it("remembers each folder scan and the repository's folder list", () => {
    const repo = source({ truncated: { total: 63, scanned: 40, folders: [{ path: "components", count: 31 }] } });
    recordExplored(repo, 40, 3, 1000);
    recordExplored(source({ target: "folder", path: "components" }), 31, 5, 2000);
    const saved = readExplored(repoKey(repo))!;
    expect(saved).toMatchObject({ total: 63, scanned: 40, folders: [{ path: "components", count: 31 }] });
    expect(saved.scans).toEqual({ "": { files: 40, monsters: 3, at: 1000 }, components: { files: 31, monsters: 5, at: 2000 } });
  });

  it("says how long ago", () => {
    const now = 10 * 24 * 3600000;
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60000, now)).toBe("5 min ago");
    expect(timeAgo(now - 3 * 3600000, now)).toBe("3 h ago");
    expect(timeAgo(now - 24 * 3600000, now)).toBe("1 day ago");
  });
});
