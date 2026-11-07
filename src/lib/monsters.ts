import type { MonsterKind, Severity } from "./types";

export interface MonsterInfo {
  kind: MonsterKind;
  name: string;
  bug: string;
  category: string;
  hex: string;
  glow: string;
  defaultSeverity: Severity;
  behavior: string;
  lore: string;
  example: { language: string; before: string; after: string };
}

export const MONSTERS: Record<MonsterKind, MonsterInfo> = {
  wraith: {
    kind: "wraith",
    name: "Void Wraith",
    bug: "Null access",
    category: "NULL / UNDEFINED ACCESS",
    hex: "#4B3A7A",
    glow: "#8AC7D1",
    defaultSeverity: "MED",
    behavior: "Flickers in and out of sight, like a value that may not exist.",
    lore: "Born wherever code reaches into a value that might be nothing. It feeds on lookups that can miss and awaits that can come back empty.",
    example: { language: "js", before: "const city = user.address.city;", after: "const city = user?.address?.city;" },
  },
  leech: {
    kind: "leech",
    name: "Leech",
    bug: "Memory leak",
    category: "MEMORY LEAK",
    hex: "#6E1F2C",
    glow: "#9CBF69",
    defaultSeverity: "MED",
    behavior: "Swells a little every few seconds the bug stays unfixed.",
    lore: "Latches onto long-lived caches and lists that only ever grow. Slow, patient, and fatal to servers that run for weeks.",
    example: {
      language: "js",
      before: "cache.push(entry);",
      after: "cache.push(entry);\nif (cache.length > 1000) cache.shift();",
    },
  },
  possessor: {
    kind: "possessor",
    name: "Possessor",
    bug: "Injection",
    category: "INJECTION (SQL / XSS)",
    hex: "#A51F32",
    glow: "#C8243C",
    defaultSeverity: "HIGH",
    behavior: "Takes over its line with a red pulse. Always HIGH.",
    lore: "Slips in through user input glued into queries or HTML, then speaks with your program's voice.",
    example: {
      language: "js",
      before: "db.query(`SELECT * FROM users WHERE id = ${id}`)",
      after: "db.query('SELECT * FROM users WHERE id = $1', [id])",
    },
  },
  imp: {
    kind: "imp",
    name: "Imp",
    bug: "Off-by-one",
    category: "OFF-BY-ONE",
    hex: "#C2602F",
    glow: "#D2693E",
    defaultSeverity: "LOW",
    behavior: "Hops between its line and the next one, holding its +1 sign.",
    lore: "A tiny trickster that lives in loop bounds. It only ever moves things by one, which is exactly enough.",
    example: {
      language: "js",
      before: "for (let i = 0; i <= list.length; i++)",
      after: "for (let i = 0; i < list.length; i++)",
    },
  },
  twins: {
    kind: "twins",
    name: "Twin Ghosts",
    bug: "Race condition",
    category: "RACE CONDITION",
    hex: "#7FA6C9",
    glow: "#9FC3DE",
    defaultSeverity: "HIGH",
    behavior: "Two ghosts on two lines, tied by a thread. Banish one, both go.",
    lore: "One reads, the other writes, and neither waits for the other. They haunt every read-then-write that is not atomic.",
    example: {
      language: "py",
      before: "balance = get_balance(acct)\nset_balance(acct, balance - amt)",
      after: "with lock:\n    balance = get_balance(acct)\n    set_balance(acct, balance - amt)",
    },
  },
  zombie: {
    kind: "zombie",
    name: "Zombie",
    bug: "Dead code",
    category: "DEAD CODE",
    hex: "#7C8B6A",
    glow: "#9AA88A",
    defaultSeverity: "LOW",
    behavior: "Shambles slowly and greys out the unreachable lines.",
    lore: "Rises from lines that can never run. Harmless on its own, but it misleads everyone who reads past it.",
    example: { language: "js", before: "return user;\nconsole.log('done');", after: "return user;" },
  },
  gremlin: {
    kind: "gremlin",
    name: "Gremlin",
    bug: "Hardcoded secret",
    category: "HARDCODED SECRET",
    hex: "#6B5A36",
    glow: "#B69A63",
    defaultSeverity: "HIGH",
    behavior: "Clutches the leaked key and darts away when your cursor gets close.",
    lore: "Hoards keys, tokens and passwords that were written straight into the source, where anyone with the repo can take them.",
    example: {
      language: "js",
      before: "const API_KEY = 'sk-live-…';",
      after: "const API_KEY = process.env.API_KEY;",
    },
  },
};

/** Display order used across the product. */
export const MONSTER_ORDER: MonsterKind[] = ["wraith", "leech", "possessor", "imp", "twins", "zombie", "gremlin"];

export const SEVERITY: Record<Severity, { label: string; bg: string; fg: string; size: number; rank: number }> = {
  CRITICAL: { label: "CRITICAL", bg: "#C8243C", fg: "#F6EAE6", size: 44, rank: 4 },
  HIGH: { label: "HIGH", bg: "#D9663F", fg: "#1A0904", size: 40, rank: 3 },
  MED: { label: "MED", bg: "#C9A86A", fg: "#17120A", size: 34, rank: 2 },
  LOW: { label: "LOW", bg: "#8AC7D1", fg: "#081417", size: 30, rank: 1 },
};
