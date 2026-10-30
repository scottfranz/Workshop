import { keepCoffee, noteSkipped, searchTextFor } from "./filter";
import { FetchError, safeFetchJson, safeFetchText } from "./safeFetch";
import { absoluteUrl, isSampleSize, minPrice, stripHtml, summarize, toIso } from "./text";
import type { Product } from "./types";

interface ShopifyProduct {
  id: number | string;
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  tags?: string[] | string;
  published_at?: string;
  created_at?: string;
  variants?: { price?: string; available?: boolean; title?: string }[];
  options?: { name?: string; values?: string[] }[];
  images?: { src?: string }[];
}

/** Turns a shop or collection URL into the matching products.json endpoint. */
export function shopifyProductsEndpoint(feedUrl: string): string {
  const u = new URL(feedUrl);
  const collection = u.pathname.match(/\/collections\/[^/]+/);
  return `${u.origin}${collection ? collection[0] : ""}/products.json`;
}

type Variant = NonNullable<ShopifyProduct["variants"]>[number];

/** Variants that are real bags: in stock if any are, and not tiny sample sizes if bigger ones exist. */
function bagVariants(variants: Variant[]): Variant[] {
  const inStock = variants.filter((v) => v.available !== false);
  const pool = inStock.length ? inStock : variants;
  const full = pool.filter((v) => !isSampleSize(v.title));
  return full.length ? full : pool;
}

/**
 * @param listed handles in the store's sitemap. Shops keep wholesale, café-only,
 *   partner and other private products out of it, so anything missing is left out.
 */
export function parseShopify(data: unknown, feedUrl: string, currency: string | null = null, listed: Set<string> | null = null): Product[] {
  const list = (data as { products?: ShopifyProduct[] })?.products;
  if (!Array.isArray(list)) return [];
  const origin = new URL(feedUrl).origin;
  const products: Product[] = [];
  for (const p of list) {
    const title = (p.title ?? "").trim();
    if (!title || !p.handle) continue;
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",").map((t) => t.trim());
    const variants = p.variants ?? [];
    const options = [
      ...(p.options ?? []).flatMap((o) => [o.name ?? "", ...(o.values ?? [])]),
      ...variants.map((v) => v.title ?? ""),
    ].filter((o) => o && o !== "Title" && o !== "Default Title");
    const signals = { title, productType: p.product_type, tags, vendor: p.vendor, description: stripHtml(p.body_html), options };
    if (!keepCoffee(signals)) continue;
    if (listed && !listed.has(p.handle)) {
      noteSkipped(title);
      continue;
    }
    products.push({
      id: String(p.id),
      title,
      url: `${origin}/products/${p.handle}`,
      image: absoluteUrl(p.images?.[0]?.src, origin),
      price: minPrice(bagVariants(variants).map((v) => v.price)),
      currency,
      available: variants.length === 0 ? true : variants.some((v) => v.available !== false),
      publishedAt: toIso(p.published_at ?? p.created_at),
      description: summarize(p.body_html),
      searchText: searchTextFor(signals),
    });
  }
  return products;
}

export async function shopifyMeta(feedUrl: string): Promise<{ name: string | null; currency: string | null }> {
  const res = await safeFetchJson(`${new URL(feedUrl).origin}/meta.json`).catch(() => null);
  const meta = res?.data as { name?: string; currency?: string } | undefined;
  return { name: meta?.name ?? null, currency: meta?.currency ?? null };
}

/** Product handles from the store's sitemap, or null if it can't be read (then nothing is filtered on it). */
export async function shopifyListedHandles(feedUrl: string): Promise<Set<string> | null> {
  const origin = new URL(feedUrl).origin;
  try {
    const index = await safeFetchText(`${origin}/sitemap.xml`, "application/xml, text/xml");
    if (index.status >= 400) return null;
    // Only the default-language product sitemaps; /en-int/ etc. repeat the same handles.
    const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const files = [...index.body.matchAll(new RegExp(`<loc>(${escaped}/sitemap_products_\\d+\\.xml[^<]*)</loc>`, "g"))]
      .map((m) => m[1].replace(/&amp;/g, "&"))
      .slice(0, 5);
    if (files.length === 0) return null;
    const handles = new Set<string>();
    for (const file of files) {
      const res = await safeFetchText(file, "application/xml, text/xml");
      if (res.status >= 400) return null;
      for (const m of res.body.matchAll(/\/products\/([^<?#/"]+)\s*<\/loc>/g)) handles.add(decodeURIComponent(m[1]));
    }
    return handles.size > 0 ? handles : null;
  } catch {
    return null;
  }
}

export async function fetchShopify(feedUrl: string): Promise<{ products: Product[]; siteName: string | null }> {
  const endpoint = shopifyProductsEndpoint(feedUrl);
  const [meta, listed] = await Promise.all([shopifyMeta(feedUrl), shopifyListedHandles(feedUrl)]);
  const products: Product[] = [];
  for (let page = 1; page <= 6; page++) {
    const res = await safeFetchJson(`${endpoint}?limit=250&page=${page}`);
    const raw = (res?.data as { products?: unknown[] })?.products;
    if (!Array.isArray(raw)) {
      if (page === 1) throw new FetchError("This store's product feed isn't available.");
      break;
    }
    // Stop on an empty page, not a short one: Shopify sometimes returns 249 of 250
    // with more pages still to come (Onyx's retail blends were on page 2).
    if (raw.length === 0) break;
    products.push(...parseShopify(res!.data, feedUrl, meta.currency, listed));
  }
  return { products, siteName: meta.name };
}
