// Headless Shopify stores (a custom site, often Vercel's "Next.js Commerce",
// in front of Shopify) have no /products.json. Their pages do embed the Shopify
// Storefront API's product objects in the page data, so read those. Given a
// homepage, follow its coffee collection links and gather products from each.

import { keepCoffee, searchTextFor } from "./filter";
import { FetchError, safeFetchText } from "./safeFetch";
import { absoluteUrl, decodeEntities, pickBag, retailInStock, stripHtml, summarize, toIso } from "./text";
import type { Product } from "./types";

const MAX_COLLECTIONS = 6;
const COFFEE_COLLECTION = /coffee|bean|espresso|filter|single|origin|blend|decaf|limited|seasonal|new|roast/i;

interface Money { amount?: string; currencyCode?: string }
interface SfVariant {
  title?: string;
  availableForSale?: boolean;
  price?: Money | string;
  selectedOptions?: { name?: string; value?: string }[];
}
interface SfProduct {
  id: string;
  handle?: string;
  title?: string;
  availableForSale?: boolean;
  description?: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  collections?: { handle?: string; title?: string }[];
  options?: { name?: string; values?: string[] }[];
  priceRange?: { minVariantPrice?: Money };
  featuredImage?: { url?: string };
  images?: { edges?: { node?: { url?: string } }[] } | { url?: string }[];
  variants?: SfVariant[] | { edges?: { node?: SfVariant }[] };
  publishedAt?: string;
  createdAt?: string;
}

/** Page data from both Next.js routers: the App Router's streamed payload and __NEXT_DATA__. */
export function embeddedData(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      parts.push(JSON.parse(`"${m[1]}"`));
    } catch {
      // A malformed chunk; skip it.
    }
  }
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) parts.push(nextData[1]);
  return parts.join("\n");
}

/** Product data on the page, or a Next.js site serving Shopify images (a homepage may show no products). */
export function isStorefrontHtml(html: string): boolean {
  if (html.includes("gid://shopify/Product/")) return true;
  return /self\.__next_f|id="__NEXT_DATA__"/.test(html) && /cdn\.shopify\.com/.test(html);
}

/** The JSON object starting at `start` (a "{"), respecting strings and nesting. */
function objectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export function findStorefrontProducts(data: string): SfProduct[] {
  const byHandle = new Map<string, SfProduct>();
  const marker = '{"id":"gid://shopify/Product/';
  for (let at = data.indexOf(marker); at !== -1; at = data.indexOf(marker, at + 1)) {
    const raw = objectAt(data, at);
    if (!raw) continue;
    try {
      const p = JSON.parse(raw) as SfProduct;
      if (!p.handle || !p.title || !(p.priceRange || p.variants)) continue;
      // The same product can appear several times (grid, recommendations); keep the fullest.
      const prev = byHandle.get(p.handle);
      if (!prev || (!prev.variants && p.variants)) byHandle.set(p.handle, p);
    } catch {
      // Not valid JSON on its own; skip.
    }
  }
  return [...byHandle.values()];
}

const variantList = (v: SfProduct["variants"]): SfVariant[] =>
  Array.isArray(v) ? v : (v?.edges ?? []).flatMap((e) => (e.node ? [e.node] : []));
const amountOf = (m: Money | string | undefined) => (typeof m === "string" ? m : m?.amount);
const firstImage = (p: SfProduct) =>
  p.featuredImage?.url ?? (Array.isArray(p.images) ? p.images[0]?.url : p.images?.edges?.[0]?.node?.url) ?? null;

/** Where this site puts product pages ("/product/x" on Next.js Commerce, "/products/x" elsewhere). */
function productPath(html: string, handle: string): string {
  const exact = html.match(new RegExp(`href="(/[a-z-]*/${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})"`));
  if (exact) return exact[1];
  return /href="\/product\/[^"]+"/.test(html) ? `/product/${handle}` : `/products/${handle}`;
}

/** "Filter" or "Espresso" when the store files the product as one roast (tags or collections). */
function roastOf(p: SfProduct): string | null {
  const text = [...(p.tags ?? []), ...(p.collections ?? []).map((c) => c.handle ?? c.title ?? "")].join(" ").toLowerCase();
  const espresso = /espresso/.test(text);
  const filter = /filter/.test(text);
  return espresso === filter ? null : espresso ? "Espresso" : "Filter";
}

