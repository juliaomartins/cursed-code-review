"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { GitHubError, parsePrUrl } from "@/lib/github";
import { fetchPullRequestLive } from "@/lib/githubLive";
import { reviewFromPaste, reviewFromPullRequest, reviewFromSamples } from "@/lib/review/factory";
import { SAMPLES } from "@/lib/samples";
import { detectLanguage, LANGUAGE_LABEL, MAX_LINES, scan } from "@/lib/scanner";
import type { Language } from "@/lib/types";
import { Monster } from "../Monster";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { useSummon } from "./useSummon";

const card = "box-border flex flex-col gap-3 rounded-2xl border p-6";
const field =
  "box-border w-full rounded-[10px] border border-line-strong bg-well text-[15px] text-ink transition-colors hover:border-ink-4 focus:border-ember aria-[invalid=true]:border-sev-high";
const label = "text-sm font-medium text-ink-2";

const SAMPLE_MONSTERS = SAMPLES.map((s) => ({
  ...s,
  findings: scan(s.code, s.language),
}));

export function Doors() {
  const { summon, overlay, busy } = useSummon();
  return (
    <section aria-labelledby="start" className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-[22px] px-4 pb-[88px] sm:px-7">
      <h2 id="start" className="m-0 font-display text-[44px] font-bold">
        Choose your door
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-5">
        <SampleDoor onPick={(id) => summon("Opening the crypt", () => reviewFromSamples(id))} disabled={busy} />
        <PasteDoor onSubmit={(code, lang) => summon("Smelling your code", () => reviewFromPaste(code, lang))} disabled={busy} />
        <PrDoor
          onLoaded={(build, label) =>
            summon("Hunting the diff", build, [`Fetched ${label}`, "Scanning changed lines only", "Writing explanations and fixes", "Summoning monsters"])
          }
          disabled={busy}
        />
      </div>
      {overlay}
    </section>
  );
}

