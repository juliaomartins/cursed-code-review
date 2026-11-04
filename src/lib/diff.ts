export type DiffLine = { type: "same" | "add" | "del"; text: string; a?: number; b?: number };

/** Line diff via LCS. Fine for files of a few thousand lines. */
export function diffLines(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i], a: i + 1, b: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: a[i], a: ++i });
    else out.push({ type: "add", text: b[j], b: ++j });
  }
  while (i < n) out.push({ type: "del", text: a[i], a: ++i });
  while (j < m) out.push({ type: "add", text: b[j], b: ++j });
  return out;
}

export interface Hunk {
  header: string;
  lines: DiffLine[];
}

/** Groups a diff into unified hunks with `context` lines around each change. */
export function toHunks(diff: DiffLine[], context = 3): Hunk[] {
  const changed = diff.map((d, i) => (d.type !== "same" ? i : -1)).filter((i) => i >= 0);
  if (!changed.length) return [];
  const ranges: [number, number][] = [];
  for (const idx of changed) {
    const s = Math.max(0, idx - context);
    const e = Math.min(diff.length - 1, idx + context);
    const last = ranges[ranges.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else ranges.push([s, e]);
  }
  return ranges.map(([s, e]) => {
    const lines = diff.slice(s, e + 1);
    const aStart = lines.find((l) => l.a)?.a ?? 0;
    const bStart = lines.find((l) => l.b)?.b ?? 0;
    const aLen = lines.filter((l) => l.type !== "add").length;
    const bLen = lines.filter((l) => l.type !== "del").length;
    return { header: `@@ -${aStart},${aLen} +${bStart},${bLen} @@`, lines };
  });
}

export function unifiedDiff(path: string, before: string, after: string): string {
  const hunks = toHunks(diffLines(before.split("\n"), after.split("\n")));
  if (!hunks.length) return "";
  const body = hunks
    .map((h) => [h.header, ...h.lines.map((l) => (l.type === "add" ? "+" : l.type === "del" ? "-" : " ") + l.text)].join("\n"))
    .join("\n");
  return `--- a/${path}\n+++ b/${path}\n${body}`;
}
