import type { Review, ReviewFile } from "../types";
import { applyFix, relocate } from "./apply";
import { lurkingOf, nextLurking } from "./selectors";

export interface Snapshot {
  file: ReviewFile;
  selectedFindingId: string | null;
  label: string;
}

export interface ReviewState {
  review: Review | null;
  undo: Snapshot[];
  /** The id of the finding currently playing its banish animation. */
  banishing: string | null;
}

export type ReviewAction =
  | { type: "start"; review: Review }
  | { type: "hydrate"; state: Pick<ReviewState, "review" | "undo"> }
  | { type: "selectFile"; fileId: string }
  | { type: "select"; findingId: string | null }
  | { type: "step"; direction: 1 | -1 }
  | { type: "beginBanish"; findingId: string }
  | { type: "banish"; findingId: string }
  | { type: "ignore"; findingId: string }
  | { type: "restore"; findingId: string }
  | { type: "undo" }
  | { type: "resetFile"; fileId: string }
  | { type: "posted"; url: string }
  | { type: "close" };

export const initialState: ReviewState = { review: null, undo: [], banishing: null };

const UNDO_LIMIT = 30;

function updateFile(review: Review, fileId: string, fn: (f: ReviewFile) => ReviewFile): Review {
  return { ...review, files: review.files.map((f) => (f.id === fileId ? fn(f) : f)) };
}

function fileOf(review: Review, findingId: string): ReviewFile | undefined {
  return review.files.find((f) => f.findings.some((x) => x.id === findingId));
}

function pushUndo(state: ReviewState, file: ReviewFile, label: string): Snapshot[] {
  const snap: Snapshot = { file, selectedFindingId: state.review?.selectedFindingId ?? null, label };
  return [...state.undo, snap].slice(-UNDO_LIMIT);
}

/** After resolving a finding, select the next one in the same file (or nothing). */
function selectAfter(file: ReviewFile, resolvedId: string): string | null {
  return nextLurking(file, resolvedId)?.id ?? null;
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  if (action.type === "start") return { review: action.review, undo: [], banishing: null };
  if (action.type === "hydrate") return { ...state, ...action.state, banishing: null };
  const review = state.review;
  if (!review) return state;

  switch (action.type) {
    case "close":
      return initialState;

    case "selectFile": {
      const file = review.files.find((f) => f.id === action.fileId);
      if (!file) return state;
      return { ...state, review: { ...review, activeFileId: file.id, selectedFindingId: lurkingOf(file)[0]?.id ?? null } };
    }

    case "select":
      return { ...state, review: { ...review, selectedFindingId: action.findingId } };

    case "step": {
      const file = review.files.find((f) => f.id === review.activeFileId);
      if (!file) return state;
      const next = nextLurking(file, review.selectedFindingId, action.direction);
      return next ? { ...state, review: { ...review, selectedFindingId: next.id } } : state;
    }

    case "beginBanish":
      return { ...state, banishing: action.findingId };

    case "banish": {
      const file = fileOf(review, action.findingId);
      const finding = file?.findings.find((f) => f.id === action.findingId);
      if (!file || !finding || finding.status !== "lurking") return { ...state, banishing: null };
      const result = applyFix(file.code, finding);
      if (!result) {
        return {
          ...state,
          banishing: null,
          review: updateFile(review, file.id, (f) => ({
            ...f,
            findings: f.findings.map((x) => (x.id === finding.id ? { ...x, stale: true } : x)),
          })),
        };
      }
      const resolved = file.findings.map((x) => (x.id === finding.id ? { ...x, status: "banished" as const, stale: false } : x));
      const nextFile: ReviewFile = { ...file, code: result.code, findings: relocate(result.code, resolved, result) };
      return {
        undo: pushUndo(state, file, `Banished ${finding.bug.toLowerCase()}`),
        banishing: null,
        review: {
          ...updateFile(review, file.id, () => nextFile),
          selectedFindingId: review.activeFileId === file.id ? selectAfter(nextFile, finding.id) : review.selectedFindingId,
        },
      };
    }

    case "ignore": {
      const file = fileOf(review, action.findingId);
      const finding = file?.findings.find((f) => f.id === action.findingId);
      if (!file || !finding || finding.status !== "lurking") return state;
      const nextFile: ReviewFile = {
        ...file,
        findings: file.findings.map((x) => (x.id === finding.id ? { ...x, status: "ignored" as const } : x)),
      };
      return {
        ...state,
        undo: pushUndo(state, file, `Ignored ${finding.bug.toLowerCase()}`),
        review: {
          ...updateFile(review, file.id, () => nextFile),
          selectedFindingId: review.activeFileId === file.id ? selectAfter(nextFile, finding.id) : review.selectedFindingId,
        },
      };
    }

    case "restore": {
      // Bring an ignored monster back.
      const file = fileOf(review, action.findingId);
      const finding = file?.findings.find((f) => f.id === action.findingId);
      if (!file || !finding || finding.status !== "ignored") return state;
      const nextFile: ReviewFile = {
        ...file,
        findings: relocate(
          file.code,
          file.findings.map((x) => (x.id === finding.id ? { ...x, status: "lurking" as const } : x)),
        ),
      };
      return {
        ...state,
        undo: pushUndo(state, file, `Restored ${finding.bug.toLowerCase()}`),
        review: { ...updateFile(review, file.id, () => nextFile), activeFileId: file.id, selectedFindingId: finding.id },
      };
    }

    case "undo": {
      const snap = state.undo[state.undo.length - 1];
      if (!snap) return state;
      return {
        ...state,
        undo: state.undo.slice(0, -1),
        review: {
          ...updateFile(review, snap.file.id, () => snap.file),
          activeFileId: snap.file.id,
          selectedFindingId: snap.selectedFindingId,
        },
      };
    }

    case "resetFile": {
      const file = review.files.find((f) => f.id === action.fileId);
      if (!file) return state;
      const fresh: ReviewFile = { ...file, code: file.originalCode, findings: file.initialFindings };
      return {
        ...state,
        undo: pushUndo(state, file, "Summoned them again"),
        review: { ...updateFile(review, file.id, () => fresh), selectedFindingId: lurkingOf(fresh)[0]?.id ?? null },
      };
    }

    case "posted":
      return { ...state, review: { ...review, postedReviewUrl: action.url } };

    default:
      return state;
  }
}
