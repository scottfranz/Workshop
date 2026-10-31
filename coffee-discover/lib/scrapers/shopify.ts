import { keepCoffee, noteSkipped, searchTextFor, titleSaysCoffee } from "./filter";
import { hydrogenShownSizes, isHydrogenHome } from "./hydrogen";
import { FetchError, safeFetchJson, safeFetchText } from "./safeFetch";
import { absoluteUrl, decodeEntities, pickBag, retailInStock, stripHtml, summarize, toIso, withoutLogistics } from "./text";
import type { Product } from "./types";

interface ShopifyProduct {
  id: number | string;
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  tags?: string[] | string;
  published_at?: string;
  created_at?: string;
  variants?: { price?: string; available?: boolean; title?: string; option1?: string | null; option2?: string | null; option3?: string | null }[];
  options?: { name?: string; values?: string[] }[];
  images?: { src?: string }[];
}

/** Turns a shop or collection URL into the matching products.json endpoint. */
export function shopifyProductsEndpoint(feedUrl: string): string {
  const u = new URL(feedUrl);
  const collection = u.pathname.match(/\/collections\/[^/]+/);
  return `${u.origin}${collection ? collection[0] : ""}/products.json`;
}

/** "retail" / "wholesale" when the store labels the product's sales channel itself. */
function channelOf(tags: string[], productType?: string): "retail" | "wholesale" | undefined {
  const labels = [...tags, productType ?? ""].map((t) => t.toLowerCase().trim());
  if (labels.some((t) => /\b(wholesale|b2b)\b/.test(t))) return "wholesale";
  if (labels.some((t) => t === "retail")) return "retail";
  return undefined;
}

/**
 * A coffee roasted for one wholesale customer: a "b2b-" / "wholesale-" tag naming
 * a business that's also in the title (H&S's "Java Moon Bighorn Medium", tagged
 * "b2b-java-moon"). Generic tags like Sweet Bloom's "wholesale-coffee", used on
 * retail bags too, name no one.
 */
export function isPrivateLabel(tags: string[], title: string): boolean {
  const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const titleText = ` ${words(title).join(" ")} `;
  return tags.some((tag) => {
    const name = tag.toLowerCase().match(/^(?:b2b|wholesale)[\s_:-]+(.+)$/)?.[1];
    if (!name) return false;
    const parts = words(name).filter((w) => !/^(coffee|coffees|only|product|products|account|accounts|customer|customers|price|pricing|list|bulk|item|items)$/.test(w));
    return parts.length > 0 && titleText.includes(` ${parts.join(" ")} `);
  });
}

/**
 * @param listed handles in the store's sitemap. Shops keep wholesale, café-only,
 *   partner and other private products out of it, but also hide some public
 *   coffees from search engines (Regalia's Vinka lots), and new products can be
 *   missing while the sitemap catches up. So a product missing from it is only
 *   left out when its name gives no sign of being coffee ("Onyx Likes You",
 *   "IO-E-23"), not when it does ("Vinka Washed Sidra").
 * @param shown sizes the store's own site offers, by handle (see hydrogen.ts).
 */
