import { fetchBigCartel, isBigCartelList, parseBigCartel } from "./bigcartel";
import { collectSkipped, noteSkipped } from "./filter";
import { fetchJsonLd } from "./jsonld";
import { BLOCKED_MESSAGE, FetchError, isBlocked, parseJsonBody, safeFetchJson, safeFetchText } from "./safeFetch";
import { fetchSquare, isSquareOnlineHtml } from "./square";
import { fetchStorefront, isStorefrontHtml } from "./storefront";
import { fetchSubbly, isSubblyHtml } from "./subbly";
import { fetchWix, isWixStoresHtml } from "./wix";
import { fetchShopify, parseShopify, shopifyProductsEndpoint } from "./shopify";
import {
  SQUARESPACE_SHOP_GUESSES, fetchSquarespace, isSquarespaceProductPage, parseSquarespace, siteTitle, withFormatJson,
} from "./squarespace";
import { CJK, preferLatin } from "./text";
import type { FeedSource, Platform, Product, RoasterFeed } from "./types";
import { fetchWooCommerce, parseWooCommerce, wooEndpoint } from "./woocommerce";

const MAX_PRODUCTS = 300;

export const PLATFORMS: Platform[] = ["shopify", "storefront", "woocommerce", "squarespace", "square", "subbly", "wix", "bigcartel", "jsonld"];

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

/** The same address with "www." added or removed. */
function otherWww(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
  return normalizeUrl(u.toString());
}

async function hasShopifyFeed(url: string): Promise<boolean> {
  const res = await safeFetchJson(`${shopifyProductsEndpoint(url)}?limit=1`).catch(() => null);
  return Array.isArray((res?.data as { products?: unknown } | undefined)?.products);
}

/**
 * Stores that label both channels ("retail" on some products, "wholesale" on
 * others, like Blendin) mean it: drop the wholesale side. A "wholesale" tag
 * alone isn't enough (Sweet Bloom tags retail bags that way too).
 */
export function dropWholesaleChannel(products: Product[]): Product[] {
  if (!products.some((p) => p.channel === "retail") || !products.some((p) => p.channel === "wholesale")) return products;
  return products.filter((p) => {
    if (p.channel !== "wholesale") return true;
    noteSkipped(p.title);
    return false;
  });
}

/**
 * Some roasters list each product twice: retail, and a wholesale copy with the
 * same name at a wholesale price (Hex: "Gachatha • Washed" at $26 and $14.75,
 * often with no wholesale tag at all). Wholesale is typically 30-45% off, so
 * when same-named listings of the same bag size differ that much, drop the cheaper ones.
 * Twins priced alike (separate filter/espresso roasts) are both kept.
 */
