import type { Product } from "./scrapers/types";
import type { Prefs, SavedRoaster, SavedState } from "./storage";

const DAY = 24 * 60 * 60 * 1000;
/** Store-reported publish dates count as "new" for this long. */
export const NEW_WINDOW_MS = 14 * DAY;

export interface FeedItem extends Product {
  roasterId: string;
  roasterName: string;
  key: string;
  firstSeen: number;
  isNew: boolean;
  /** Arrived since the visitor's previous visit. */
  sinceLastVisit: boolean;
  /** Best guess at when this bag showed up, for sorting. */
  arrivedAt: number;
}

/** Record first-seen times for products; returns the same object if nothing changed. */
export function markSeen(seen: SavedState["seen"], roasterId: string, products: Product[], now = Date.now()): SavedState["seen"] {
  const existing = seen[roasterId] ?? {};
  const fresh = products.filter((p) => existing[p.id] === undefined);
  if (fresh.length === 0) return seen;
  const next = { ...existing };
  for (const p of fresh) next[p.id] = now;
  return { ...seen, [roasterId]: next };
}

/**
 * A bag is "new" if the store says it was published recently, or if it appeared
 * in the roaster's catalogue after you started following them (which covers
 * stores that don't publish dates, like WooCommerce and many generic sites).
 */
/** Sets, bundles, sample boxes and advent calendars: several coffees, so no single bag size. */
export function isBundle(title: string): boolean {
  return /\b(sets?|bundles?|box(es)?|advent|calendar|sampler|samplers|trio|duo|quartet|collection|tasting (menu|flight)|flight|discovery|variety pack|\d+\s*x\s*\d+)\b/i.test(title);
}

export function buildItems(
  roaster: SavedRoaster,
  products: Product[],
  seen: Record<string, number>,
  previousVisit: number | null,
  now = Date.now(),
): FeedItem[] {
  // Products first seen within a minute of following are the initial catalogue, not arrivals.
  const baseline = roaster.addedAt + 60_000;
  return products.map((p) => {
    const firstSeen = seen[p.id] ?? now;
    const published = p.publishedAt ? Date.parse(p.publishedAt) : NaN;
    const arrivedAfterFollow = firstSeen > baseline;
    const recentlyPublished = Number.isFinite(published) && now - published < NEW_WINDOW_MS;
    const arrivedAt = Number.isFinite(published) ? Math.max(published, arrivedAfterFollow ? firstSeen : 0) : firstSeen;
    const isNew = recentlyPublished || (arrivedAfterFollow && now - firstSeen < NEW_WINDOW_MS);
    return {
      ...p,
      // Fill in the visitor's "usual bag size" for this roaster when the store doesn't say,
      // but not for sets and bundles, which hold several bags.
      size: p.size ?? (roaster.usualBagGrams && !isBundle(p.title) ? { grams: roaster.usualBagGrams, label: `${roaster.usualBagGrams} g` } : null),
      roasterId: roaster.id,
      roasterName: roaster.name,
      key: `${roaster.id}::${p.id}`,
      firstSeen,
      isNew,
      sinceLastVisit: previousVisit !== null && isNew && (arrivedAfterFollow ? firstSeen > previousVisit : published > previousVisit),
      arrivedAt,
    };
  });
}

/** Every word must appear somewhere ("washed kenya" finds washed Kenyan coffees). */
function matchesQuery(i: FeedItem, query: string): boolean {
  const haystack = `${i.title} ${i.roasterName} ${i.description ?? ""} ${i.searchText ?? ""}`.toLowerCase();
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

/**
 * @param opts.toCommon converts an amount to one shared currency so roasters
 *   pricing in different currencies sort fairly. Without it, amounts compare raw.
 */
export function filterAndSort(
  items: FeedItem[],
  prefs: Prefs,
  opts: { roasterId: string | null; query: string; hidden: Set<string>; toCommon?: (amount: number, currency: string | null) => number },
): FeedItem[] {
  const q = opts.query.trim().toLowerCase();
  const out = items.filter((i) => {
    if (opts.hidden.has(i.key)) return false;
    if (!i.available) return false;
    if (opts.roasterId && i.roasterId !== opts.roasterId) return false;
    if (q && !matchesQuery(i, q)) return false;
    return true;
  });
  const common = (amount: number, currency: string | null) => (opts.toCommon ? opts.toCommon(amount, currency) : amount);
  const price = (i: FeedItem, missing: number) => (i.price === null ? missing : common(i.price, i.currency));
  const cup = (i: FeedItem) => { const c = pricePerCup(i, prefs.cupGrams); return c === null ? Infinity : common(c, i.currency); };
  switch (prefs.sort) {
    case "price-asc": return out.sort((a, b) => price(a, Infinity) - price(b, Infinity));
    case "price-desc": return out.sort((a, b) => price(b, -1) - price(a, -1));
    case "per-cup": return out.sort((a, b) => cup(a) - cup(b));
    case "roaster": return out.sort((a, b) => a.roasterName.localeCompare(b.roasterName) || b.arrivedAt - a.arrivedAt);
    default: return out.sort((a, b) => b.arrivedAt - a.arrivedAt);
  }
}

/** Cost of one cup's worth of coffee from this bag, or null without a price and size. */
export function pricePerCup(p: Pick<FeedItem, "price" | "size">, cupGrams: number): number | null {
  if (p.price === null || !p.size || !(cupGrams > 0)) return null;
  return (p.price * cupGrams) / p.size.grams;
}

export function formatPrice(price: number | null, currency: string | null, decimals?: number): string | null {
  if (price === null) return null;
  const digits = decimals ?? (price % 1 === 0 ? 0 : 2);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(price);
  } catch {
    return price.toFixed(digits);
  }
}

/** Ask image CDNs for a card-sized image instead of the multi-megabyte original. */
export function sizedImage(src: string | null, width = 600): string | null {
  if (!src) return null;
  try {
    const u = new URL(src);
    if (u.hostname.endsWith("cdn.shopify.com") || u.pathname.includes("/cdn/shop/")) u.searchParams.set("width", String(width));
    else if (u.hostname.includes("squarespace-cdn.com")) u.searchParams.set("format", `${width >= 500 ? 750 : 300}w`);
    return u.toString();
  } catch {
    return src;
  }
}

export function timeAgo(ms: number, now = Date.now()): string {
  const mins = Math.round((now - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
