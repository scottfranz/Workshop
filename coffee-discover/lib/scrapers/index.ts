import { fetchBigCartel, isBigCartelList, parseBigCartel } from "./bigcartel";
import { collectSkipped } from "./filter";
import { fetchJsonLd } from "./jsonld";
import { FetchError, safeFetchJson, safeFetchText } from "./safeFetch";
import { fetchShopify, parseShopify, shopifyMeta, shopifyProductsEndpoint } from "./shopify";
import {
  SQUARESPACE_SHOP_GUESSES, fetchSquarespace, isSquarespaceProductPage, parseSquarespace, siteTitle, withFormatJson,
} from "./squarespace";
import { CJK, preferLatin } from "./text";
import type { FeedSource, Platform, Product, RoasterFeed } from "./types";
import { fetchWooCommerce, parseWooCommerce, wooEndpoint } from "./woocommerce";

const MAX_PRODUCTS = 300;

export const PLATFORMS: Platform[] = ["shopify", "woocommerce", "squarespace", "bigcartel", "jsonld"];

export function normalizeUrl(raw: string): string {
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  u.hash = "";
  // Tracking params would fragment the CDN cache for no benefit.
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) u.searchParams.delete(key);
  if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString().replace(/\/$/, "");
}

const comparable = (title: string) => preferLatin(title).toLowerCase().replace(/\bscaj\b/g, "").replace(/[^a-z0-9]+/g, "");
const imageKey = (src: string | null) => (src ? src.replace(/^https?:/, "").split("?")[0] : null);

/**
 * Some roasters list the same coffee twice: once in English and once with a
 * bilingual (e.g. English + Japanese) title for another market. Drop the
 * bilingual copy when an English-only listing has the same name or photo.
 */
export function dropBilingualDuplicates(products: Product[]): Product[] {
  const latin = products.filter((p) => !CJK.test(p.title));
  if (latin.length === 0 || latin.length === products.length) return products;
  const names = latin.map((p) => comparable(p.title)).filter((n) => n.length >= 4);
  const images = new Set(latin.map((p) => imageKey(p.image)).filter(Boolean));
  return products.filter((p) => {
    if (!CJK.test(p.title)) return true;
    const name = comparable(p.title);
    if (images.has(imageKey(p.image))) return false;
    return !names.some((n) => n === name || (name.length >= 6 && (n.includes(name) || name.includes(n))));
  });
}

function finish(source: FeedSource, siteName: string | null, products: Product[]): RoasterFeed {
  return {
    source,
    siteName,
    products: dropBilingualDuplicates(products)
      .slice(0, MAX_PRODUCTS)
      .map((p) => ({ ...p, title: preferLatin(p.title), description: preferLatin(p.description) })),
  };
}

async function withSkipped(fn: () => Promise<RoasterFeed>): Promise<RoasterFeed> {
  const [feed, skipped] = await collectSkipped(fn);
  return { ...feed, skipped: skipped.map((t) => preferLatin(t)) };
}

/** Read a roaster whose platform we already know. */
export function fetchFeed(source: FeedSource): Promise<RoasterFeed> {
  return withSkipped(() => fetchFeedInner(source));
}

/** Work out how to read a store from whatever link someone pasted. */
export function detectFeed(rawUrl: string): Promise<RoasterFeed> {
  return withSkipped(() => detectFeedInner(rawUrl));
}

async function fetchFeedInner(source: FeedSource): Promise<RoasterFeed> {
  const loaders: Record<Platform, (url: string) => Promise<{ products: Product[]; siteName: string | null }>> = {
    shopify: fetchShopify,
    woocommerce: fetchWooCommerce,
    squarespace: fetchSquarespace,
    bigcartel: fetchBigCartel,
    jsonld: (url) => fetchJsonLd(url),
  };
  const { products, siteName } = await loaders[source.platform](source.feedUrl);
  return finish(source, siteName, products);
}

