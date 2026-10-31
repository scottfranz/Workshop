// Fallback for stores on anything else (Wix, Square Online, BigCommerce, custom
// sites...). Most shops publish schema.org Product data for search engines, so we
// read that from the page, and if the page only lists products, we visit a
// handful of product pages to read theirs.

import { keepCoffee, searchTextFor, type ProductSignals } from "./filter";
import { FetchError, safeFetchText } from "./safeFetch";
import { absoluteUrl, decodeEntities, minPrice, parseBagSize, pickBag, retailInStock, stripHtml, summarize, toIso } from "./text";
import type { Product } from "./types";

const MAX_PRODUCT_PAGES = 40;
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

type Candidate = Product & { category: string; signals: string[]; fullDescription: string };

// schema.org QuantitativeValue unit codes (UN/CEFACT) for bag weights.
const WEIGHT_UNITS: Record<string, string> = { GRM: "g", KGM: "kg", ONZ: "oz", LBR: "lb", G: "g", KG: "kg", OZ: "oz", LB: "lb" };

function weightLabel(weight: unknown): string {
  if (!weight || typeof weight !== "object") return typeof weight === "string" ? weight : "";
  const w = weight as Node;
  const unit = WEIGHT_UNITS[String(w.unitCode ?? w.unitText ?? "").toUpperCase()] ?? String(w.unitText ?? "");
  return w.value !== undefined && unit ? `${w.value}${unit}` : "";
}

const weightSize = (weight: unknown) => parseBagSize(weightLabel(weight));

export function productFromNode(node: Node, pageUrl: string): Candidate | null {
  if (!hasType(node, "Product") && !hasType(node, "ProductGroup")) return null;
  const title = decodeEntities(String(node.name ?? "")).trim();
  if (!title) return null;
  const url = absoluteUrl((node.url as string) ?? (offersOf(node)[0]?.url as string) ?? pageUrl, pageUrl) ?? pageUrl;
  const offers = offersOf(node);
  const availability = offers.map((o) => String(o.availability ?? "")).filter(Boolean);
  const inStock = (a: unknown) => a === undefined || a === null || a === "" || /InStock|PreOrder|LimitedAvailability|OnlineOnly/i.test(String(a));
  // ProductGroup / hasVariant: one entry per bag size with its own weight, price and stock
  // (Father's: 250 g / 1 kg / 2 kg). Price and size the bag a shopper would buy.
  const sizes = (Array.isArray(node.hasVariant) ? (node.hasVariant as Node[]) : []).flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const vOffers = offersOf(v);
    return [{
      price: vOffers[0]?.price ?? vOffers[0]?.lowPrice,
      available: vOffers.length === 0 || vOffers.some((o) => inStock(o.availability)),
      label: [weightLabel(v.weight), String(v.name ?? "")].filter(Boolean).join(" "),
    }];
  });
  const bag = sizes.length ? pickBag(sizes, title) : null;
  return {
    id: url,
    title,
    url,
    image: absoluteUrl(firstImage(node.image), pageUrl),
    price: bag?.price ?? minPrice(offers.flatMap((o) => [o.price, o.lowPrice])),
    size: bag?.size ?? parseBagSize(title) ?? weightSize(node.weight) ?? (offers.length === 1 ? parseBagSize(String(offers[0].name ?? "")) : null),
    currency: (offers.find((o) => o.priceCurrency)?.priceCurrency as string) ?? null,
    available: sizes.length
      ? retailInStock(sizes)
      : availability.length === 0 || availability.some((a) => /InStock|PreOrder|LimitedAvailability|OnlineOnly/i.test(a)),
    publishedAt: toIso(node.releaseDate ?? node.datePublished),
    description: summarize(String(node.description ?? "")),
    category: String(node.category ?? ""),
    fullDescription: String(node.description ?? ""),
    // Variant names and weights, e.g. "12oz / Whole Bean".
    signals: [
      ...(Array.isArray(node.hasVariant) ? (node.hasVariant as Node[]).map((v) => String(v?.name ?? "")) : []),
      ...offers.map((o) => String(o.name ?? "")),
      typeof node.weight === "object" && node.weight ? `${(node.weight as Node).value ?? ""}${(node.weight as Node).unitCode ?? ""}` : "",
    ].filter(Boolean),
  };
}

function signalsOf(c: Candidate): ProductSignals {
  return { title: c.title, productType: c.category, description: stripHtml(c.fullDescription), options: c.signals };
}

function isCoffee(c: Candidate): boolean {
  return keepCoffee(signalsOf(c));
}

