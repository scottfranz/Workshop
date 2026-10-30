// Fallback for stores on anything else (Wix, Square Online, BigCommerce, custom
// sites...). Most shops publish schema.org Product data for search engines, so we
// read that from the page, and if the page only lists products, we visit a
// handful of product pages to read theirs.

import { looksLikeCoffee } from "./filter";
import { FetchError, safeFetchText } from "./safeFetch";
import { absoluteUrl, decodeEntities, minPrice, summarize, toIso } from "./text";
import type { Product } from "./types";

const MAX_PRODUCT_PAGES = 24;
const CONCURRENCY = 6;

type Node = Record<string, unknown>;

export function extractJsonLd(html: string): Node[] {
  const nodes: Node[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const queue: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      while (queue.length) {
        const n = queue.shift();
        if (!n || typeof n !== "object") continue;
        if (Array.isArray(n)) { queue.push(...n); continue; }
        const node = n as Node;
        nodes.push(node);
        if (Array.isArray(node["@graph"])) queue.push(...(node["@graph"] as unknown[]));
      }
    } catch {
      // Malformed JSON-LD is common; skip the block.
    }
  }
  return nodes;
}

function hasType(node: Node, type: string): boolean {
  const t = node["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function firstImage(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (typeof img === "object") return ((img as Node).url ?? (img as Node).contentUrl ?? null) as string | null;
  return null;
}

function offersOf(node: Node): Node[] {
  const offers = node.offers;
  if (!offers) {
    // ProductGroup: offers live on each variant.
    const variants = node.hasVariant;
    return Array.isArray(variants) ? variants.flatMap((v) => (v && typeof v === "object" ? offersOf(v as Node) : [])) : [];
  }
  const list = (Array.isArray(offers) ? offers : [offers]) as Node[];
  // AggregateOffer often holds the currency/lowPrice while its children hold availability.
  return list.flatMap((o) => (Array.isArray(o.offers) ? [o, ...(o.offers as Node[]).map((c) => ({ priceCurrency: o.priceCurrency, ...c }))] : [o]));
}

export function productFromNode(node: Node, pageUrl: string): (Product & { category: string }) | null {
  if (!hasType(node, "Product") && !hasType(node, "ProductGroup")) return null;
  const title = decodeEntities(String(node.name ?? "")).trim();
  if (!title) return null;
  const url = absoluteUrl((node.url as string) ?? (offersOf(node)[0]?.url as string) ?? pageUrl, pageUrl) ?? pageUrl;
  const offers = offersOf(node);
  const availability = offers.map((o) => String(o.availability ?? "")).filter(Boolean);
  return {
    id: url,
    title,
    url,
    image: absoluteUrl(firstImage(node.image), pageUrl),
    price: minPrice(offers.flatMap((o) => [o.price, o.lowPrice])),
    currency: (offers.find((o) => o.priceCurrency)?.priceCurrency as string) ?? null,
    available: availability.length === 0 || availability.some((a) => /InStock|PreOrder|LimitedAvailability|OnlineOnly/i.test(a)),
    publishedAt: toIso(node.releaseDate ?? node.datePublished),
    description: summarize(String(node.description ?? "")),
    category: String(node.category ?? ""),
  };
}

export function productsFromHtml(html: string, pageUrl: string): { products: Product[]; listUrls: string[] } {
  const nodes = extractJsonLd(html);
  const products: Product[] = [];
  const listUrls: string[] = [];
  for (const node of nodes) {
    const p = productFromNode(node, pageUrl);
    if (p) {
      const { category, ...product } = p;
      if (looksLikeCoffee(product.title, category)) products.push(product);
      continue;
    }
    if (hasType(node, "ItemList") && Array.isArray(node.itemListElement)) {
      for (const el of node.itemListElement as Node[]) {
        const item = (el.item ?? el) as Node | string;
        if (typeof item === "object" && hasType(item, "Product")) {
          const ip = productFromNode(item, pageUrl);
          if (ip && looksLikeCoffee(ip.title, ip.category)) {
            const { category: _c, ...product } = ip;
            products.push(product);
          }
          continue;
        }
        const href = typeof item === "string" ? item : (item.url as string) ?? (el.url as string);
        const abs = absoluteUrl(href, pageUrl);
        if (abs) listUrls.push(abs);
      }
    }
  }
  return { products: dedupe(products), listUrls };
}

// URL shapes used by common platforms for individual product pages.
const PRODUCT_PATH = /\/(products?|shop\/p|store\/p|p|item|coffees?)\/[^/?#]+\/?$/i;

export function productLinksFromHtml(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\shref=["']([^"'#]+)["']/gi)) {
    const abs = absoluteUrl(decodeEntities(m[1]), pageUrl);
    if (!abs) continue;
    const u = new URL(abs);
    if (u.origin !== origin || !PRODUCT_PATH.test(u.pathname)) continue;
    u.search = "";
    links.add(u.toString());
  }
  return [...links];
}

export function siteNameFromHtml(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (og) return decodeEntities(og[1]).trim();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!title) return null;
  // "Shop — Onyx Coffee Lab" → take the most brand-like segment (the last one).
  const parts = decodeEntities(title[1]).split(/\s[|\u2013\u2014\-·]\s/).map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

function dedupe(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

export async function fetchJsonLd(feedUrl: string, prefetchedHtml?: string): Promise<{ products: Product[]; siteName: string | null }> {
  let html = prefetchedHtml;
  if (html === undefined) {
    const res = await safeFetchText(feedUrl, "text/html");
    if (res.status >= 400) throw new FetchError(`The page returned an error (${res.status}).`);
    html = res.body;
  }
  const siteName = siteNameFromHtml(html);
  const { products, listUrls } = productsFromHtml(html, feedUrl);
  if (products.length > 1) return { products, siteName };

  const candidates = (listUrls.length ? listUrls : productLinksFromHtml(html, feedUrl)).slice(0, MAX_PRODUCT_PAGES);
  const pages = await mapLimited(candidates, CONCURRENCY, async (url) => {
    try {
      const res = await safeFetchText(url, "text/html");
      return res.status < 400 ? productsFromHtml(res.body, url).products : [];
    } catch {
      return [];
    }
  });
  return { products: dedupe([...products, ...pages.flat()]), siteName };
}
