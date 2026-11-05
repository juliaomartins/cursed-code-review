"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReview, BANISH_MS } from "@/providers/ReviewProvider";
import { MONSTERS } from "@/lib/monsters";
import { REVIEW_FIRST } from "@/lib/review/bulk";
import { reviewFromSamples } from "@/lib/review/factory";
import { primaryLine } from "@/lib/review/apply";
import { activeFile, fileStats, lurkingOf, reviewStats, selectedFinding } from "@/lib/review/selectors";
import { getSample } from "@/lib/samples";
import { Logo } from "../layout/Logo";
import { Monster } from "../Monster";
import { Button, ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
import { CodeView } from "./CodeView";
import { DetailPanel } from "./DetailPanel";
import { FileNav } from "./FileNav";
import { RoomLight } from "./RoomLight";
import { BanishAllDialog } from "./BanishAllDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";

export function CryptWorkspace() {
  const { review, hydrated, state, dispatch, start, banish, prefs, setPrefs } = useReview();
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const sampleParam = params.get("sample");
  const [shortcuts, setShortcuts] = useState(false);
  const [bulk, setBulk] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const scrollToSelection = useRef(false);

  // Deep link: /crypt?sample=leaky-cache opens the samples with that file active.
  const [handledSample, setHandledSample] = useState<string | null>(null);
  const reviewRef = useRef(review);
  useEffect(() => {
    reviewRef.current = review;
  });
  useEffect(() => {
    if (!hydrated || !sampleParam || handledSample === sampleParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot handling of the deep link
    setHandledSample(sampleParam);
    const sample = getSample(sampleParam);
    const current = reviewRef.current;
    if (sample) {
      if (current?.source.kind === "sample" && current.files.some((f) => f.id === sample.id)) dispatch({ type: "selectFile", fileId: sample.id });
      else start(reviewFromSamples(sample.id));
    }
    router.replace("/crypt", { scroll: false });
  }, [hydrated, sampleParam, handledSample, dispatch, start, router]);

  const file = review ? activeFile(review) : null;
  const finding = review ? selectedFinding(review) : null;
  const banishingId = state.banishing;

  const select = useCallback(
    (id: string, fromKeyboard = false) => {
      scrollToSelection.current = fromKeyboard;
      dispatch({ type: "select", findingId: id });
      if (!fromKeyboard && window.matchMedia?.("(max-width: 1023px)").matches) {
        requestAnimationFrame(() => asideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!finding || !scrollToSelection.current) return;
    scrollToSelection.current = false;
    document.getElementById(`code-line-${primaryLine(finding)}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [finding]);

  const doBanish = useCallback(() => {
    if (!finding || finding.status !== "lurking" || finding.stale || banishingId || !file) return;
    const name = MONSTERS[finding.kind].name;
    const left = lurkingOf(file).length - 1;
    banish(finding.id);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(
      () =>
        toast({
          title: `${name} banished`,
          description: left ? `${left} monster${left === 1 ? "" : "s"} left in this file.` : "This file is clear.",
          tone: "success",
          action: { label: "Undo", onClick: () => dispatch({ type: "undo" }) },
        }),
      reduced ? 0 : BANISH_MS,
    );
  }, [finding, banishingId, file, banish, toast, dispatch]);

  const doIgnore = useCallback(() => {
    if (!finding || finding.status !== "lurking" || banishingId) return;
    dispatch({ type: "ignore", findingId: finding.id });
    toast({
      title: `${MONSTERS[finding.kind].name} ignored`,
      description: "It stays in the code and in the report.",
      action: { label: "Undo", onClick: () => dispatch({ type: "undo" }) },
    });
  }, [finding, banishingId, dispatch, toast]);

  const doUndo = useCallback(() => {
    const label = state.undo[state.undo.length - 1]?.label;
    if (!label) return;
    dispatch({ type: "undo" });
    toast({ title: "Undone", description: label });
  }, [state.undo, dispatch, toast]);

  const copyFix = useCallback(async () => {
    if (!finding) return;
    try {
      await navigator.clipboard.writeText(finding.fix.after.join("\n"));
      toast({ title: "Fix copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", description: "Your browser blocked clipboard access.", tone: "error" });
    }
  }, [finding, toast]);

  const stepFile = useCallback(
    (dir: 1 | -1) => {
      if (!review) return;
      const idx = review.files.findIndex((f) => f.id === review.activeFileId);
      const next = review.files[(idx + dir + review.files.length) % review.files.length];
      dispatch({ type: "selectFile", fileId: next.id });
    },
    [review, dispatch],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("[data-dialog-root]"))) return;
      if (e.altKey || e.metaKey) return;
      if (e.ctrlKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          doUndo();
        }
        return;
      }
      const key = e.key;
      const actions: Record<string, () => void> = {
        j: () => dispatch({ type: "step", direction: 1 }),
        n: () => dispatch({ type: "step", direction: 1 }),
        k: () => dispatch({ type: "step", direction: -1 }),
        p: () => dispatch({ type: "step", direction: -1 }),
        b: doBanish,
        i: doIgnore,
        e: () => setPrefs({ explainSimple: !prefs.explainSimple }),
        l: () => setPrefs({ lights: !prefs.lights }),
        u: doUndo,
        "]": () => stepFile(1),
        "[": () => stepFile(-1),
        "?": () => setShortcuts(true),
      };
      const fn = actions[key.length === 1 ? key.toLowerCase() : key] ?? (key === "?" ? actions["?"] : undefined);
      if (!fn) return;
      e.preventDefault();
      if (["j", "n", "k", "p"].includes(key.toLowerCase())) scrollToSelection.current = true;
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, doBanish, doIgnore, doUndo, prefs, setPrefs, stepFile]);

  if (!hydrated || (sampleParam && getSample(sampleParam) && handledSample !== sampleParam)) return <CryptSkeleton />;
  if (!review || !file) return <NoCrypt />;

  const fs = fileStats(file);
  const total = reviewStats(review);
  const nextFile = review.files.find((f) => f.id !== file.id && lurkingOf(f).length > 0) ?? null;
  const darkness = ((100 - fs.light) / 100) * 0.55;

  return (
    <div className="relative flex min-h-screen flex-col bg-[radial-gradient(ellipse_1000px_420px_at_50%_-8%,rgba(255,138,61,0.10),rgba(255,138,61,0)_70%),#0D0A12]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
        style={{ opacity: darkness, background: "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.9) 100%)" }}
      />
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-7 gap-y-3 border-b border-line bg-[rgba(13,10,18,0.88)] px-4 py-3.5 backdrop-blur sm:px-7">
        <Logo tagline size={38} />
        <RoomLight value={fs.light} className="order-3 w-full sm:order-none sm:w-auto" />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="ghost" onClick={doUndo} disabled={!state.undo.length} aria-label="Undo last action" title="Undo (U)" className="px-3">
            <Icon name="undo" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShortcuts(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="hidden px-3 sm:inline-flex"
          >
            <Icon name="keyboard" />
          </Button>
          <Switch checked={prefs.lights} onChange={(v) => setPrefs({ lights: v })} label={prefs.lights ? "Lights on" : "Lights off"} />
          <ButtonLink href="/report" variant="ember-outline">
            Finish review
          </ButtonLink>
        </div>
      </header>

      <div className="relative z-10 flex flex-auto flex-col lg:flex-row">
        <aside className="box-border border-b border-line bg-panel px-4 py-5 sm:px-[18px] lg:sticky lg:top-[77px] lg:max-h-[calc(100vh-77px)] lg:w-[250px] lg:flex-none lg:overflow-y-auto lg:border-r lg:border-b-0 lg:py-[22px]">
          <FileNav review={review} onSelect={(id) => dispatch({ type: "selectFile", fileId: id })} />
        </aside>

        <main id="main" className="box-border flex min-w-0 flex-auto flex-col gap-3.5 p-4 sm:p-[22px]">
          <div className="flex flex-wrap items-end justify-between gap-2.5">
            <div className="flex flex-col gap-1">
              <h1 className="m-0 font-display text-[34px] leading-none font-bold">The Crypt</h1>
              <span className="text-sm text-ink-3">Swing the lantern over the code. Click a monster to face it.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[13px]" aria-live="polite">
              {total.lurking > 1 && (
                <Button size="sm" variant="ember-outline" onClick={() => setBulk(true)} className="font-sans">
                  <Icon name="flame" size={16} />
                  Banish all
                </Button>
              )}
              <span className="rounded-full bg-track px-3 py-1.5">{fs.lurking} lurking</span>
              <span className="rounded-full bg-[rgba(111,242,176,0.12)] px-3 py-1.5 text-banished">{fs.banished} banished</span>
              {review.files.length > 1 && <span className="hidden rounded-full bg-track px-3 py-1.5 text-ink-3 sm:inline">{total.lurking} across files</span>}
            </div>
          </div>
          <CodeView file={file} selectedId={finding?.id ?? null} banishingId={banishingId} lights={prefs.lights} onPick={(id) => select(id)} />
          <p className="m-0 hidden text-xs text-ink-4 lg:block">
            Tip: press <kbd className="font-mono text-ink-3">J</kbd>/<kbd className="font-mono text-ink-3">K</kbd> to move between monsters,{" "}
            <kbd className="font-mono text-ink-3">B</kbd> to banish, <kbd className="font-mono text-ink-3">?</kbd> for all spells.
          </p>
        </main>

        <aside
          ref={asideRef}
          aria-label="Monster details"
          className="box-border scroll-mt-24 border-t border-line bg-panel p-4 sm:p-[22px] lg:sticky lg:top-[77px] lg:max-h-[calc(100vh-77px)] lg:w-[360px] lg:flex-none lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          <DetailPanel
            file={file}
            finding={finding}
            banishing={!!finding && banishingId === finding.id}
            simple={prefs.explainSimple}
            nextFile={nextFile}
            onSimple={(v) => setPrefs({ explainSimple: v })}
            onBanish={doBanish}
            onIgnore={doIgnore}
            onRestore={(id) => dispatch({ type: "restore", findingId: id })}
            onReset={() => dispatch({ type: "resetFile", fileId: file.id })}
            onSelectFile={(id) => dispatch({ type: "selectFile", fileId: id })}
            onCopyFix={copyFix}
            onSelect={(id) => select(id)}
          />
        </aside>
      </div>
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
      {bulk && (
        <BanishAllDialog
          open
          onClose={() => setBulk(false)}
          review={review}
          onConfirm={(fileIds, includeTwins) => {
            dispatch({ type: "banishAll", fileIds, skipKinds: includeTwins ? [] : REVIEW_FIRST });
            toast({
              title: "Monsters banished",
              description: "Every selected fix was applied. Undo reverts them all at once.",
              tone: "success",
              action: { label: "Undo", onClick: () => dispatch({ type: "undo" }) },
            });
          }}
        />
      )}
    </div>
  );
}

function CryptSkeleton() {
  return (
    <div className="flex min-h-screen flex-col" aria-busy="true" aria-label="Opening the crypt">
      <div className="flex items-center justify-between border-b border-line px-7 py-4">
        <span className="skeleton h-10 w-72 rounded-lg" />
        <span className="skeleton hidden h-10 w-56 rounded-lg sm:block" />
      </div>
      <div className="flex flex-1 gap-6 p-6">
        <span className="skeleton hidden h-[60vh] w-[220px] rounded-xl lg:block" />
        <span className="skeleton h-[70vh] flex-1 rounded-xl" />
        <span className="skeleton hidden h-[60vh] w-[340px] rounded-xl lg:block" />
      </div>
    </div>
  );
}

function NoCrypt() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="behave-zombie">
        <Monster kind="zombie" size={120} />
      </span>
      <h1 className="m-0 font-display text-5xl leading-none">The crypt is sealed.</h1>
      <p className="m-0 max-w-md text-ink-2">Open a cursed sample, paste your own code or bring a pull request to start a hunt.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/crypt?sample=cursed-login" variant="primary" size="lg">
          Try a cursed sample
        </ButtonLink>
        <ButtonLink href="/#start" variant="outline" size="lg">
          Choose another door
        </ButtonLink>
      </div>
    </div>
  );
}
