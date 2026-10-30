// Square Online (formerly Weebly) shops render in the browser, so the HTML has
// almost no product data. Each page does embed the store's user and site IDs,
// and the storefront reads products from a public JSON API keyed by those.

import { keepCoffee, searchTextFor } from "./filter";
import { FetchError, safeFetchJson, safeFetchText } from "./safeFetch";
import { absoluteUrl, decodeEntities, stripHtml, summarize, toIso, toNumber } from "./text";
import type { Product } from "./types";

interface SquareProduct {
  id: string;
  name?: string;
  visibility?: string;
  short_description?: string;
  absolute_site_link?: string;
  site_link?: string;
  created_date?: string;
  badges?: { out_of_stock?: boolean };
  price?: { low?: number; low_with_modifiers?: number };
  images?: { data?: { absolute_url?: string }[] };
  thumbnail?: { data?: { absolute_url?: string } };
  categoryIds?: string[];
  categories?: { data?: { name?: string }[] };
}

interface SquarePage {
  data?: SquareProduct[];
  meta?: { pagination?: { total_pages?: number } };
}

export function isSquareOnlineHtml(html: string): boolean {
  return /editmysite\.com|__BOOTSTRAP_STATE__|square\.online/i.test(html) && squareIds(html) !== null;
}

export function squareIds(html: string): { userId: string; siteId: string } | null {
  const user = html.match(/user_id['"]?\s*[:=]\s*['"]?(\d{5,})/);
  const site = html.match(/site_id['"]?\s*[:=]\s*['"]?(\d{10,})/);
  return user && site ? { userId: user[1], siteId: site[1] } : null;
}

/** "/shop/single-origin-coffees/2" → "2", so the feed can be limited to that category. */
export function squareCategoryFromUrl(feedUrl: string): string | null {
  return new URL(feedUrl).pathname.match(/\/shop\/[^/]+\/([^/]+)\/?$/)?.[1] ?? null;
}

export function parseSquare(data: unknown, feedUrl: string, currency: string | null = null): Product[] {
  const list = (data as SquarePage)?.data;
  if (!Array.isArray(list)) return [];
  const origin = new URL(feedUrl).origin;
  const category = squareCategoryFromUrl(feedUrl);
  const products: Product[] = [];
  for (const p of list) {
    const title = decodeEntities(p.name ?? "").trim();
    if (!title || (p.visibility && p.visibility !== "visible")) continue;
    if (category && !(p.categoryIds ?? []).includes(category)) continue;
    const description = stripHtml(p.short_description);
    const categoryNames = (p.categories?.data ?? []).map((c) => c.name ?? "").join(" ");
    const signals = { title, productType: categoryNames, description };
    if (!keepCoffee(signals)) continue;
    const url = absoluteUrl(p.absolute_site_link ?? p.site_link, origin + "/");
    if (!url) continue;
    products.push({
      id: p.id,
      title,
      url,
      image: absoluteUrl(p.images?.data?.[0]?.absolute_url ?? p.thumbnail?.data?.absolute_url, origin),
      price: toNumber(p.price?.low ?? p.price?.low_with_modifiers),
      currency,
      available: p.badges?.out_of_stock !== true,
      publishedAt: toIso(p.created_date),
      description: summarize(p.short_description),
      searchText: searchTextFor(signals),
    });
  }
  return products;
}

export function squareProductsEndpoint(origin: string, ids: { userId: string; siteId: string }): string {
  return `${origin}/app/store/api/v28/editor/users/${ids.userId}/sites/${ids.siteId}/products`;
}

export async function fetchSquare(feedUrl: string, prefetchedHtml?: string): Promise<{ products: Product[]; siteName: string | null }> {
  const html = prefetchedHtml ?? (await safeFetchText(feedUrl, "text/html")).body;
  const ids = squareIds(html);
  if (!ids) throw new FetchError("This Square Online shop's product list isn't available.");
  const origin = new URL(feedUrl).origin;
  const currency = html.match(/"currency"\s*:\s*"([A-Z]{3})"/)?.[1] ?? null;
  const siteName = decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").split(" | ").pop()?.trim() || null;

  const products: Product[] = [];
  for (let page = 1; page <= 6; page++) {
    const res = await safeFetchJson(`${squareProductsEndpoint(origin, ids)}?per_page=100&page=${page}&include=images,categories`);
    if (!res) {
      if (page === 1) throw new FetchError("This Square Online shop's product list isn't available.");
      break;
    }
    products.push(...parseSquare(res.data, feedUrl, currency));
    const total = (res.data as SquarePage).meta?.pagination?.total_pages ?? 1;
    if (page >= total) break;
  }
  return { products, siteName };
}
