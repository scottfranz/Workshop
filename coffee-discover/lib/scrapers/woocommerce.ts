import { keepCoffee, searchTextFor } from "./filter";
import { FetchError, safeFetchJson } from "./safeFetch";
import { absoluteUrl, decodeEntities, isSampleSize, parseBagSize, stripHtml, summarize, toNumber, type BagSize } from "./text";
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

/** The Store API's price is the cheapest variation, which is normally the smallest real bag size. */
function wooBagSize(title: string, options: string[]): BagSize | null {
  const sizes = options.filter((o) => !isSampleSize(o)).map(parseBagSize).filter((s): s is BagSize => s !== null);
  return parseBagSize(title) ?? (sizes.length ? sizes.reduce((a, b) => (b.grams < a.grams ? b : a)) : null);
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
    const signals = { title, productType: catText, description, options };
    if (!keepCoffee(signals)) continue;
    const minor = p.prices?.currency_minor_unit ?? 2;
    const cents = toNumber(p.prices?.price);
    products.push({
      id: String(p.id),
      title,
      url: absoluteUrl(p.permalink, feedUrl) ?? feedUrl,
      image: absoluteUrl(p.images?.[0]?.src, feedUrl),
      price: cents !== null && cents > 0 ? cents / 10 ** minor : null,
      size: wooBagSize(title, options),
      currency: p.prices?.currency_code ?? null,
      available: p.is_in_stock !== false,
      publishedAt: null,
      description: summarize(p.short_description || p.description),
      searchText: searchTextFor(signals),
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
  // Some stores' servers give up building 100 products at once (Tanat returns an
  // empty response), so step the page size down until the first page loads.
  for (const size of [100, 50, 25]) {
    const products: Product[] = [];
    let ok = false;
    for (let page = 1; page <= Math.ceil(500 / size); page++) {
      const res = await safeFetchJson(`${wooEndpoint(feedUrl)}?per_page=${size}&page=${page}&orderby=date&order=desc`);
      if (!res || !Array.isArray(res.data)) break;
      ok = true;
      products.push(...parseWooCommerce(res.data, feedUrl));
      if (res.data.length < size) break;
    }
    if (ok) return { products, siteName };
  }
  throw new FetchError("This store's product feed isn't available.");
}
