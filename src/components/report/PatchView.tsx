"use client";

import { useMemo } from "react";
import { diffLines, toHunks } from "@/lib/diff";
import type { ReviewFile } from "@/lib/types";
import { cx } from "../ui/cx";

export function PatchView({ file }: { file: ReviewFile }) {
  const hunks = useMemo(() => toHunks(diffLines(file.originalCode.split("\n"), file.code.split("\n"))), [file.originalCode, file.code]);
  const adds = hunks.flatMap((h) => h.lines).filter((l) => l.type === "add").length;
  const dels = hunks.flatMap((h) => h.lines).filter((l) => l.type === "del").length;
  return (
    <details className="group overflow-hidden rounded-2xl border border-line bg-card" open={hunks.length > 0}>
      <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-sm">{file.path}</span>
        <span className="flex items-center gap-3 font-mono text-xs">
          {hunks.length ? (
            <>
              <span className="text-fix-add">+{adds}</span>
              <span className="text-fix-del">−{dels}</span>
            </>
          ) : (
            <span className="text-ink-3">no changes</span>
          )}
        </span>
      </summary>
      {hunks.length > 0 && (
        <div className="scrollbar-thin relative overflow-x-auto border-t border-line font-mono text-[12.5px]">
          <table className="w-full min-w-max border-collapse">
            <tbody>
              {hunks.map((h) => (
                <HunkRows key={h.header} header={h.header} lines={h.lines} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function HunkRows({ header, lines }: { header: string; lines: ReturnType<typeof toHunks>[number]["lines"] }) {
  return (
    <>
      <tr>
        <td colSpan={3} className="bg-[#1b1526] px-4 py-1.5 text-ink-4">
          {header}
        </td>
      </tr>
      {lines.map((l, i) => (
        <tr key={i} className={cx(l.type === "add" && "bg-[rgba(111,242,176,0.08)]", l.type === "del" && "bg-[rgba(255,107,91,0.10)]")}>
          <td className="w-10 px-2 text-right text-ink-4 select-none">{l.a ?? ""}</td>
          <td className="w-10 px-2 text-right text-ink-4 select-none">{l.b ?? ""}</td>
          <td className={cx("px-3 py-0.5 whitespace-pre", l.type === "add" ? "text-fix-add" : l.type === "del" ? "text-fix-del" : "text-ink-2")}>
            <span className="select-none">{l.type === "add" ? "+ " : l.type === "del" ? "- " : "  "}</span>
            {l.text}
          </td>
        </tr>
      ))}
    </>
  );
}
