// Subbly (subscription and shop builder, e.g. Hatch Coffee). Its Next.js
// storefront embeds each product's record in the page data: name, slug,
// photos, and variants with prices in cents and stock counts. Descriptions are
// stored as separate text rows the record points to ("$5a").

import { keepCoffee, searchTextFor } from "./filter";
import { FetchError, safeFetchText } from "./safeFetch";
import { embeddedData, objectAt } from "./storefront";
import { absoluteUrl, decodeEntities, parseBagSize, pickBag, retailInStock, stripHtml, summarize, toIso } from "./text";
import type { Product } from "./types";

interface SubblyVariant { name?: string; price?: number; stockCount?: number | null }
interface SubblyProduct {
  id: number;
  slug?: string;
  type?: string;
  name?: string;
  description?: string;
  giftCard?: boolean;
  digital?: boolean;
  images?: { url?: string }[];
  variants?: SubblyVariant[];
  createdAt?: string;
}

export function isSubblyHtml(html: string): boolean {
  return /assets\.subbly\.co|subbly\.co/i.test(html) && html.includes("self.__next_f");
}

/** Text rows in the App Router stream: "5a:T1f4,<that many bytes of text>". */
function textRow(data: string, ref: string): string | null {
  const m = data.match(new RegExp(`(?:^|\\n|[\\]}])${ref}:T([0-9a-f]+),`));
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const bytes = Buffer.from(data.slice(start, start + parseInt(m[1], 16) * 2), "utf8");
  return bytes.subarray(0, parseInt(m[1], 16)).toString("utf8");
}

/** "All Pricing in CAD", or the symbol on rendered prices (CA$30.00). */
export function subblyCurrency(html: string): string {
  const named = html.match(/Pricing in ([A-Z]{3})\b/);
  if (named) return named[1];
  const symbol = html.match(/(CA|A|NZ|US|HK|S)\$\s?\d|€\s?\d|£\s?\d/);
  if (!symbol) return "USD";
  const s = symbol[0];
  if (s.startsWith("€")) return "EUR";
  if (s.startsWith("£")) return "GBP";
  return ({ CA: "CAD", A: "AUD", NZ: "NZD", US: "USD", HK: "HKD", S: "SGD" } as Record<string, string>)[symbol[1]] ?? "USD";
}

export function parseSubbly(html: string, pageUrl: string): Product[] {
  const origin = new URL(pageUrl).origin;
  const data = embeddedData(html);
  const currency = subblyCurrency(html);
  const seen = new Map<number, SubblyProduct>();
  for (const m of data.matchAll(/"product":\{"id":/g)) {
    const raw = objectAt(data, m.index! + '"product":'.length);
    try {
      const p = raw ? (JSON.parse(raw) as SubblyProduct) : null;
      if (p?.slug && p.name && Array.isArray(p.variants) && !seen.has(p.id)) seen.set(p.id, p);
    } catch {
      // Not a complete record; skip.
    }
  }

  const products: Product[] = [];
  for (const p of seen.values()) {
    if (p.giftCard || p.digital || (p.type && p.type !== "one_time")) continue;
    const title = decodeEntities(p.name!).trim();
    const descriptionHtml = p.description?.startsWith("$") ? textRow(data, p.description.slice(1)) ?? "" : p.description ?? "";
    const description = stripHtml(descriptionHtml);
    const variants = p.variants ?? [];
    const options = variants.map((v) => v.name ?? "").filter((n) => n && n !== p.name);
    const signals = { title, description, options };
    if (!keepCoffee(signals)) continue;
    const priced = variants.map((v) => ({
      price: typeof v.price === "number" ? v.price / 100 : null,
      available: v.stockCount === null || v.stockCount === undefined || v.stockCount > 0,
      label: v.name ?? "",
    }));
    const bag = pickBag(priced, title);
    // Single-size lots often give the size only in the description ("…300g<br>Sourced with…").
    const size = bag.size ?? parseBagSize(description.match(/\b\d+(?:\.\d+)?\s?(?:g|gms?|grams?|oz|kg)\b/i)?.[0]);
    products.push({
      id: String(p.id),
      title,
      url: `${origin}/shop/${p.slug}`,
      image: absoluteUrl(p.images?.[0]?.url, origin),
      price: bag.price,
      size,
      currency,
      available: retailInStock(priced),
      publishedAt: toIso(p.createdAt),
      description: summarize(descriptionHtml),
      searchText: searchTextFor(signals),
    });
  }
  return products;
}

export async function fetchSubbly(feedUrl: string, prefetchedHtml?: string): Promise<{ products: Product[]; siteName: string | null }> {
  let html = prefetchedHtml ?? (await safeFetchText(feedUrl, "text/html")).body;
  let pageUrl = feedUrl;
  let products = parseSubbly(html, pageUrl);
  // A homepage may not list products; Subbly shops live at /shop.
  if (products.length === 0 && !/\/shop\/?$/.test(new URL(feedUrl).pathname)) {
    pageUrl = `${new URL(feedUrl).origin}/shop`;
    const res = await safeFetchText(pageUrl, "text/html").catch(() => null);
    if (res && res.status < 400) {
      html = res.body;
      products = parseSubbly(html, pageUrl);
    }
  }
  if (products.length === 0) throw new FetchError("This shop's product list isn't available.");
  const siteName = decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.split(/\s[|–—-]\s/).pop() ?? "").trim() || null;
  return { products, siteName };
}