export function parseStorefront(html: string, pageUrl: string): Product[] {
  const origin = new URL(pageUrl).origin;
  const products: (Product & { roast?: string | null })[] = [];
  for (const p of findStorefrontProducts(embeddedData(html))) {
    const title = decodeEntities(p.title!).trim();
    const variants = variantList(p.variants);
    const options = [
      ...(p.options ?? []).flatMap((o) => [o.name ?? "", ...(o.values ?? [])]),
      ...variants.map((v) => v.title ?? ""),
    ].filter((o) => o && o !== "Default Title");
    const description = p.description ?? stripHtml(p.descriptionHtml);
    const signals = { title, productType: p.productType, tags: p.tags ?? [], vendor: p.vendor, description, options };
    if (!keepCoffee(signals)) continue;
    const bag = variants.length
      ? pickBag(variants.map((v) => ({
        price: amountOf(v.price),
        available: v.availableForSale,
        label: [v.title, ...(v.selectedOptions ?? []).map((o) => o.value)].filter(Boolean).join(" "),
      })), title)
      : pickBag([{ price: p.priceRange?.minVariantPrice?.amount, label: title }]);
    const currency = p.priceRange?.minVariantPrice?.currencyCode
      ?? variants.map((v) => (typeof v.price === "object" ? v.price.currencyCode : undefined)).find(Boolean)
      ?? null;
    products.push({
      id: p.id,
      title,
      url: origin + productPath(html, p.handle!),
      image: absoluteUrl(firstImage(p), origin),
      price: bag.price,
      size: bag.size,
      currency,
      available: p.availableForSale !== false && retailInStock(variants.map((v) => ({
        available: v.availableForSale,
        label: [v.title, ...(v.selectedOptions ?? []).map((o) => o.value)].filter(Boolean).join(" "),
      }))),
      publishedAt: toIso(p.publishedAt ?? p.createdAt),
      description: summarize(p.descriptionHtml ?? p.description),
      searchText: searchTextFor(signals),
      roast: roastOf(p),
    });
  }
  return products;
}

/**
 * Some stores sell filter and espresso roasts as separate products with the same
 * name. Where names collide, add the roast so they don't look like duplicates.
 */
function labelRoasts(products: (Product & { roast?: string | null })[]): Product[] {
  const count = new Map<string, number>();
  for (const p of products) count.set(p.title, (count.get(p.title) ?? 0) + 1);
  return products.map(({ roast, ...p }) =>
    (count.get(p.title)! > 1 && roast && !p.title.toLowerCase().includes(roast.toLowerCase()) ? { ...p, title: `${p.title} (${roast})` } : p));
}

/** Collection pages linked from this page (or its page data) that look like they hold coffee. */
export function coffeeCollectionLinks(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const paths = new Set<string>();
  for (const m of (html + embeddedData(html)).matchAll(/["'(](\/collections\/[a-z0-9-]+)["')?]/gi)) {
    if (COFFEE_COLLECTION.test(m[1]) && !/paper|subscription|capsule|merch|gift/i.test(m[1])) paths.add(m[1]);
  }
  return [...paths].slice(0, MAX_COLLECTIONS).map((p) => origin + p);
}

/** Coffee-looking collections from the sitemap (by path: some sitemaps name a different host). */
async function sitemapCoffeeCollections(pageUrl: string): Promise<string[]> {
  const origin = new URL(pageUrl).origin;
  const res = await safeFetchText(`${origin}/sitemap.xml`, "application/xml, text/xml").catch(() => null);
  if (!res || res.status >= 400) return [];
  const paths = [...res.body.matchAll(/<loc>[^<]*?(\/collections\/[a-z0-9-]+)\/?<\/loc>/gi)].map((m) => m[1]);
  return [...new Set(paths)]
    .filter((p) => COFFEE_COLLECTION.test(p) && !/paper|subscription|capsule|merch|gift|drip-pack/i.test(p))
    .slice(0, MAX_COLLECTIONS)
    .map((p) => origin + p);
}

export async function fetchStorefront(feedUrl: string, prefetchedHtml?: string): Promise<{ products: Product[]; siteName: string | null }> {
  const html = prefetchedHtml ?? (await safeFetchText(feedUrl, "text/html")).body;
  const siteName = decodeEntities(html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)?.[1]
    ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.split(/\s[|–—-]\s/).pop() ?? "").trim() || null;
  const byId = new Map(parseStorefront(html, feedUrl).map((p) => [p.id, p]));

  // A homepage usually shows few or no products; collection pages hold the catalogue.
  if (!new URL(feedUrl).pathname.startsWith("/collections/")) {
    let collections = coffeeCollectionLinks(html, feedUrl);
    if (collections.length === 0) collections = await sitemapCoffeeCollections(feedUrl);
    if (collections.length === 0) collections = ["/collections/all", "/collections/everything"].map((p) => new URL(feedUrl).origin + p);
    for (const url of collections) {
      const page = await safeFetchText(url, "text/html").catch(() => null);
      if (page && page.status < 400) for (const p of parseStorefront(page.body, url)) byId.set(p.id, p);
    }
  }
  if (byId.size === 0) throw new FetchError("This shop's product list isn't available.");
  return { products: labelRoasts([...byId.values()]), siteName };
}
