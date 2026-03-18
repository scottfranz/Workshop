import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase.from("hidden_products").select("key");
  if (error) return NextResponse.json({ keys: [] });
  return NextResponse.json({ keys: data.map((r: { key: string }) => r.key) });
}

export async function POST(req: Request) {
  const { key } = await req.json();
  const { error } = await supabase.from("hidden_products").upsert({ key }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { key } = await req.json();
  const { error } = await supabase.from("hidden_products").delete().eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