export function parseShopify(
  data: unknown, feedUrl: string, currency: string | null = null, listed: Set<string> | null = null,
  shown: Map<string, Set<string>> | null = null,
): Product[] {
  const list = (data as { products?: ShopifyProduct[] })?.products;
  if (!Array.isArray(list)) return [];
  const origin = new URL(feedUrl).origin;
  const products: Product[] = [];
  for (const p of list) {
    const title = (p.title ?? "").trim();
    if (!title || !p.handle) continue;
    const tags = Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",").map((t) => t.trim());
    const variants = p.variants ?? [];
    const options = [
      ...(p.options ?? []).flatMap((o) => [o.name ?? "", ...(o.values ?? [])]),
      ...variants.map((v) => v.title ?? ""),
    ].filter((o) => o && o !== "Title" && o !== "Default Title");
    const signals = { title, productType: p.product_type, tags, vendor: p.vendor, description: stripHtml(p.body_html), options };
    if (!keepCoffee(signals)) continue;
    // $0.00 everywhere: not on sale yet, or priced by a bundle app we can't see.
    if (variants.length && variants.every((v) => !(parseFloat(v.price ?? "") > 0))) {
      noteSkipped(title);
      continue;
    }
    if (isPrivateLabel(tags, title)) {
      noteSkipped(title);
      continue;
    }
    // Unlisted with no description at all: event, café or partner leftovers (Monogram's
    // SCA expo tasters "Finca Deborah Enigma", Onyx's "Solace"). Real coffees a shop keeps
    // out of its sitemap still have one (Onyx's Panama Elida, Regalia's Vinka lots).
    if (listed && !listed.has(p.handle) && (!titleSaysCoffee(title) || !stripHtml(p.body_html).trim())) {
      noteSkipped(title);
      continue;
    }
    const offered = shown?.get(p.handle);
    const sold = offered ? variants.filter((v) => offered.has(v.title ?? "")) : [];
    const priced = (sold.length ? sold : variants).map((v) => ({ price: v.price, available: v.available, label: [v.title, v.option1, v.option2, v.option3].filter(Boolean).join(" ") }));
    const bag = pickBag(priced, title);
    products.push({
      id: String(p.id),
      title,
      url: `${origin}/products/${p.handle}`,
      image: absoluteUrl(p.images?.[0]?.src, origin),
      price: bag.price,
      size: bag.size,
      vendor: p.vendor || undefined,
      channel: channelOf(tags, p.product_type),
      currency,
      // "Archived" products linger in the feed with stray stock (Passenger's Bumba).
      available: retailInStock(priced) && !tags.some((t) => /^archived?$/i.test(t.trim())) && offered?.size !== 0,
      publishedAt: toIso(p.published_at ?? p.created_at),
      description: summarize(p.body_html),
      searchText: searchTextFor(signals),
    });
  }
  return products;
}

export async function shopifyMeta(feedUrl: string): Promise<{ name: string | null; currency: string | null }> {
  const res = await safeFetchJson(`${new URL(feedUrl).origin}/meta.json`).catch(() => null);
  const meta = res?.data as { name?: string; currency?: string } | undefined;
  return { name: meta?.name ?? null, currency: meta?.currency ?? null };
}

/**
 * The currency the store will actually price in for our requests. Stores using
 * Shopify Markets price for the visitor's country (our servers are in the US),
 * and ?currency= is only honoured if the store offers that currency there:
 * Luna (a Canadian store) answers CAD from Canada but USD from the US. The cart
 * reports the currency in effect, so ask it, using the same ?currency= hint.
 */
export async function shopifyPricingCurrency(feedUrl: string, preferred: string | null): Promise<string | null> {
  const hint = preferred ? `?currency=${encodeURIComponent(preferred)}` : "";
  const res = await safeFetchJson(`${new URL(feedUrl).origin}/cart.js${hint}`).catch(() => null);
  const currency = (res?.data as { currency?: string } | undefined)?.currency;
  return typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : preferred;
}

