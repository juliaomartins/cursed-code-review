import { Dialog } from "../ui/Dialog";

export const SHORTCUTS: [string, string][] = [
  ["J  /  N", "Next monster"],
  ["K  /  P", "Previous monster"],
  ["B", "Banish the selected monster"],
  ["I", "Ignore the selected monster"],
  ["E", "Toggle “Explain it simply”"],
  ["L", "Lights on / off"],
  ["U  /  Ctrl+Z", "Undo"],
  ["[  /  ]", "Previous / next file"],
  ["?", "Show this list"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard spells" description="Hunt without touching the mouse.">
      <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-sm whitespace-pre text-ember-soft">{k}</dt>
            <dd className="m-0 text-sm text-ink-2">{d}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
