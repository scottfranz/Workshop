import { keepCoffee, searchTextFor } from "./filter";
import { FetchError, safeFetchJson } from "./safeFetch";
import { absoluteUrl, pickBag, summarize, toIso } from "./text";
import type { Product } from "./types";

interface BigCartelProduct {
  id: number;
  name?: string;
  url?: string;
  price?: number | string;
  status?: string;
  created_at?: string;
  description?: string;
  images?: { url?: string }[];
  categories?: { name?: string }[];
  options?: { name?: string; price?: number | string; sold_out?: boolean }[];
}

export function isBigCartelList(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null && "permalink" in data[0] && "status" in data[0];
}

export function parseBigCartel(data: unknown, feedUrl: string, currency: string | null = null): Product[] {
  if (!Array.isArray(data)) return [];
  const origin = new URL(feedUrl).origin;
  const products: Product[] = [];
  for (const p of data as BigCartelProduct[]) {
    const title = (p.name ?? "").trim();
    if (!title) continue;
    const cats = (p.categories ?? []).map((c) => c.name ?? "").join(" ");
    const options = p.options ?? [];
    const signals = { title, productType: cats, description: p.description, options: options.map((o) => o.name ?? "") };
    if (!keepCoffee(signals)) continue;
    products.push({
      id: String(p.id),
      title,
      url: absoluteUrl(p.url, origin) ?? origin,
      image: absoluteUrl(p.images?.[0]?.url, origin),
      ...(() => {
        const bag = options.length
          ? pickBag(options.map((o) => ({ price: o.price, available: !o.sold_out, label: o.name ?? "" })), title)
          : pickBag([{ price: p.price, label: title }]);
        return { price: bag.price, size: bag.size };
      })(),
      currency,
      available: p.status !== "sold-out" && (options.length === 0 || options.some((o) => !o.sold_out)),
      publishedAt: toIso(p.created_at),
      description: summarize(p.description),
      searchText: searchTextFor(signals),
    });
  }
  return products;
}

export async function fetchBigCartel(feedUrl: string): Promise<{ products: Product[]; siteName: string | null }> {
  const origin = new URL(feedUrl).origin;
  const [store, list] = await Promise.all([
    safeFetchJson(`${origin}/store.json`).catch(() => null),
    safeFetchJson(`${origin}/products.json`),
  ]);
  if (!list || !Array.isArray(list.data)) throw new FetchError("This store's product feed isn't available.");
  const info = store?.data as { name?: string; currency?: { code?: string } } | undefined;
  return { products: parseBigCartel(list.data, feedUrl, info?.currency?.code ?? null), siteName: info?.name ?? null };
}