function isSquarespaceHtml(html: string): boolean {
  return /Static\.SQUARESPACE_CONTEXT|<!-- This is Squarespace\. -->|squarespace-cdn\.com|content=["']Squarespace/i.test(html);
}

function isShopifyHtml(html: string): boolean {
  return /cdn\.shopify\.com|Shopify\.shop\s*=/.test(html);
}

async function detectSquarespace(url: string, html: string): Promise<RoasterFeed | null> {
  const candidates = [url];
  const origin = new URL(url).origin;
  // Prefer shop-looking links from the page's own navigation, then common guesses.
  for (const m of html.matchAll(/<a\b[^>]*\shref=["'](\/[a-z0-9\-/]*)["']/gi)) {
    if (/shop|store|coffee|beans|buy/i.test(m[1])) candidates.push(origin + m[1]);
  }
  candidates.push(...SQUARESPACE_SHOP_GUESSES.map((p) => origin + p));
  const tried = new Set<string>();
  for (const candidate of candidates) {
    if (tried.has(candidate) || tried.size >= 8) continue;
    tried.add(candidate);
    const res = await safeFetchJson(withFormatJson(candidate)).catch(() => null);
    if (res && isSquarespaceProductPage(res.data)) {
      const source: FeedSource = { platform: "squarespace", feedUrl: candidate };
      // Fetch the full (paginated) feed now that we know where the shop lives.
      const full = await fetchSquarespace(candidate).catch(() => null);
      return full
        ? finish(source, full.siteName, full.products)
        : finish(source, siteTitle(res.data), parseSquarespace(res.data, candidate));
    }
  }
  return null;
}

// Homepage, shop page or collection link: cheapest, most reliable checks go first.
async function detectFeedInner(rawUrl: string): Promise<RoasterFeed> {
  const url = normalizeUrl(rawUrl);
  const origin = new URL(url).origin;

  // 1. Shopify and Big Cartel both answer /products.json (object vs array).
  const pj = await safeFetchJson(`${shopifyProductsEndpoint(url)}?limit=250`).catch(() => null);
  if (pj && Array.isArray((pj.data as { products?: unknown })?.products)) {
    const meta = await shopifyMeta(url);
    const source: FeedSource = { platform: "shopify", feedUrl: url };
    if ((pj.data as { products: unknown[] }).products.length === 250) {
      const full = await fetchShopify(url);
      return finish(source, full.siteName, full.products);
    }
    return finish(source, meta.name, parseShopify(pj.data, url, meta.currency));
  }
  if (pj && isBigCartelList(pj.data)) {
    const full = await fetchBigCartel(url).catch(() => null);
    const source: FeedSource = { platform: "bigcartel", feedUrl: origin };
    return full ? finish(source, full.siteName, full.products) : finish(source, null, parseBigCartel(pj.data, url));
  }

  // 2. WooCommerce's public Store API.
  const woo = await safeFetchJson(`${wooEndpoint(url)}?per_page=1`).catch(() => null);
  if (woo && Array.isArray(woo.data)) {
    const source: FeedSource = { platform: "woocommerce", feedUrl: url };
    const full = await fetchWooCommerce(url);
    return finish(source, full.siteName, full.products);
  }

  // 3. Everything else needs the page itself.
  const page = await safeFetchText(url, "text/html");
  if (page.status >= 400) throw new FetchError(`The site returned an error (${page.status}). Is the link right?`, page.status);
  const html = page.body;

  // The page is Shopify but /products.json didn't answer the first time. That's
  // usually a momentary block or rate limit, so try once more before falling back.
  if (isShopifyHtml(html)) {
    const retry = await fetchShopify(url).catch(() => null);
    if (retry && retry.products.length > 0) return finish({ platform: "shopify", feedUrl: url }, retry.siteName, retry.products);
  }

  if (isSquarespaceHtml(html)) {
    const sqs = await detectSquarespace(url, html);
    if (sqs) return sqs;
  }

  // 4. Generic: schema.org product data on the page or its product pages.
  const generic = await fetchJsonLd(url, html);
  if (generic.products.length > 0) return finish({ platform: "jsonld", feedUrl: url }, generic.siteName, generic.products);

  if (isShopifyHtml(html)) throw new FetchError("This Shopify store didn't share its product list just now. Try again in a minute.");
  throw new FetchError(
    "We couldn't find any coffees on that page. Try pasting the link to the roaster's shop or coffee page instead of the homepage.",
  );
}

export { parseShopify, parseWooCommerce, parseSquarespace, parseBigCartel };
export type { FeedSource, Platform, Product, RoasterFeed };
