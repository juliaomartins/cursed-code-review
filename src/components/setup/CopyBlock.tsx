"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** A read-only block of text with a "Copy" button. */
export function CopyBlock({ text, label, big = false }: { text: string; label: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text is selectable */
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3">{label}</span>
        <Button size="sm" variant={big ? "primary" : "outline"} onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? "Copied" : big ? "Copy all" : "Copy"}
        </Button>
      </div>
      <pre className="scrollbar-thin relative m-0 overflow-x-auto rounded-[10px] border border-line bg-well p-3 font-mono text-[13px] whitespace-pre text-ink select-all">
        {text}
      </pre>
    </div>
  );
}
