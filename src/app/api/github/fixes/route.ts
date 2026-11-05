import { NextResponse, type NextRequest } from "next/server";
import { pushFixes, type FixFile, type FixTarget } from "@/server/fixes";
import { withGitHub } from "@/server/handler";

export const maxDuration = 60;

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const SHA = /^[0-9a-f]{40}$/;
const BRANCH = /^(?!\/|.*\/\/|.*\.\.|.*@\{|.*\.lock$|.*\/$)[A-Za-z0-9._\-/]{1,200}$/;

function validTarget(t: unknown): t is FixTarget {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  if (x.kind === "prBranch") return Number.isInteger(x.number) && (x.number as number) > 0 && SHA.test(String(x.headSha));
  return (
    x.kind === "newBranch" &&
    SHA.test(String(x.baseSha)) &&
    BRANCH.test(String(x.baseBranch)) &&
    BRANCH.test(String(x.branch)) &&
    typeof x.title === "string" &&
    x.title.trim().length > 0 &&
    x.title.length <= 256 &&
    typeof x.body === "string" &&
    x.body.length <= 60_000
  );
}

const validFile = (f: FixFile) =>
  typeof f.path === "string" &&
  f.path.length < 500 &&
  !f.path.split("/").some((s) => s === ".." || s === "") &&
  typeof f.content === "string" &&
  f.content.length <= 1_000_000 &&
  /^[0-9a-f]{64}$/.test(f.originalHash) &&
  typeof f.message === "string" &&
  f.message.length <= 5_000;

/** POST /api/github/fixes: commits the banished fixes (one commit per file) to a new branch + PR, or to an open PR's branch. */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { owner?: string; repo?: string; files?: FixFile[]; target?: FixTarget } | null;
  const ok = b && NAME.test(b.owner ?? "") && NAME.test(b.repo ?? "") && Array.isArray(b.files) && b.files.length <= 60 && b.files.every(validFile) && validTarget(b.target);
  if (!ok || !b) return NextResponse.json({ code: "bad_request", message: "The fixes request is incomplete." }, { status: 400 });
  return withGitHub(req, ({ session }) => pushFixes(session.accessToken, { owner: b.owner!, repo: b.repo!, files: b.files!, target: b.target! }));
}
