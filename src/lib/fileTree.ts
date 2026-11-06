import { SEVERITY } from "./monsters";
import { lurkingOf } from "./review/selectors";
import type { MonsterKind, ReviewFile, Severity } from "./types";

export interface TreeFile {
  type: "file";
  name: string;
  file: ReviewFile;
  lurking: number;
  worst: Severity | null;
  kinds: MonsterKind[];
}

export interface TreeFolder {
  type: "folder";
  /** Display name; chains of single folders are joined, e.g. "src/app/api". */
  name: string;
  /** Full path from the root, without a trailing slash. "" for the root. */
  path: string;
  children: TreeNode[];
  files: number;
  lurking: number;
  worst: Severity | null;
}

export type TreeNode = TreeFolder | TreeFile;

const worse = (a: Severity | null, b: Severity | null): Severity | null => (!a ? b : !b ? a : SEVERITY[a].rank >= SEVERITY[b].rank ? a : b);

/** Builds a folder tree with monster counts rolled up into every folder. Folders first, then files, by name. */
export function buildTree(files: ReviewFile[]): TreeFolder {
  const root: TreeFolder = { type: "folder", name: "", path: "", children: [], files: 0, lurking: 0, worst: null };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const path = parts.slice(0, i + 1).join("/");
      let next = node.children.find((c): c is TreeFolder => c.type === "folder" && c.path === path);
      if (!next) {
        next = { type: "folder", name: parts[i], path, children: [], files: 0, lurking: 0, worst: null };
        node.children.push(next);
      }
      node = next;
    }
    const lurking = lurkingOf(file);
    node.children.push({
      type: "file",
      name: parts[parts.length - 1],
      file,
      lurking: lurking.length,
      worst: lurking.reduce<Severity | null>((w, f) => worse(w, f.severity), null),
      kinds: Array.from(new Set(lurking.map((f) => f.kind))),
    });
  }
  return finish(root);
}

function finish(folder: TreeFolder): TreeFolder {
  // Join chains like src → app → api into one row while a folder holds nothing but one folder.
  let f = folder;
  while (f.path && f.children.length === 1 && f.children[0].type === "folder") {
    const only = f.children[0];
    f = { ...only, name: `${f.name}/${only.name}` };
  }
  const children = f.children.map((c) => (c.type === "folder" ? finish(c) : c));
  children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1));
  let files = 0;
  let lurking = 0;
  let worst: Severity | null = null;
  for (const c of children) {
    files += c.type === "folder" ? c.files : 1;
    lurking += c.lurking;
    worst = worse(worst, c.worst);
  }
  return { ...f, children, files, lurking, worst };
}

/** Keeps only files that pass `keep`, dropping folders left empty. */
export function filterTree(folder: TreeFolder, keep: (f: TreeFile) => boolean): TreeFolder | null {
  const children: TreeNode[] = [];
  for (const c of folder.children) {
    if (c.type === "file") {
      if (keep(c)) children.push(c);
    } else {
      const sub = filterTree(c, keep);
      if (sub) children.push(sub);
    }
  }
  if (!children.length && folder.path) return null;
  let files = 0;
  let lurking = 0;
  let worst: Severity | null = null;
  for (const c of children) {
    files += c.type === "folder" ? c.files : 1;
    lurking += c.lurking;
    worst = worse(worst, c.worst);
  }
  return { ...folder, children, files, lurking, worst };
}

/** Every folder path in the tree. */
export function folderPaths(folder: TreeFolder): string[] {
  return folder.children.flatMap((c) => (c.type === "folder" ? [c.path, ...folderPaths(c)] : []));
}

/** Folders worth opening at first: those with monsters, or the top level when the tree is clear. */
export function defaultOpen(root: TreeFolder): Set<string> {
  const haunted = (f: TreeFolder): string[] => f.children.flatMap((c) => (c.type === "folder" && c.lurking > 0 ? [c.path, ...haunted(c)] : []));
  const open = haunted(root);
  if (open.length) return new Set(open);
  return new Set(root.children.filter((c): c is TreeFolder => c.type === "folder").map((c) => c.path));
}
