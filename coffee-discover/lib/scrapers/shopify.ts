import { looksLikeCoffee } from "./filter";
import { FetchError, safeFetchJson } from "./safeFetch";
import { absoluteUrl, minPrice, summarize, toIso } from "./text";
import type { Product } from "./types";

interface ShopifyProduct {
  id: number | string;
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  published_at?: string;
  created_at?: string;
  variants?: { price?: string; available?: boolean }[];
  images?: { src?: string }[];
}

/** Turns a shop or collection URL into the matching products.json endpoint. */
export function shopifyProductsEndpoint(feedUrl: string): string {
  const u = new URL(feedUrl);
  const collection = u.pathname.match(/\/collections\/[^/]+/);
  return `${u.origin}${collection ? collection[0] : ""}/products.json`;
}

export function parseShopify(data: unknown, feedUrl: string, currency: string | null = null): Product[] {
  const list = (data as { products?: ShopifyProduct[] })?.products;
  if (!Array.isArray(list)) return [];
  const origin = new URL(feedUrl).origin;
  const products: Product[] = [];
  for (const p of list) {
    const title = (p.title ?? "").trim();
    if (!title || !p.handle) continue;
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",").map((t) => t.trim());
    if (!looksLikeCoffee(title, p.product_type, tags)) continue;
    const variants = p.variants ?? [];
    products.push({
      id: String(p.id),
      title,
      url: `${origin}/products/${p.handle}`,
      image: absoluteUrl(p.images?.[0]?.src, origin),
      price: minPrice(variants.map((v) => v.price)),
      currency,
      available: variants.length === 0 ? true : variants.some((v) => v.available !== false),
      publishedAt: toIso(p.published_at ?? p.created_at),
      description: summarize(p.body_html),
    });
  }
  return products;
}

export async function shopifyMeta(feedUrl: string): Promise<{ name: string | null; currency: string | null }> {
  const res = await safeFetchJson(`${new URL(feedUrl).origin}/meta.json`).catch(() => null);
  const meta = res?.data as { name?: string; currency?: string } | undefined;
  return { name: meta?.name ?? null, currency: meta?.currency ?? null };
}

export async function fetchShopify(feedUrl: string): Promise<{ products: Product[]; siteName: string | null }> {
  const endpoint = shopifyProductsEndpoint(feedUrl);
  const meta = await shopifyMeta(feedUrl);
  const products: Product[] = [];
  for (let page = 1; page <= 4; page++) {
    const res = await safeFetchJson(`${endpoint}?limit=250&page=${page}`);
    const raw = (res?.data as { products?: unknown[] })?.products;
    if (!Array.isArray(raw)) {
      if (page === 1) throw new FetchError("This store's product feed isn't available.");
      break;
    }
    products.push(...parseShopify(res!.data, feedUrl, meta.currency));
    if (raw.length < 250) break;
  }
  return { products, siteName: meta.name };
}