/** Product handles from the store's sitemap, or null if it can't be read (then nothing is filtered on it). */
export async function shopifyListedHandles(feedUrl: string): Promise<Set<string> | null> {
  const origin = new URL(feedUrl).origin;
  try {
    const index = await safeFetchText(`${origin}/sitemap.xml`, "application/xml, text/xml");
    if (index.status >= 400) return null;
    // Only the default-language product sitemaps; /en-int/ etc. repeat the same handles.
    const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const files = [...index.body.matchAll(new RegExp(`<loc>(${escaped}/sitemap_products_\\d+\\.xml[^<]*)</loc>`, "g"))]
      .map((m) => m[1].replace(/&amp;/g, "&"))
      .slice(0, 5);
    if (files.length === 0) return null;
    const handles = new Set<string>();
    for (const file of files) {
      const res = await safeFetchText(file, "application/xml, text/xml");
      if (res.status >= 400) return null;
      for (const m of res.body.matchAll(/\/products\/([^<?#/"]+)\s*<\/loc>/g)) handles.add(decodeURIComponent(m[1]));
    }
    return handles.size > 0 ? handles : null;
  } catch {
    return null;
  }
}

/** @param preferredCurrency the visitor's chosen currency; defaults to the store's own. */
export async function fetchShopify(feedUrl: string, preferredCurrency?: string): Promise<{ products: Product[]; siteName: string | null }> {
  const endpoint = shopifyProductsEndpoint(feedUrl);
  const [meta, listed] = await Promise.all([shopifyMeta(feedUrl), shopifyListedHandles(feedUrl)]);
  // Ask for the visitor's currency (the store's own price there, not a conversion)
  // or else the store's home currency, then label prices with whatever it actually uses.
  const currency = await shopifyPricingCurrency(feedUrl, preferredCurrency ?? meta.currency);
  // A Hydrogen site can hide sizes products.json lists; fetch its homepage alongside.
  const home = safeFetchText(new URL(feedUrl).origin + "/", "text/html").catch(() => null);
  const pages: unknown[] = [];
  for (let page = 1; page <= 6; page++) {
    const currencyParam = currency ? `&currency=${encodeURIComponent(currency)}` : "";
    const res = await safeFetchJson(`${endpoint}?limit=250&page=${page}${currencyParam}`);
    const raw = (res?.data as { products?: unknown[] })?.products;
    if (!Array.isArray(raw)) {
      if (page === 1) throw new FetchError("This store's product feed isn't available.");
      break;
    }
    // Stop on an empty page, not a short one: Shopify sometimes returns 249 of 250
    // with more pages still to come (Onyx's retail blends were on page 2).
    if (raw.length === 0) break;
    pages.push(res!.data);
  }
  const parseAll = (shown: Map<string, Set<string>> | null = null) =>
    pages.flatMap((data) => parseShopify(data, feedUrl, currency, listed, shown));
  let products = parseAll();
  let homePage = await home;
  if (!homePage || homePage.status >= 500) homePage = await safeFetchText(new URL(feedUrl).origin + "/", "text/html").catch(() => null);
  if (isHydrogenHome(homePage)) {
    const sizeCount = new Map(pages.flatMap((d) => (d as { products: ShopifyProduct[] }).products)
      .map((p) => [p.handle, p.variants?.length ?? 0] as const));
    const inStock = products.map((p) => p.url.split("/products/")[1])
      .filter((h, i) => products[i].available && (sizeCount.get(h) ?? 0) > 1);
    const shown = await hydrogenShownSizes(homePage, inStock);
    if (shown) products = parseAll(shown);
  }
  await describeFromPages(products);
  return { products, siteName: meta.name };
}

const MAX_PAGE_DESCRIPTIONS = 24;

/**
 * Some shops leave the product description to shipping notes and write about the
 * coffee only in the page's search summary (Subtext: "...a washed field blend with
 * tasting notes of green grape, cranberry & orange zest"). For in-stock coffees with
 * no description, read that summary from the product page.
 */
async function describeFromPages(products: Product[]): Promise<void> {
  const bare = products.filter((p) => p.available && !p.description).slice(0, MAX_PAGE_DESCRIPTIONS);
  const found = new Map<Product, string>();
  for (let i = 0; i < bare.length; i += 4) {
    await Promise.all(bare.slice(i, i + 4).map(async (p) => {
      const res = await safeFetchText(p.url, "text/html").catch(() => null);
      const text = res && res.status < 400 ? pageSummary(res.body) : null;
      if (text) found.set(p, text);
    }));
  }
  // The same summary on several coffees is the shop's own blurb, not about the coffee.
  const uses = new Map<string, number>();
  for (const text of found.values()) uses.set(text, (uses.get(text) ?? 0) + 1);
  for (const [p, text] of found) {
    if (uses.get(text)! > 1) continue;
    p.description = summarize(text);
    p.searchText = [p.searchText, text.toLowerCase()].filter(Boolean).join(" ");
  }
}

/** A page's own summary (meta description), unless it's the shop's generic one or shipping notes. */
export function pageSummary(html: string): string | null {
  const meta = (attr: string) => html.match(new RegExp(`<meta[^>]+${attr}[^>]+content="([^"]*)"`, "i"))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attr}`, "i"))?.[1];
  const text = decodeEntities(meta('name="description"') ?? meta('property="og:description"') ?? "").trim();
  const site = decodeEntities(meta('property="og:site_name"') ?? "").trim();
  const clean = text && withoutLogistics(text);
  return clean && clean.length >= 30 && clean !== site ? clean : null;
}
