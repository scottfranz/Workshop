// Some Shopify stores run their site on Hydrogen (Shopify's Remix framework),
// which can hide sizes that /products.json still lists. Passenger's coffees all
// carry a "125 g" variant reserved for its sample sets ($6 or $10, never offered
// on its own), and its Necessary coffees a retired "325 g". The site's own pages
// list only the sizes it sells, so read those: the coffee collection pages, then
// product pages for in-stock coffees the collections didn't cover.

import { type FetchedText, safeFetchText } from "./safeFetch";

const MAX_COLLECTION_PAGES = 4;
const MAX_PRODUCT_PAGES = 12;
const COFFEE_COLLECTION = /coffee|bean|espresso|filter|single|origin|blend|decaf/i;

/**
 * The loader data a Remix page streams in with turbo-stream: a flat array where
 * objects are {"_<key index>": <value index>} and negative numbers are constants.
 */
export function turboStreamData(html: string): unknown {
  let raw = "";
  for (const m of html.matchAll(/streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/g)) {
    try {
      raw += JSON.parse(m[1]);
    } catch {
      // A malformed chunk; skip it.
    }
  }
  let flat: unknown[];
  try {
    flat = JSON.parse(raw.split("\n")[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(flat)) return null;
  const done = new Map<number, unknown>();
  const at = (i: number): unknown => {
    if (i < 0 || i >= flat.length) return null;
    if (done.has(i)) return done.get(i);
    const v = flat[i];
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      const out: unknown[] = [];
      done.set(i, out);
      // Tagged values (dates, promises...) start with a string; plain arrays hold indices.
      if (typeof v[0] !== "string") for (const x of v) out.push(typeof x === "number" ? at(x) : null);
      return out;
    }
    const out: Record<string, unknown> = {};
    done.set(i, out);
    for (const [k, val] of Object.entries(v)) {
      const key = at(Number(k.slice(1)));
      if (typeof key === "string") out[key] = typeof val === "number" ? at(val) : null;
    }
    return out;
  };
  return at(0);
}

interface ShownProduct { handle?: unknown; id?: unknown; variants?: unknown }

/** Product handle → the variant titles the page offers. */
export function shownVariantTitles(data: unknown): Map<string, Set<string>> {
  const shown = new Map<string, Set<string>>();
  const seen = new Set<object>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object" || seen.has(o)) return;
    seen.add(o);
    const p = o as ShownProduct;
    if (typeof p.handle === "string" && String(p.id ?? "").includes("gid://shopify/Product/") && p.variants) {
      const list = (p.variants as { nodes?: unknown }).nodes ?? p.variants;
      if (Array.isArray(list)) {
        const titles = list.map((v) => (v as { title?: unknown })?.title).filter((t): t is string => typeof t === "string");
        if (titles.length && !shown.has(p.handle)) shown.set(p.handle, new Set(titles));
      }
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(data);
  return shown;
}

/** The "next page" link of a Hydrogen collection page, if there is one. */
function nextPageUrl(html: string, pageUrl: string): string | null {
  const href = html.match(/href="([^"]*[?&]direction=next[^"]*)"/)?.[1];
  return href ? new URL(href.replace(/&amp;/g, "&"), pageUrl).toString() : null;
}

export function isHydrogenHome(home: FetchedText | null): home is FetchedText {
  return !!home && home.status < 400 && /streamController\.enqueue/.test(home.body) && home.body.includes("cdn.shopify.com");
}

/**
 * Sizes the store's own site offers, by product handle (none for a product its
 * page won't show). `inStock` lists handles
 * of in-stock coffees with several sizes, checked one by one when the
 * collections didn't show them.
 */
export async function hydrogenShownSizes(home: FetchedText, inStock: string[]): Promise<Map<string, Set<string>> | null> {
  const shown = new Map<string, Set<string>>();
  const add = (html: string) => {
    for (const [handle, titles] of shownVariantTitles(turboStreamData(html))) if (!shown.has(handle)) shown.set(handle, titles);
  };

  const origin = new URL(home.url).origin;
  const collections = [...new Set([...home.body.matchAll(/href="(\/collections\/[a-z0-9-]+)"/gi)].map((m) => m[1]))]
    .filter((p) => COFFEE_COLLECTION.test(p) && !/archive|paper|subscription|capsule|merch|gift|tea\b/i.test(p))
    .slice(0, 3);
  for (const path of collections) {
    let url: string | null = origin + path;
    for (let page = 0; url && page < MAX_COLLECTION_PAGES; page++) {
      const res = await safeFetchText(url, "text/html").catch(() => null);
      if (!res || res.status >= 400) break;
      add(res.body);
      url = nextPageUrl(res.body, url);
    }
  }

  const unchecked = inStock.filter((h) => !shown.has(h)).slice(0, MAX_PRODUCT_PAGES);
  for (let i = 0; i < unchecked.length; i += 4) {
    await Promise.all(unchecked.slice(i, i + 4).map(async (handle) => {
      const res = await safeFetchText(`${origin}/products/${handle}`, "text/html").catch(() => null);
      if (res && res.status < 400) add(res.body);
      // The site won't show it (Passenger's unreleased holiday blend answers 401): nothing on offer.
      else if (res && [401, 403, 404, 410].includes(res.status)) shown.set(handle, new Set());
    }));
  }
  return shown.size ? shown : null;
}
