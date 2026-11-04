/**
 * Parses the `patch` field GitHub returns for each pull request file.
 * - `added`: new-file line numbers that the PR added or changed (monsters are hunted only here)
 * - `commentable`: new-file line numbers that appear in the diff (added or context), mapped to
 *   their hunk index. GitHub only accepts review comments on these lines, and a multi-line
 *   comment must stay inside one hunk.
 */
export interface ParsedPatch {
  added: number[];
  commentable: Map<number, number>;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string | undefined | null): ParsedPatch {
  const added: number[] = [];
  const commentable = new Map<number, number>();
  if (!patch) return { added, commentable };
  let line = 0;
  let hunk = -1;
  for (const raw of patch.split("\n")) {
    const h = HUNK.exec(raw);
    if (h) {
      line = Number(h[1]);
      hunk++;
      continue;
    }
    if (hunk < 0 || raw.startsWith("\\")) continue; // "\ No newline at end of file"
    const kind = raw[0];
    if (kind === "-") continue;
    if (kind === "+") added.push(line);
    commentable.set(line, hunk);
    line++;
  }
  return { added, commentable };
}

/** True when every line from `start` to `end` is commentable and in the same hunk. */
export function rangeIsCommentable(p: ParsedPatch, start: number, end: number): boolean {
  const hunk = p.commentable.get(start);
  if (hunk === undefined) return false;
  for (let l = start; l <= end; l++) if (p.commentable.get(l) !== hunk) return false;
  return true;
}
