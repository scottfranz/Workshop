// Everything a visitor saves lives in their own browser. Nothing is sent
// anywhere except the roaster links, which the server needs in order to fetch.

import type { Platform, Product } from "./scrapers/types";

export interface SavedRoaster {
  id: string;          // the feed URL; unique per roaster
  name: string;
  platform: Platform;
  feedUrl: string;
  addedAt: number;
}

export type SortMode = "newest" | "price-asc" | "price-desc" | "roaster";

export interface Prefs {
  hideSoldOut: boolean;
  newOnly: boolean;
  sort: SortMode;
}

export interface SavedState {
  version: 1;
  roasters: SavedRoaster[];
  /** roasterId → productId → first time this browser saw it (ms). */
  seen: Record<string, Record<string, number>>;
  /** `${roasterId}::${productId}` keys the visitor dismissed. */
  hidden: string[];
  /** Start of the current visit, and of the one before it (for "since last visit"). */
  lastVisit: number | null;
  prevVisit: number | null;
  prefs: Prefs;
}

export interface CachedFeed {
  fetchedAt: number;
  products: Product[];
  skipped?: string[];
}

const STATE_KEY = "beanfeed:v1";
const CACHE_KEY = "beanfeed:cache:v1";
const SEEN_TTL_MS = 120 * 24 * 60 * 60 * 1000;

export const DEFAULT_PREFS: Prefs = { hideSoldOut: true, newOnly: false, sort: "newest" };

export function emptyState(): SavedState {
  return { version: 1, roasters: [], seen: {}, hidden: [], lastVisit: null, prevVisit: null, prefs: { ...DEFAULT_PREFS } };
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // private mode, quota, or storage disabled
  }
}

export function loadState(): SavedState {
  const saved = read<Partial<SavedState>>(STATE_KEY);
  if (!saved || saved.version !== 1) return emptyState();
  return {
    ...emptyState(),
    ...saved,
    roasters: Array.isArray(saved.roasters) ? saved.roasters : [],
    prefs: { ...DEFAULT_PREFS, ...saved.prefs },
  } as SavedState;
}

const VISIT_GAP_MS = 30 * 60 * 1000;

/** Start a new "visit" if it's been a while, so a quick reload keeps the same new-since-last-visit set. */
export function beginVisit(state: SavedState, now = Date.now()): SavedState {
  if (state.lastVisit !== null && now - state.lastVisit < VISIT_GAP_MS) return state;
  return { ...state, prevVisit: state.lastVisit, lastVisit: now };
}

export function saveState(state: SavedState): boolean {
  return write(STATE_KEY, pruneSeen(state));
}

export function loadCache(): Record<string, CachedFeed> {
  return read<Record<string, CachedFeed>>(CACHE_KEY) ?? {};
}

export function saveCache(cache: Record<string, CachedFeed>) {
  // The cache is only for instant first paint; if it doesn't fit, drop it.
  if (!write(CACHE_KEY, cache)) {
    try { window.localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  }
}

/** Forget products we haven't seen in a long time so storage doesn't grow forever. */
export function pruneSeen(state: SavedState, now = Date.now()): SavedState {
  const ids = new Set(state.roasters.map((r) => r.id));
  const seen: SavedState["seen"] = {};
  for (const [rid, products] of Object.entries(state.seen)) {
    if (!ids.has(rid)) continue;
    seen[rid] = Object.fromEntries(Object.entries(products).filter(([, at]) => now - at < SEEN_TTL_MS));
  }
  const hidden = state.hidden.filter((k) => ids.has(k.split("::")[0]));
  return { ...state, seen, hidden };
}

// ── Share links ──────────────────────────────────────────────────────────────
// A list can be moved to another device by link. It contains only roaster names
// and URLs, encoded in the #fragment so it never reaches any server.

type SharedEntry = [name: string, platform: Platform, feedUrl: string];

export function encodeShare(roasters: SavedRoaster[]): string {
  const entries: SharedEntry[] = roasters.map((r) => [r.name, r.platform, r.feedUrl]);
  const bytes = new TextEncoder().encode(JSON.stringify(entries));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const PLATFORMS: Platform[] = ["shopify", "woocommerce", "squarespace", "bigcartel", "jsonld"];

export function decodeShare(encoded: string): Omit<SavedRoaster, "addedAt">[] {
  try {
    const bin = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const entries = JSON.parse(json) as unknown;
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((e): e is SharedEntry =>
        Array.isArray(e) && typeof e[0] === "string" && PLATFORMS.includes(e[1]) && typeof e[2] === "string" && /^https?:\/\//.test(e[2]))
      .slice(0, 200)
      .map(([name, platform, feedUrl]) => ({ id: feedUrl, name: name.slice(0, 80), platform, feedUrl }));
  } catch {
    return [];
  }
}
