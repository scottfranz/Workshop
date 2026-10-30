// Everything a visitor saves lives in their own browser. Nothing is sent
// anywhere except the roaster links, which the server needs in order to fetch.

import type { Platform, Product } from "./scrapers/types";

export interface SavedRoaster {
  id: string;          // the feed URL; unique per roaster
  name: string;
  platform: Platform;
  feedUrl: string;
  addedAt: number;
  /** Hex color used to tag this roaster's coffees. */
  color?: string;
  /** Bag size to assume when the store doesn't list one (set by the visitor). */
  usualBagGrams?: number;
}

export type SortMode = "newest" | "price-asc" | "price-desc" | "per-cup" | "roaster";

export type ViewMode = "grid" | "list";

export interface Prefs {
  view: ViewMode;
  /** Coffee per cup, for price-per-cup. */
  cupGrams: number;
  /** Show prices converted to this currency; null shows each store's own. */
  currency: string | null;
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

export const DEFAULT_CUP_GRAMS = 15;
export const DEFAULT_PREFS: Prefs = { view: "grid", sort: "newest", cupGrams: DEFAULT_CUP_GRAMS, currency: null };

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

// The palette from the original Workshop app.
export const ROASTER_COLORS = [
  "#c0622a", "#7a9e7e", "#5b8fa8", "#a0627a", "#8a7ab8", "#b8874a", "#5b9e8a", "#c05a5a",
  "#6a8fb8", "#9e7a3a", "#b85a8a", "#6aab6a", "#c09a2a", "#7a6ab8", "#5baaa0",
];

/** The least-used palette color, so roasters stay distinguishable. */
export function pickColor(taken: (string | undefined)[]): string {
  const counts = new Map(ROASTER_COLORS.map((c) => [c, 0]));
  for (const c of taken) if (c && counts.has(c)) counts.set(c, counts.get(c)! + 1);
  return ROASTER_COLORS.reduce((best, c) => (counts.get(c)! < counts.get(best)! ? c : best));
}

/** Give any roaster saved before colors existed (or imported by link) a color. */
export function withColors<T extends { color?: string }>(roasters: T[]): T[] {
  const taken = roasters.map((r) => r.color);
  return roasters.map((r, i) => {
    if (r.color) return r;
    const color = pickColor(taken);
    taken[i] = color;
    return { ...r, color };
  });
}

export function loadState(): SavedState {
  const saved = read<Partial<SavedState>>(STATE_KEY);
  if (!saved || saved.version !== 1) return emptyState();
  return {
    ...emptyState(),
    ...saved,
    roasters: Array.isArray(saved.roasters) ? withColors(saved.roasters) : [],
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
// A list can be moved to another device by link. It holds only the roasters'
// web addresses, in the #fragment so it never reaches any server:
//   /#r=regaliacoffee.com,hex.coffee/collections/coffee,...
// Platform and name are worked out again when the link is opened, which keeps
// links short. Older links (#follow=<base64 JSON with names and platforms>)
// still open.

export interface SharedRoaster {
  url: string;
  /** Only present in old-style links. */
  name?: string;
  platform?: Platform;
}

const PLATFORMS: Platform[] = ["shopify", "storefront", "woocommerce", "squarespace", "square", "bigcartel", "jsonld"];
const MAX_SHARED = 200;

/** Compare roaster addresses loosely: scheme, "www.", case and trailing slash don't matter. */
export function sameRoasterUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  return norm(a) === norm(b);
}

export function encodeShare(roasters: SavedRoaster[]): string {
  return "r=" + roasters
    .map((r) => encodeURIComponent(r.feedUrl.replace(/^https:\/\//, "")).replace(/%2F/gi, "/"))
    .join(",");
}

/** Reads either link format from a location.hash (with or without the leading #). */
export function decodeShare(hash: string): SharedRoaster[] {
  const h = hash.replace(/^#/, "");
  const compact = h.match(/(?:^|&)r=([^&]*)/);
  if (compact) {
    return compact[1].split(",").flatMap((part): SharedRoaster[] => {
      try {
        const raw = decodeURIComponent(part).trim();
        if (!raw) return [];
        const url = new URL(/^https?:\/\//.test(raw) ? raw : "https://" + raw);
        return url.protocol === "https:" || url.protocol === "http:" ? [{ url: url.toString().replace(/\/$/, "") }] : [];
      } catch {
        return [];
      }
    }).slice(0, MAX_SHARED);
  }
  const legacy = h.match(/(?:^|&)follow=([^&]*)/);
  if (legacy) return decodeLegacyShare(legacy[1]);
  return [];
}

type LegacyEntry = [name: string, platform: Platform, feedUrl: string];

function decodeLegacyShare(encoded: string): SharedRoaster[] {
  try {
    const bin = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const entries = JSON.parse(json) as unknown;
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((e): e is LegacyEntry =>
        Array.isArray(e) && typeof e[0] === "string" && PLATFORMS.includes(e[1]) && typeof e[2] === "string" && /^https?:\/\//.test(e[2]))
      .slice(0, MAX_SHARED)
      .map(([name, platform, url]) => ({ url, name: name.slice(0, 80), platform }));
  } catch {
    return [];
  }
}

/** True if the hash carries a share link at all (even a broken one). */
export function hasShareLink(hash: string): boolean {
  return /(?:^#?|&)(r|follow)=/.test(hash);
}
