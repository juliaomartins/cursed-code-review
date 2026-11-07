"use client";

import type { TreeFile, TreeFolder, TreeNode } from "@/lib/fileTree";
import { SEVERITY } from "@/lib/monsters";
import type { Language, ReviewFile } from "@/lib/types";
import { Monster } from "../Monster";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { SeverityBadge } from "../ui/SeverityBadge";

const LANG: Record<Language, { label: string; color: string }> = {
  javascript: { label: "JS", color: "#f7df1e" },
  typescript: { label: "TS", color: "#4f8fe0" },
  python: { label: "PY", color: "#5aa0d8" },
  php: { label: "PHP", color: "#9a8fe0" },
};

interface FileTreeProps {
  root: TreeFolder;
  open: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (file: ReviewFile) => void;
  query: string;
}

/** The scanned files as folders you can open and close, with monsters counted on every folder. */
export function FileTree({ root, open, onToggle, onOpen, query }: FileTreeProps) {
  const max = Math.max(1, ...root.children.map((c) => c.lurking));
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {root.children.map((c) => (
        <Node key={key(c)} node={c} open={open} onToggle={onToggle} onOpen={onOpen} query={query} max={max} />
      ))}
    </ul>
  );
}

const key = (n: TreeNode) => (n.type === "folder" ? `d:${n.path}` : `f:${n.file.id}`);

function Node({ node, max, ...props }: Omit<FileTreeProps, "root"> & { node: TreeNode; max: number }) {
  if (node.type === "file") return <FileNode node={node} onOpen={props.onOpen} query={props.query} />;
  const isOpen = props.open.has(node.path);
  const childMax = Math.max(1, ...node.children.map((c) => c.lurking));
  const sev = node.worst ? SEVERITY[node.worst] : null;
  return (
    <li>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => props.onToggle(node.path)}
        aria-label={`${node.name}/: ${node.files} file${node.files === 1 ? "" : "s"}, ${node.lurking ? `${node.lurking} monster${node.lurking === 1 ? "" : "s"}` : "clear"}`}
        className="map-tree-row flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left"
      >
        <Icon name="chevronDown" size={16} className={cx("flex-none text-ink-4 transition-transform", !isOpen && "-rotate-90")} />
        <FolderIcon open={isOpen} haunted={node.lurking > 0} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{node.name}/</span>
        <span className="hidden w-24 sm:block" aria-hidden="true">
          {node.lurking > 0 && (
            <span className="block h-1.5 overflow-hidden rounded-full bg-track">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(8, (node.lurking / max) * 100)}%`, background: sev?.bg ?? "#C9A86A" }} />
            </span>
          )}
        </span>
        <span className="w-16 text-right font-mono text-xs text-ink-4">
          {node.files} file{node.files === 1 ? "" : "s"}
        </span>
        <Count lurking={node.lurking} />
      </button>
      {isOpen && (
        <ul className="m-0 ml-[19px] flex list-none flex-col gap-1 border-l border-dashed border-line-strong/70 p-0 pl-2.5">
          {node.children.map((c) => (
            <Node key={key(c)} node={c} max={childMax} {...props} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FileNode({ node, onOpen, query }: { node: TreeFile; onOpen: (f: ReviewFile) => void; query: string }) {
  const lang = LANG[node.file.language];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(node.file)}
        aria-label={`Open ${node.file.path}: ${node.lurking ? `${node.lurking} monster${node.lurking === 1 ? "" : "s"} lurking` : "clear"}`}
        className={cx(
          "map-tree-row group flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left",
          node.lurking ? "border-line bg-card/70 hover:border-ember/50" : "border-transparent",
        )}
      >
        <span
          aria-hidden="true"
          className="grid h-6 min-w-8 flex-none place-items-center rounded-md px-1 font-mono text-[10px] font-bold"
          style={{ color: lang.color, background: `${lang.color}1f` }}
        >
          {lang.label}
        </span>
        <span className={cx("min-w-0 flex-1 truncate font-mono text-sm", node.lurking ? "text-ink" : "text-ink-2")}>
          <Highlight text={node.name} query={query} />
        </span>
        {node.lurking > 0 ? (
          <>
            <span className="hidden items-center sm:flex" aria-hidden="true">
              {node.kinds.slice(0, 4).map((k, i) => (
                <span
                  key={k}
                  className={cx("transition-transform group-hover:-translate-y-0.5", i > 0 && "-ml-1.5")}
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <Monster kind={k} size={26} glow={false} />
                </span>
              ))}
              {node.kinds.length > 4 && <span className="ml-1 text-xs text-ink-3">+{node.kinds.length - 4}</span>}
            </span>
            {node.worst && <SeverityBadge severity={node.worst} />}
            <Count lurking={node.lurking} />
          </>
        ) : (
          <span className="flex items-center gap-1 text-xs text-banished">
            <Icon name="check" size={12} strokeWidth={3} /> {node.file.findings.length ? "cleared" : "clear"}
          </span>
        )}
      </button>
    </li>
  );
}

function Count({ lurking }: { lurking: number }) {
  return lurking > 0 ? (
    <span className="min-w-8 rounded-full bg-ember px-2 py-0.5 text-center font-mono text-sm font-bold text-ember-ink shadow-[0_0_12px_rgba(201,168,106,0.45)]">
      {lurking}
    </span>
  ) : (
    <span className="min-w-8 text-center text-banished" aria-hidden="true">
      <Icon name="check" size={14} strokeWidth={3} className="inline" />
    </span>
  );
}

function FolderIcon({ open, haunted }: { open: boolean; haunted: boolean }) {
  const fill = haunted ? "#ff8a3d" : "#8f84a8";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="flex-none">
      {open ? (
        <path
          d="M3 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1H7.5a2 2 0 0 0-1.9 1.4L3 19z M3 19l2.6-7.6A2 2 0 0 1 7.5 10H22l-2.8 8a2 2 0 0 1-1.9 1.3H3z"
          fill={fill}
          fillOpacity="0.85"
        />
      ) : (
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={fill} fillOpacity="0.75" />
      )}
    </svg>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-ember/30 px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