export function dropWholesaleTwins(products: Product[]): Product[] {
  const unit = (p: Product) => (p.price === null ? null : p.size ? p.price / p.size.grams : p.price);
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    // Same name and same bag size: bigger bags are normally cheaper per gram, which isn't wholesale.
    const key = `${p.title.toLowerCase().replace(/\s+/g, " ").trim()}|${p.size?.grams ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const drop = new Set<Product>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const top = Math.max(...group.map((p) => unit(p) ?? 0));
    for (const p of group) {
      const u = unit(p);
      if (u !== null && top > 0 && u <= top * 0.8) drop.add(p);
    }
  }
  if (drop.size === 0) return products;
  // If every twin a vendor name had was the cheap copy, that name is the wholesale
  // catalogue (Hex files it as "HEX Coffee Roasters", retail as "HEX Coffee"), so its
  // wholesale-only items with no retail twin (Milkbread) go too.
  const twinWinners = new Set(
    [...groups.values()].filter((g) => g.length > 1).flat().filter((p) => !drop.has(p)).map((p) => p.vendor),
  );
  const wholesaleVendors = new Set(
    [...drop].map((p) => p.vendor).filter((v): v is string => typeof v === "string" && v !== "" && !twinWinners.has(v)),
  );
  for (const p of products) if (p.vendor && wholesaleVendors.has(p.vendor)) drop.add(p);
  for (const p of drop) noteSkipped(p.title);
  return products.filter((p) => !drop.has(p));
}

/**
 * Filter and espresso roasts sold as separate products with the same name read
 * like duplicates (Father's "Colombia – Chapata" at /coffee/espresso/… and
 * /coffee/filter/…). Where names collide, add the roast from the product's address.
 */
export function labelRoastTwins(products: Product[]): Product[] {
  const norm = (t: string) => t.toLowerCase().replace(/[\u2013\u2014-]/g, "-").replace(/\s+/g, " ").trim();
  const count = new Map<string, number>();
  for (const p of products) count.set(norm(p.title), (count.get(norm(p.title)) ?? 0) + 1);
  return products.map((p) => {
    if ((count.get(norm(p.title)) ?? 0) < 2) return p;
    const path = (() => { try { return new URL(p.url).pathname.toLowerCase(); } catch { return ""; } })();
    const roast = /(^|[/_-])espresso([/_-]|$)/.test(path) ? "Espresso" : /(^|[/_-])(filter|filtr|pour-?over)([/_-]|$)/.test(path) ? "Filter" : null;
    return roast && !p.title.toLowerCase().includes(roast.toLowerCase()) ? { ...p, title: `${p.title} (${roast})` } : p;
  });
}

const BULK_GRAMS = 900;

/**
 * Bulk-only products (a 1 kg or 2.5 kg bag with no regular size) from a roaster
 * that otherwise sells regular bags are almost always for cafés and offices:
 * Coffee Collective's "Bekele Honey, TIN 4 kg", Prodigal's "Iced Coffee - 2.5
 * Kilos". Roasters selling mostly in bulk (green coffee) are left alone.
 */
export function dropBulkOnly(products: Product[]): Product[] {
  const sized = products.filter((p) => p.size);
  const retail = sized.filter((p) => p.size!.grams < BULK_GRAMS).length;
  if (sized.length === 0 || retail * 2 < sized.length) return products;
  return products.filter((p) => {
    // Sold-out items are already hidden; only drop bulk-only ones that would show.
    if (!p.available || !p.size || p.size.grams < BULK_GRAMS) return true;
    noteSkipped(p.title);
    return false;
  });
}

function finish(source: FeedSource, siteName: string | null, products: Product[]): RoasterFeed {
  return {
    source,
    siteName,
    products: labelRoastTwins(dropBulkOnly(dropWholesaleTwins(dropWholesaleChannel(dropOtherMarketListings(products.filter(isRealPrice))))))
      // Big catalogues are mostly sold-out archives; make sure the cap keeps what's buyable.
      .sort((a, b) => Number(b.available) - Number(a.available))
      .slice(0, MAX_PRODUCTS)
      // vendor was only needed for the wholesale checks above.
      .map(({ vendor: _vendor, channel: _channel, ...p }) => ({ ...p, title: preferLatin(p.title), description: preferLatin(p.description) })),
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
    storefront: (url) => fetchStorefront(url),
    subbly: (url) => fetchSubbly(url),
    wix: (url) => fetchWix(url),
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
  const probe = await safeFetchText(`${shopifyProductsEndpoint(url)}?limit=250`, "application/json").catch(() => null);
  // Remember a refusal so the final error can say so instead of "try again".
  let blocked = probe ? isBlocked(probe) : false;
  const probeData = probe && probe.status < 300 ? parseJsonBody(probe.body) : null;
  const pj = probeData === null ? null : { url: probe!.url, data: probeData };
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

  // 2b. Some stores run a custom-built site on one host and the regular Shopify
  //     store on the other: drinkpassenger.com (custom) vs www.drinkpassenger.com.
  const alternate = otherWww(url);
  if (await hasShopifyFeed(alternate)) {
    const full = await fetchShopify(alternate, opts.currency);
    return finish({ platform: "shopify", feedUrl: alternate }, full.siteName, full.products);
  }

  // 3. Everything else needs the page itself.
  const page = await safeFetchText(url, "text/html");
  if (isBlocked(page)) throw new FetchError(BLOCKED_MESSAGE, page.status);
  if (page.status >= 400) throw new FetchError(`The site returned an error (${page.status}). Is the link right?`, page.status);
  const html = page.body;

  // The roaster moved to a new domain (e.g. subtextcoffee.com → subtext.coffee): start over there.
  const landedOn = new URL(page.url);
  if (!followedMove && landedOn.hostname.replace(/^www\./, "") !== new URL(url).hostname.replace(/^www\./, "")) {
    return detectFeedInner(landedOn.origin + new URL(url).pathname, true, opts);
  }

  // Custom-built Shopify sites often name their store's own address (x.myshopify.com),
  // where the regular product feed may still be served.
  const shopHost = html.match(/\b[a-z0-9][a-z0-9-]*\.myshopify\.com\b/)?.[0];
  if (shopHost && shopHost !== new URL(url).hostname) {
    const shopUrl = `https://${shopHost}${new URL(url).pathname === "/" ? "" : new URL(url).pathname}`;
    if (await hasShopifyFeed(shopUrl)) {
      const full = await fetchShopify(shopUrl, opts.currency);
      if (full.products.length > 0) return finish({ platform: "shopify", feedUrl: shopUrl }, full.siteName, full.products);
    }
  }

  // Headless Shopify: no /products.json, but pages embed Storefront API product data.
  if (isStorefrontHtml(html)) {
    const sf = await fetchStorefront(url, html).catch(() => null);
    if (sf && sf.products.length > 0) return finish({ platform: "storefront", feedUrl: url }, sf.siteName, sf.products);
  }

  // The page is Shopify but /products.json didn't answer the first time. That's
  // usually a momentary block or rate limit, so try once more before falling back.
  if (isShopifyHtml(html)) {
    const retry = await fetchShopify(url, opts.currency).catch(() => null);
    if (retry && retry.products.length > 0) return finish({ platform: "shopify", feedUrl: url }, retry.siteName, retry.products);
  }

  if (isWixStoresHtml(html)) {
    const wx = await fetchWix(url, html).catch(() => null);
    if (wx && wx.products.length > 0) return finish({ platform: "wix", feedUrl: url }, wx.siteName, wx.products);
  }

  if (isSubblyHtml(html)) {
    const sb = await fetchSubbly(url, html).catch(() => null);
    if (sb && sb.products.length > 0) return finish({ platform: "subbly", feedUrl: url }, sb.siteName, sb.products);
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

  if (blocked) throw new FetchError(BLOCKED_MESSAGE);
  if (isShopifyHtml(html)) throw new FetchError("This Shopify store didn't share its product list just now. Try again in a minute.");
  throw new FetchError(
    "We couldn't find any coffees on that page. Try pasting the link to the roaster's shop or coffee page instead of the homepage.",
  );
}

export { parseShopify, parseWooCommerce, parseSquarespace, parseBigCartel };
export type { FeedSource, Platform, Product, RoasterFeed };
