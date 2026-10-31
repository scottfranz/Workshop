// Wix Stores (e.g. Curious Coffee). The page embeds the shop gallery's products
// in <script id="wix-warmup-data">: name, price, currency, stock, photo and
// page address. The gallery pages cumulatively (?page=2 holds pages 1-2), so
// when the total is bigger than what's shown, ask for the page that covers it all.

import { coffeeVerdict, keepCoffee, searchTextFor, type ProductSignals } from "./filter";
import { extractJsonLd } from "./jsonld";
import { FetchError, safeFetchText } from "./safeFetch";
import { absoluteUrl, decodeEntities, parseBagSize, stripHtml, summarize, toNumber } from "./text";
import type { Product } from "./types";

interface WixProduct {
  id: string;
  name?: string;
  urlPart?: string;
  price?: number;
  currency?: string;
  isInStock?: boolean;
  productType?: string;
  media?: { fullUrl?: string; url?: string }[];
  options?: { title?: string; selections?: { description?: string; value?: string }[] }[];
}

interface Gallery { products: WixProduct[]; total: number }

export function isWixStoresHtml(html: string): boolean {
  return html.includes('id="wix-warmup-data"') && /productsWithMetaData|wixstores/i.test(html);
}

export function wixGallery(html: string): Gallery {
  const m = html.match(/<script[^>]+id="wix-warmup-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { products: [], total: 0 };
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return { products: [], total: 0 };
  }
  const products = new Map<string, WixProduct>();
  let total = 0;
  const walk = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    const meta = o.productsWithMetaData as { list?: WixProduct[]; totalCount?: number } | undefined;
    if (meta?.list) {
      total = Math.max(total, meta.totalCount ?? meta.list.length);
      for (const p of meta.list) if (p?.id && p.urlPart) products.set(p.id, p);
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(data);
  return { products: [...products.values()], total };
}

const MAX_LOOKUPS = 12;

/**
 * @param describe fetches a product page's description, for products whose
 *   name alone doesn't say coffee or not (Wix's gallery data has no
 *   descriptions or categories: "Sebastian Ramirez watermelon" is a co-ferment).
 */
export async function parseWix(
  products: WixProduct[],
  pageUrl: string,
  describe: (url: string) => Promise<string | null> = async () => null,
): Promise<Product[]> {
  const origin = new URL(pageUrl).origin;
  const out: Product[] = [];
  let lookups = 0;
  for (const p of products) {
    const title = decodeEntities(p.name ?? "").trim();
    if (!title || p.productType === "digital") continue;
    const options = (p.options ?? []).flatMap((o) => [o.title ?? "", ...(o.selections ?? []).map((s) => s.description ?? s.value ?? "")]).filter(Boolean);
    const url = `${origin}/product-page/${encodeURIComponent(p.urlPart!)}`;
    let signals: ProductSignals = { title, options };
    let description: string | null = null;
    if (coffeeVerdict(signals) === "unknown" && lookups < MAX_LOOKUPS) {
      lookups++;
      description = await describe(url);
      if (description) signals = { ...signals, description: stripHtml(description) };
    }
    if (!keepCoffee(signals)) continue;
    out.push({
      id: p.id,
      title,
      url,
      image: absoluteUrl(p.media?.[0]?.fullUrl, origin),
      price: toNumber(p.price),
      size: parseBagSize(title) ?? options.map(parseBagSize).find(Boolean) ?? null,
      currency: p.currency ?? null,
      available: p.isInStock !== false,
      publishedAt: null,
      description: summarize(description),
      searchText: searchTextFor(signals),
    });
  }
  return out;
}

export async function fetchWix(feedUrl: string, prefetchedHtml?: string): Promise<{ products: Product[]; siteName: string | null }> {
  let html = prefetchedHtml ?? (await safeFetchText(feedUrl, "text/html")).body;
  let gallery = wixGallery(html);
  if (gallery.products.length > 0 && gallery.total > gallery.products.length) {
    const pages = Math.min(10, Math.ceil(gallery.total / gallery.products.length));
    const all = new URL(feedUrl);
    all.searchParams.set("page", String(pages));
    const res = await safeFetchText(all.toString(), "text/html").catch(() => null);
    if (res && res.status < 400) {
      const more = wixGallery(res.body);
      if (more.products.length > gallery.products.length) { gallery = more; html = res.body; }
    }
  }
  if (gallery.products.length === 0) throw new FetchError("This shop's product list isn't available.");
  const siteName = decodeEntities(html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)?.[1]
    ?? html.match(/<title[^>]*>([^<|]+)/i)?.[1] ?? "").trim() || null;
  return { products: await parseWix(gallery.products, feedUrl, productDescription), siteName };
}

/** A product page's schema.org description, or null. */
async function productDescription(url: string): Promise<string | null> {
  const res = await safeFetchText(url, "text/html").catch(() => null);
  if (!res || res.status >= 400) return null;
  const node = extractJsonLd(res.body).find((n) => n["@type"] === "Product" || n["@type"] === "ProductGroup");
  return typeof node?.description === "string" ? node.description : null;
}
