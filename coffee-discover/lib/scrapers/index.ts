import { fetchBigCartel, isBigCartelList, parseBigCartel } from "./bigcartel";
import { collectSkipped, noteSkipped } from "./filter";
import { fetchJsonLd } from "./jsonld";
import { FetchError, safeFetchJson, safeFetchText } from "./safeFetch";
import { fetchSquare, isSquareOnlineHtml } from "./square";
import { fetchShopify, parseShopify, shopifyProductsEndpoint } from "./shopify";
import {
  SQUARESPACE_SHOP_GUESSES, fetchSquarespace, isSquarespaceProductPage, parseSquarespace, siteTitle, withFormatJson,
} from "./squarespace";
import { CJK, preferLatin } from "./text";
import type { FeedSource, Platform, Product, RoasterFeed } from "./types";
import { fetchWooCommerce, parseWooCommerce, wooEndpoint } from "./woocommerce";

const MAX_PRODUCTS = 300;

export const PLATFORMS: Platform[] = ["shopify", "woocommerce", "squarespace", "square", "bigcartel", "jsonld"];

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

/**
 * Roasters selling in several countries sometimes list products for another
 * market (e.g. Regalia's Japanese SCAJ listings) that 404 for everyone else.
 * When most of a catalogue has Latin-script titles, leave out the listings
 * titled in Japanese/Chinese/Korean. Mostly-CJK catalogues are left alone.
 */
export function dropOtherMarketListings(products: Product[]): Product[] {
  const foreign = products.filter((p) => CJK.test(p.title));
  if (foreign.length === 0 || foreign.length * 2 >= products.length) return products;
  for (const p of foreign) noteSkipped(p.title);
  return products.filter((p) => !CJK.test(p.title));
}

// Tips, add-ons and free samples ($0.01, $1) aren't bags of coffee. Skipped for
// currencies where 2 units is still a real price floor problem (JPY, KRW...).
const SMALL_UNIT_CURRENCIES = new Set(["JPY", "KRW", "VND", "IDR", "CLP", "COP", "HUF", "TWD", "INR", "THB", "PHP"]);
function isRealPrice(p: Product): boolean {
  if (p.price === null || p.price >= 2 || (p.currency && SMALL_UNIT_CURRENCIES.has(p.currency))) return true;
  noteSkipped(p.title);
  return false;
}

function finish(source: FeedSource, siteName: string | null, products: Product[]): RoasterFeed {
  return {
    source,
    siteName,
    products: dropOtherMarketListings(products.filter(isRealPrice))
      // Big catalogues are mostly sold-out archives; make sure the cap keeps what's buyable.
      .sort((a, b) => Number(b.available) - Number(a.available))
      .slice(0, MAX_PRODUCTS)
      .map((p) => ({ ...p, title: preferLatin(p.title), description: preferLatin(p.description) })),
  };
}

async function withSkipped(fn: () => Promise<RoasterFeed>): Promise<RoasterFeed> {
  const [feed, skipped] = await collectSkipped(fn);
  return { ...feed, skipped: skipped.map((t) => preferLatin(t)) };
}

/**
 * Read a roaster whose platform we already know. Roasters do move (WooCommerce
 * to Shopify, new domain), so if the saved setup stops working, detect afresh;
 * the response's source tells the client to update what it saved.
 */
/** Options that change what stores send back. */
export interface FeedOptions {
  /** Ask stores that support it (Shopify) to price in this currency. */
  currency?: string;
}

export function fetchFeed(source: FeedSource, opts: FeedOptions = {}): Promise<RoasterFeed> {
  return withSkipped(async () => {
    try {
      return await fetchFeedInner(source, opts);
    } catch (err) {
      const fresh = await detectFeedInner(source.feedUrl, false, opts).catch(() => null);
      if (fresh && fresh.products.length > 0) return fresh;
      throw err;
    }
  });
}

/** Work out how to read a store from whatever link someone pasted. */
export function detectFeed(rawUrl: string, opts: FeedOptions = {}): Promise<RoasterFeed> {
  return withSkipped(() => detectFeedInner(rawUrl, false, opts));
}

async function fetchFeedInner(source: FeedSource, opts: FeedOptions): Promise<RoasterFeed> {
  const loaders: Record<Platform, (url: string) => Promise<{ products: Product[]; siteName: string | null }>> = {
    shopify: (url) => fetchShopify(url, opts.currency),
    woocommerce: fetchWooCommerce,
    squarespace: fetchSquarespace,
    square: (url) => fetchSquare(url),
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
async function detectFeedInner(rawUrl: string, followedMove = false, opts: FeedOptions = {}): Promise<RoasterFeed> {
  const url = normalizeUrl(rawUrl);
  const origin = new URL(url).origin;

  // 1. Shopify and Big Cartel both answer /products.json (object vs array).
  const pj = await safeFetchJson(`${shopifyProductsEndpoint(url)}?limit=250`).catch(() => null);
  if (pj && Array.isArray((pj.data as { products?: unknown })?.products)) {
    // The full fetch also reads the sitemap, which hides wholesale/private products.
    const full = await fetchShopify(url, opts.currency);
    return finish({ platform: "shopify", feedUrl: url }, full.siteName, full.products);
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

  // The roaster moved to a new domain (e.g. subtextcoffee.com → subtext.coffee): start over there.
  const landedOn = new URL(page.url);
  if (!followedMove && landedOn.hostname.replace(/^www\./, "") !== new URL(url).hostname.replace(/^www\./, "")) {
    return detectFeedInner(landedOn.origin + new URL(url).pathname, true, opts);
  }

  // The page is Shopify but /products.json didn't answer the first time. That's
  // usually a momentary block or rate limit, so try once more before falling back.
  if (isShopifyHtml(html)) {
    const retry = await fetchShopify(url, opts.currency).catch(() => null);
    if (retry && retry.products.length > 0) return finish({ platform: "shopify", feedUrl: url }, retry.siteName, retry.products);
  }

  if (isSquareOnlineHtml(html)) {
    const sq = await fetchSquare(url, html);
    return finish({ platform: "square", feedUrl: url }, sq.siteName, sq.products);
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
