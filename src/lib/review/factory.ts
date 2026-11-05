import type { PullRequest, ScanResult } from "../github";
import { SAMPLES } from "../samples";
import { LANGUAGE_EXT, scan } from "../scanner";
import type { Language, Review, ReviewFile, ReviewSource } from "../types";

let counter = 0;
export const newId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function makeFile(id: string, path: string, language: Language, code: string, changedLines?: number[]): ReviewFile {
  const normalised = code.replace(/\r\n?/g, "\n");
  const findings = scan(normalised, language, { fileId: id, onlyLines: changedLines });
  return { id, path, language, originalCode: normalised, code: normalised, changedLines, findings, initialFindings: findings };
}

function build(source: ReviewSource, files: ReviewFile[], activeFileId?: string): Review {
  const active = files.find((f) => f.id === activeFileId) ?? files[0];
  return {
    id: newId("rev"),
    createdAt: new Date().toISOString(),
    source,
    files,
    activeFileId: active.id,
    selectedFindingId: active.findings[0]?.id ?? null,
  };
}

/** All three cursed samples, with `sampleId` opened first. */
export function reviewFromSamples(sampleId?: string): Review {
  const files = SAMPLES.map((s) => makeFile(s.id, s.path, s.language, s.code));
  return build({ kind: "sample", label: "Cursed samples" }, files, sampleId);
}

export function reviewFromPaste(code: string, language: Language, fileName?: string): Review {
  const name = fileName?.trim() || `pasted.${LANGUAGE_EXT[language]}`;
  return build({ kind: "paste", label: name }, [makeFile("pasted", name, language, code)]);
}

export function reviewFromPullRequest(pr: PullRequest): Review {
  const files = pr.files.map((f, i) => makeFile(`pr${i}`, f.path, f.language, f.code, f.changedLines));
  const firstWithMonsters = files.find((f) => f.findings.length)?.id;
  return build(
    {
      kind: "pr",
      label: `${pr.owner}/${pr.repo}#${pr.number}`,
      url: pr.url,
      owner: pr.owner,
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      baseRef: pr.baseRef,
      headRef: pr.headRef,
      headSha: pr.headSha,
      live: !!pr.headSha,
      skippedFiles: pr.skippedFiles,
    },
    files,
    firstWithMonsters,
  );
}

const SCAN_LABEL: Record<ScanResult["target"], (r: ScanResult) => string> = {
  file: (r) => `${r.repo}/${r.path ?? ""}`,
  folder: (r) => `${r.owner}/${r.repo}/${r.path ?? ""}`,
  repo: (r) => `${r.owner}/${r.repo}`,
  commit: (r) => `${r.owner}/${r.repo}@${r.sha.slice(0, 7)}`,
  compare: (r) => `${r.owner}/${r.repo} ${r.title}`,
};

/** A review of a file, folder, repository, commit or comparison loaded from GitHub. */
export function reviewFromScan(r: ScanResult): Review {
  const files = r.files.map((f, i) => {
    const file = makeFile(`gh${i}`, f.path, f.language, f.code, f.changedLines);
    return r.lines && r.files.length === 1 ? { ...file, focusLines: r.lines } : file;
  });
  // Open the most haunted file first.
  const first = [...files].sort((a, b) => b.findings.length - a.findings.length)[0];
  return build(
    {
      kind: "github",
      target: r.target,
      label: SCAN_LABEL[r.target](r),
      title: r.title,
      url: r.url,
      owner: r.owner,
      repo: r.repo,
      ref: r.ref,
      sha: r.sha,
      path: r.path,
      skippedFiles: r.skippedFiles,
      truncated: r.truncated,
    },
    files,
    first?.findings.length ? first.id : undefined,
  );
}
