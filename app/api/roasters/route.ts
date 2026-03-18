import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const ROASTER_COLORS = ["#c0622a","#7a9e7e","#5b8fa8","#a0627a","#8a7ab8","#b8874a","#5b9e8a","#c05a5a","#6a8fb8","#9e7a3a","#b85a8a","#6aab6a","#c09a2a","#7a6ab8","#5baaa0"];

async function pickColor(): Promise<string> {
  const { data } = await supabase.from("roasters").select("color");
  const used = new Set((data ?? []).map((r: { color: string }) => r.color));
  const available = ROASTER_COLORS.filter(c => !used.has(c));
  if (available.length > 0) return available[0];
  // All colors taken — pick least used one
  const counts: Record<string, number> = {};
  ROASTER_COLORS.forEach(c => counts[c] = 0);
  (data ?? []).forEach((r: { color: string }) => { if (counts[r.color] !== undefined) counts[r.color]++; });
  return ROASTER_COLORS.sort((a, b) => counts[a] - counts[b])[0];
}

function deriveProductsUrl(rawUrl: string): string | null {
  let url = rawUrl.trim().replace(/\/$/, "");
  if (!url.startsWith("http")) url = "https://" + url;
  try {
    const parsed = new URL(url);
    const base = `${parsed.protocol}//${parsed.host}`;
    const path = parsed.pathname;
    if (path.includes("/collections/")) return `${base}${path}/products.json?limit=250`;
    return `${base}/products.json?limit=250`;
  } catch { return null; }
}

async function isShopify(productsUrl: string): Promise<boolean> {
  try {
    const res = await fetch(productsUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();
    return "products" in data;
  } catch { return false; }
}

export async function GET() {
  const { data, error } = await supabase.from("roasters").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name: string = body.name?.trim();
  const url: string = body.url?.trim();
  if (!name || !url) return NextResponse.json({ error: "Name and URL are required." }, { status: 400 });
  const productsUrl = deriveProductsUrl(url);
  if (!productsUrl) return NextResponse.json({ error: "Couldn't parse that URL." }, { status: 400 });
  const shopify = await isShopify(productsUrl);
  if (!shopify) return NextResponse.json({ error: "This doesn't look like a Shopify store. Only Shopify roasters can be added here." }, { status: 400 });
  const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
  const baseUrl = `${parsed.protocol}//${parsed.host}`;
  const { data, error } = await supabase.from("roasters").insert({ name, url: baseUrl, products_url: productsUrl, color: await pickColor(), type: "roasted", platform: "shopify" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { name } = await req.json();
  const { error } = await supabase.from("roasters").delete().eq("name", name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
