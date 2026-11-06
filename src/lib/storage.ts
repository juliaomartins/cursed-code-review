/** localStorage helpers that never throw (private mode, quota, SSR). */
export function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the session simply won't persist */
  }
}

export const KEYS = {
  review: "ccr:review:v1",
  prefs: "ccr:prefs:v1",
  user: "ccr:user:v1",
  explored: "ccr:explored:v1",
} as const;
