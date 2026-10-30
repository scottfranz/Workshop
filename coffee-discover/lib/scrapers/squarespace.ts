import { keepCoffee, searchTextFor } from "./filter";
import { FetchError, safeFetchJson } from "./safeFetch";
import { absoluteUrl, pickBag, stripHtml, summarize, toIso, toNumber } from "./text";
import type { Product } from "./types";

// Squarespace pages return their content as JSON when you add ?format=json.
// Older sites put prices (in cents) under structuredContent.variants; 7.1
// commerce sites use variants[].priceMoney with decimal strings.

interface SqsMoney { currency?: string; value?: string }
interface SqsVariant {
  price?: number; salePrice?: number; onSale?: boolean; qtyInStock?: number; unlimited?: boolean;
  priceMoney?: SqsMoney; salePriceMoney?: SqsMoney;
  stock?: { quantity?: number; unlimited?: boolean };
  attributes?: Record<string, string>;
  optionValues?: { optionName?: string; value?: string }[];
}
interface SqsItem {
  id?: string;
  title?: string;
  fullUrl?: string;
  assetUrl?: string;
  items?: { assetUrl?: string }[];
  publishOn?: number;
  addedOn?: number;
  excerpt?: string;
  body?: string;
  recordTypeLabel?: string;
  productType?: number | string;
  structuredContent?: { productType?: number | string; variants?: SqsVariant[] };
  variants?: SqsVariant[];
}
interface SqsPage {
  website?: { siteTitle?: string; baseCurrency?: string };
  websiteSettings?: { storeSettings?: { selectedCurrency?: string } };
  collection?: { typeName?: string; type?: number };
  items?: SqsItem[];
  pagination?: { nextPage?: boolean; nextPageUrl?: string; nextPageOffset?: number };
}

export function withFormatJson(url: string): string {
  const u = new URL(url);
  u.searchParams.set("format", "json");
  return u.toString();
}

function variantsOf(item: SqsItem): SqsVariant[] {
  return item.variants ?? item.structuredContent?.variants ?? [];
}

export function isSquarespaceProductPage(data: unknown): boolean {
  const page = data as SqsPage;
  if (!page || !Array.isArray(page.items)) return false;
  if (page.collection?.typeName?.includes("products")) return true;
  return page.items.some((i) => variantsOf(i).length > 0);
}

function variantPrice(v: SqsVariant): number | null {
  const sale = v.onSale ? (toNumber(v.salePriceMoney?.value) ?? (v.salePrice != null ? v.salePrice / 100 : null)) : null;
  const regular = toNumber(v.priceMoney?.value) ?? (v.price != null ? v.price / 100 : null);
  return sale ?? regular;
}

function variantInStock(v: SqsVariant): boolean {
  if (v.stock) return v.stock.unlimited === true || (v.stock.quantity ?? 0) > 0;
  if (v.unlimited !== undefined || v.qtyInStock !== undefined) return v.unlimited === true || (v.qtyInStock ?? 0) > 0;
  return true;
}

export function parseSquarespace(data: unknown, feedUrl: string): Product[] {
  const page = data as SqsPage;
  if (!page || !Array.isArray(page.items)) return [];
  const origin = new URL(feedUrl).origin;
  const pageCurrency = page.websiteSettings?.storeSettings?.selectedCurrency ?? page.website?.baseCurrency ?? null;
  const products: Product[] = [];
  for (const item of page.items) {
    const title = (item.title ?? "").trim();
    const variants = variantsOf(item);
    if (!title || !item.fullUrl || variants.length === 0) continue;
    const options = variants.flatMap((v) => [
      ...Object.entries(v.attributes ?? {}).flat(),
      ...(v.optionValues ?? []).flatMap((o) => [o.optionName ?? "", o.value ?? ""]),
    ]);
    const description = stripHtml(`${item.excerpt ?? ""} ${item.body ?? ""}`);
    const signals = { title, description, options };
    if (!keepCoffee(signals)) continue;
    products.push({
      id: item.id ?? item.fullUrl,
      title,
      url: absoluteUrl(item.fullUrl, origin) ?? origin,
      image: absoluteUrl(item.assetUrl ?? item.items?.[0]?.assetUrl, origin),
      ...(() => {
        const bag = pickBag(variants.map((v) => ({
          price: variantPrice(v),
          available: variantInStock(v),
          label: [...Object.values(v.attributes ?? {}), ...(v.optionValues ?? []).map((o) => o.value ?? "")].join(" "),
        })), title);
        return { price: bag.price, size: bag.size };
      })(),
      currency: variants.find((v) => v.priceMoney?.currency)?.priceMoney?.currency ?? pageCurrency,
      available: variants.some(variantInStock),
      publishedAt: toIso(item.publishOn ?? item.addedOn),
      description: summarize(item.excerpt || item.body),
      searchText: searchTextFor(signals),
    });
  }
  return products;
}

export function siteTitle(data: unknown): string | null {
  return (data as SqsPage)?.website?.siteTitle ?? null;
}

// Paths roasters commonly use for their shop when someone pastes the homepage.
export const SQUARESPACE_SHOP_GUESSES = ["/shop", "/coffee", "/store", "/shop-coffee", "/coffees", "/shop/coffee", "/beans", "/buy"];

export async function fetchSquarespace(feedUrl: string): Promise<{ products: Product[]; siteName: string | null }> {
  const first = await safeFetchJson(withFormatJson(feedUrl));
  if (!first || !isSquarespaceProductPage(first.data)) throw new FetchError("This shop page isn't available.");
  const products = parseSquarespace(first.data, feedUrl);
  let pagination = (first.data as SqsPage).pagination;
  for (let i = 0; i < 6 && pagination?.nextPage && pagination.nextPageUrl; i++) {
    const next = await safeFetchJson(withFormatJson(new URL(pagination.nextPageUrl, feedUrl).toString()));
    if (!next) break;
    products.push(...parseSquarespace(next.data, feedUrl));
    pagination = (next.data as SqsPage).pagination;
  }
  return { products, siteName: siteTitle(first.data) };
}
