import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const cache: Record<string, { products: CoffeeProduct[]; fetchedAt: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000;
const SKIP_KEYWORDS = ["gift card","subscription","gear","grinder","dripper","kettle","scale","filter","merch","shirt","mug","capsule"];

export interface CoffeeProduct {
  title: string; price: number | null; available: boolean;
  url: string; image: string | null; roaster: string;
  roasterColor: string; type: "roasted" | "green";
}

interface Roaster {
  id: string; name: string; url: string; products_url: string;
  color: string; type: "roasted" | "green";
  platform: "shopify" | "woocommerce"; woo_category_id?: string;
}

async function fetchShopify(roaster: Roaster): Promise<CoffeeProduct[]> {
  const res = await fetch(roaster.products_url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const products: CoffeeProduct[] = [];
  for (const p of data.products ?? []) {
    const tl: string = (p.title ?? "").toLowerCase();
    const tyl: string = (p.product_type ?? "").toLowerCase();
    if (SKIP_KEYWORDS.some((k) => tl.includes(k))) continue;
    if (["merchandise","equipment","accessory"].some((k) => tyl.includes(k))) continue;
    const prices: number[] = (p.variants ?? []).map((v: {price:string}) => parseFloat(v.price)).filter((n:number) => !isNaN(n));
    products.push({ title: p.title ?? "", price: prices.length ? Math.min(...prices) : null, available: (p.variants ?? []).some((v:{available:boolean}) => v.available), url: `${roaster.url}/products/${p.handle ?? ""}`, image: p.images?.[0]?.src ?? null, roaster: roaster.name, roasterColor: roaster.color ?? "#888", type: roaster.type });
  }
  return products;
}

async function fetchWooCommerce(roaster: Roaster): Promise<CoffeeProduct[]> {
  const products: CoffeeProduct[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ per_page: "50", page: String(page), status: "publish" });
    if (roaster.woo_category_id) params.set("category", roaster.woo_category_id);
    const res = await fetch(`${roaster.products_url}?${params}`, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } });
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const p of data) {
      const prices = [p.price, p.regular_price, p.sale_price].map((v:string) => parseFloat(v)).filter((n:number) => !isNaN(n) && n > 0);
      products.push({ title: p.name ?? "", price: prices.length ? Math.min(...prices) : null, available: p.stock_status === "instock", url: p.permalink ?? roaster.url, image: p.images?.[0]?.src ?? null, roaster: roaster.name, roasterColor: roaster.color ?? "#888", type: roaster.type });
    }
    if (data.length < 50) break;
    page++;
  }
  return products;
}

async function fetchRoasterProducts(roaster: Roaster): Promise<CoffeeProduct[]> {
  const cached = cache[roaster.name];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.products;
  const products = roaster.platform === "woocommerce" ? await fetchWooCommerce(roaster) : await fetchShopify(roaster);
  products.sort((a, b) => { if (a.available !== b.available) return a.available ? -1 : 1; return (a.price ?? 9999) - (b.price ?? 9999); });
  cache[roaster.name] = { products, fetchedAt: Date.now() };
  return products;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("refresh") === "1") Object.keys(cache).forEach((k) => delete cache[k]);
  const typeFilter = searchParams.get("type");
  let query = supabase.from("roasters").select("*").order("name");
  if (typeFilter) query = (query as any).eq("type", typeFilter);
  const { data: roasters, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results = await Promise.allSettled((roasters as Roaster[]).map((r) => fetchRoasterProducts(r)));
  const allProducts: CoffeeProduct[] = [];
  const errors: { roaster: string; error: string }[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") allProducts.push(...result.value);
    else errors.push({ roaster: (roasters as Roaster[])[i].name, error: String(result.reason) });
  });
  return NextResponse.json({ products: allProducts, errors });
}