function SampleDoor({ onPick, disabled }: { onPick: (id: string) => void; disabled: boolean }) {
  return (
    <div className={cx(card, "gap-3.5 border-ember bg-[linear-gradient(180deg,rgba(255,138,61,0.08),rgba(255,138,61,0)_60%),#15101D]")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[21px]">Try a cursed sample</h3>
        <span className="rounded-full bg-ember px-2.5 py-[3px] text-xs font-bold text-ember-ink">For judges</span>
      </div>
      <p className="m-0 text-[15px] text-ink-3">Files packed with bugs. Monsters appear in one click.</p>
      {SAMPLE_MONSTERS.map((s) => {
        const kinds = Array.from(new Set(s.findings.map((f) => f.kind)));
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.id)}
            className="flex min-h-[52px] items-center justify-between gap-2.5 rounded-[10px] border border-line-strong bg-well px-3.5 text-left font-mono text-sm text-ink transition-colors hover:border-ember/70 hover:bg-[#241b33] disabled:opacity-60"
          >
            <span>{s.displayName}</span>
            <span className="flex items-center gap-0.5" aria-label={`${s.findings.length} monsters`}>
              {kinds.slice(0, 3).map((k) => (
                <Monster key={k} kind={k} size={26} glow={false} />
              ))}
              {kinds.length > 3 && <span className="ml-1 text-ink-3">+{kinds.length - 3}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PasteDoor({ onSubmit, disabled }: { onSubmit: (code: string, lang: Language) => void; disabled: boolean }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [lang, setLang] = useState<Language>("javascript");
  const [touchedLang, setTouchedLang] = useState(false);
  const [detected, setDetected] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lineCount = code ? code.split("\n").length : 0;

  const onChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
    const guess = detectLanguage(value);
    setDetected(guess);
    if (guess && !touchedLang) setLang(guess);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return setError("Paste some code first. The monsters need something to smell.");
    if (lineCount > MAX_LINES) return setError(`That file has ${lineCount} lines. The crypt holds up to ${MAX_LINES}.`);
    onSubmit(code, lang);
  };

  return (
    <form className={cx(card, "border-line bg-card")} onSubmit={submit} noValidate>
      <h3 className="m-0 text-[21px]">Paste your code</h3>
      <label htmlFor={`${id}-lang`} className={label}>
        Language
      </label>
      <select
        id={`${id}-lang`}
        value={lang}
        onChange={(e) => {
          setLang(e.target.value as Language);
          setTouchedLang(true);
        }}
        className={cx(field, "min-h-[46px] px-3")}
      >
        {(Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => (
          <option key={l} value={l}>
            {LANGUAGE_LABEL[l]}
          </option>
        ))}
      </select>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-code`} className={label}>
          Code
        </label>
        <span className="font-mono text-xs text-ink-3" aria-live="polite">
          {detected && !touchedLang ? `Detected ${LANGUAGE_LABEL[detected]} · ` : ""}
          {lineCount ? `${lineCount} line${lineCount === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <textarea
        id={`${id}-code`}
        rows={4}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        spellCheck={false}
        placeholder="Paste a file. The monsters will smell it."
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : `${id}-hint`}
        className={cx(field, "resize-y p-3 font-mono text-[13px]")}
      />
      {error ? (
        <p id={`${id}-err`} role="alert" className="m-0 flex items-start gap-2 text-[13px] text-sev-high">
          <Icon name="alert" size={16} className="mt-px flex-none" />
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="m-0 text-[13px] text-ink-3">
          Runs in your browser. Nothing is uploaded. Press Ctrl+Enter to summon.
        </p>
      )}
      <Button type="submit" variant="ember-outline" disabled={disabled} className="min-h-12">
        Summon the monsters
      </Button>
    </form>
  );
}

/** A real, public pull request anyone can open to see the PR flow. */
const EXAMPLE_PR = "juliaomartins/cursed-code-review/pull/1";
const DRAFT_KEY = "ccr:pr-draft";

function PrDoor({ onLoaded, disabled }: { onLoaded: (build: () => ReturnType<typeof reviewFromPullRequest>, label: string) => void; disabled: boolean }) {
  const id = useId();
  const { user, requestSignIn, mode, installApp } = useAuth();
  const live = mode === "live";
  const [url, setUrl] = useState("");
  const [error, setError] = useState<{ message: string; code?: GitHubError["code"] } | null>(null);
  // Decided at render time, so the right button shows even if sign-in status loads late.
  const offerSignIn = live && error?.code === "auth_required";
  const offerInstall = live && error?.code === "not_installed";
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // Keep the link across the round-trip to GitHub for sign-in or install.
  useEffect(() => {
    try {
      const draft = window.sessionStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore after returning from GitHub
      if (draft) setUrl(draft);
    } catch {
      /* storage unavailable */
    }
    return () => abort.current?.abort();
  }, []);

  const saveDraft = () => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, url);
    } catch {
      /* storage unavailable */
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = parsePrUrl(url);
    if (!parsed.ok) return setError({ message: parsed.error });
    setError(null);
    setLoading(true);
    abort.current = new AbortController();
    try {
      const pr = await fetchPullRequestLive(parsed.ref, abort.current.signal);
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      onLoaded(() => reviewFromPullRequest(pr), `${pr.owner}/${pr.repo}#${pr.number}`);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const gh = err instanceof GitHubError ? err : null;
      setError({ message: gh?.message ?? "Could not reach GitHub. Check your connection and try again.", code: gh?.code });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={cx(card, "border-line bg-card")} onSubmit={submit} noValidate>
      <h3 className="m-0 text-[21px]">Review a GitHub PR</h3>
      <p className="m-0 text-[15px] text-ink-3">Only the changed lines are hunted.</p>
      <label htmlFor={`${id}-url`} className={label}>
        Pull request link
      </label>
      <input
        id={`${id}-url`}
        type="url"
        inputMode="url"
        autoComplete="off"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          if (error) setError(null);
        }}
        placeholder="https://github.com/owner/repo/pull/12"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cx(field, "min-h-[46px] px-3 text-sm")}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <span>Try a real one:</span>
        <button
          type="button"
          onClick={() => {
            setUrl(`https://github.com/${EXAMPLE_PR}`);
            setError(null);
          }}
          className="min-h-8 rounded-full border border-line px-2.5 font-mono text-[11px] text-ink-2 hover:border-ember/60 hover:text-ink"
        >
          {EXAMPLE_PR.replace("/pull/", "#")}
        </button>
      </div>
      {error && (
        <div
          id={`${id}-err`}
          role="alert"
          className="flex flex-col gap-2 rounded-[10px] border border-sev-high/40 bg-sev-high/[0.07] p-3 text-[13px] text-[#ffc9c2]"
        >
          <span className="flex items-start gap-2">
            <Icon name="alert" size={16} className="mt-px flex-none text-sev-high" />
            {error.message}
          </span>
          {offerSignIn && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                saveDraft();
                requestSignIn();
              }}
              className="self-start"
            >
              <Icon name="github" size={16} />
              Sign in with GitHub
            </Button>
          )}
          {offerInstall && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                saveDraft();
                installApp();
              }}
              className="self-start"
            >
              <Icon name="github" size={16} />
              Install on this repository
            </Button>
          )}
        </div>
      )}
      <Button type="submit" variant="ember-outline" loading={loading} disabled={disabled} className="min-h-12">
        {loading ? "Fetching the PR…" : "Open the PR in the crypt"}
      </Button>
      <p className="m-0 text-[13px] text-ink-3">
        {!live
          ? "Public repositories. Fetched live from GitHub."
          : user
            ? `Signed in as @${user.login}. Public repos, plus private ones where you installed the app.`
            : "Public repos work right away. Sign in with GitHub for private ones."}
      </p>
    </form>
  );
}
