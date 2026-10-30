import { keepCoffee } from "./filter";
import { FetchError, safeFetchJson } from "./safeFetch";
import { absoluteUrl, decodeEntities, stripHtml, summarize, toNumber } from "./text";
import type { Product } from "./types";

// Uses WooCommerce's public Store API, which needs no API keys.

interface WooProduct {
  id: number;
  name?: string;
  permalink?: string;
  type?: string;
  short_description?: string;
  description?: string;
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  images?: { src?: string }[];
  categories?: { slug?: string; name?: string }[];
  prices?: { price?: string; currency_code?: string; currency_minor_unit?: number };
  attributes?: { name?: string; terms?: { name?: string }[] }[];
}

/** A /product-category/<slug>/ link narrows the feed to that category. */
export function wooCategoryFromUrl(feedUrl: string): string | null {
  const m = new URL(feedUrl).pathname.match(/\/product-category\/(?:[^/]+\/)*?([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function parseWooCommerce(data: unknown, feedUrl: string): Product[] {
  if (!Array.isArray(data)) return [];
  const category = wooCategoryFromUrl(feedUrl);
  const products: Product[] = [];
  for (const p of data as WooProduct[]) {
    const title = decodeEntities((p.name ?? "").replace(/<[^>]+>/g, "")).trim();
    if (!title || !p.permalink) continue;
    const cats = p.categories ?? [];
    if (category && !cats.some((c) => c.slug === category)) continue;
    const catText = cats.map((c) => c.name ?? c.slug ?? "").join(" ");
    const options = (p.attributes ?? []).flatMap((a) => [a.name ?? "", ...(a.terms ?? []).map((t) => t.name ?? "")]);
    const description = stripHtml(`${p.short_description ?? ""} ${p.description ?? ""}`);
    if (!keepCoffee({ title, productType: catText, description, options })) continue;
    const minor = p.prices?.currency_minor_unit ?? 2;
    const cents = toNumber(p.prices?.price);
    products.push({
      id: String(p.id),
      title,
      url: absoluteUrl(p.permalink, feedUrl) ?? feedUrl,
      image: absoluteUrl(p.images?.[0]?.src, feedUrl),
      price: cents !== null && cents > 0 ? cents / 10 ** minor : null,
      currency: p.prices?.currency_code ?? null,
      available: p.is_in_stock !== false,
      publishedAt: null,
      description: summarize(p.short_description || p.description),
    });
  }
  return products;
}

export function wooEndpoint(feedUrl: string): string {
  return `${new URL(feedUrl).origin}/wp-json/wc/store/v1/products`;
}

export async function fetchWooCommerce(feedUrl: string): Promise<{ products: Product[]; siteName: string | null }> {
  const origin = new URL(feedUrl).origin;
  const site = await safeFetchJson(`${origin}/wp-json/`).catch(() => null);
  const siteName = (site?.data as { name?: string } | undefined)?.name ?? null;
  const products: Product[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await safeFetchJson(`${wooEndpoint(feedUrl)}?per_page=100&page=${page}&orderby=date&order=desc`);
    if (!res || !Array.isArray(res.data)) {
      if (page === 1) throw new FetchError("This store's product feed isn't available.");
      break;
    }
    products.push(...parseWooCommerce(res.data, feedUrl));
    if (res.data.length < 100) break;
  }
  return { products, siteName };
}