function toProduct(c: Candidate): Product {
  const { category: _c, signals: _s, fullDescription: _d, ...product } = c;
  return { ...product, searchText: searchTextFor(signalsOf(c)) };
}

/**
 * The product's date from page data embedded alongside the schema.org markup:
 * Father's puts its product record in <script id="props">, with markedAsNewAt
 * (when it was announced as new) and createdAt.
 */
export function embeddedProductDate(html: string): string | null {
  const m = html.match(/<script id="props" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const p = (JSON.parse(m[1]) as { product?: Record<string, unknown> }).product;
    return p ? toIso(p.markedAsNewAt ?? p.publishedAt ?? p.createdAt) : null;
  } catch {
    return null;
  }
}

export function productsFromHtml(html: string, pageUrl: string): { products: Product[]; listUrls: string[] } {
  const nodes = extractJsonLd(html);
  const products: Product[] = [];
  const listUrls: string[] = [];
  for (const node of nodes) {
    const p = productFromNode(node, pageUrl);
    if (p) {
      if (isCoffee(p)) products.push(toProduct(p));
      continue;
    }
    if (hasType(node, "ItemList") && Array.isArray(node.itemListElement)) {
      for (const el of node.itemListElement as Node[]) {
        const item = (el.item ?? el) as Node | string;
        if (typeof item === "object" && hasType(item, "Product")) {
          const ip = productFromNode(item, pageUrl);
          if (ip && isCoffee(ip)) products.push(toProduct(ip));
          continue;
        }
        const href = typeof item === "string" ? item : (item.url as string) ?? (el.url as string);
        const abs = absoluteUrl(href, pageUrl);
        if (abs) listUrls.push(abs);
      }
    }
  }
  const found = dedupe(products);
  // A product page without a date in its markup may have one in its page data.
  if (found.length === 1 && !found[0].publishedAt) found[0] = { ...found[0], publishedAt: embeddedProductDate(html) };
  return { products: found, listUrls };
}

// URL shapes used by common platforms for individual product pages.
const PRODUCT_PATH = /\/(products?|shop\/p|store\/p|p|item|coffees?)\/[^/?#]+\/?$/i;
// A shop or coffee section followed by more path: /en/coffee/espresso/ethiopia-chelbesa,
// /kava/filtr/kenya. Category pages match too; they just yield no product data.
const SECTION = /^(products?|shop|store|eshop|e-shop|coffees?|kava|káva|kaffee|kaffe|cafe|café|beans)$/i;

function looksLikeProductPath(path: string): boolean {
  if (PRODUCT_PATH.test(path)) return true;
  const parts = path.split("/").filter(Boolean);
  const i = parts.findIndex((p) => SECTION.test(decodeURIComponent(p)));
  return i !== -1 && parts.length - i >= 2 && !/blog|news|journal|recipe|guide|subscription/i.test(path);
}

/** The shop or coffee listing a homepage links to (/en/coffee, /shop), for finding every product. */
export function listingLinks(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const found = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\shref=["']([^"'#?]+)["']/gi)) {
    const abs = absoluteUrl(decodeEntities(m[1]), pageUrl);
    if (!abs || new URL(abs).origin !== origin) continue;
    const parts = new URL(abs).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    // "/coffee", "/en/coffee", "/shop" (a language prefix allowed), not deeper.
    if (parts.length <= 2 && SECTION.test(decodeURIComponent(last)) && (parts.length === 1 || /^[a-z]{2}$/.test(parts[0]))) found.add(abs.replace(/\/$/, ""));
  }
  return [...found].slice(0, 2);
}

export function productLinksFromHtml(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\shref=["']([^"'#]+)["']/gi)) {
    const abs = absoluteUrl(decodeEntities(m[1]), pageUrl);
    if (!abs) continue;
    const u = new URL(abs);
    if (u.origin !== origin || !looksLikeProductPath(u.pathname)) continue;
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

  let links = listUrls.length ? listUrls : productLinksFromHtml(html, feedUrl);
  // A homepage usually features only some coffees; the shop/coffee listing has them all.
  if (!listUrls.length) {
    for (const listing of listingLinks(html, feedUrl).filter((u) => u !== feedUrl.replace(/\/$/, ""))) {
      const page = await safeFetchText(listing, "text/html").catch(() => null);
      if (page && page.status < 400) links = [...new Set([...links, ...productLinksFromHtml(page.body, listing)])];
    }
  }
  // Deepest paths first: products sit below their category pages.
  const candidates = links.sort((a, b) => b.split("/").length - a.split("/").length).slice(0, MAX_PRODUCT_PAGES);
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
