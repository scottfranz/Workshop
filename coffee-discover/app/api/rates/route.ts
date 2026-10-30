import { NextResponse } from "next/server";

// Daily European Central Bank reference rates, via Frankfurter (free, no key).
// Fetched here rather than in the browser so visitors never contact a third party,
// and cached so the upstream is asked about twice a day in total.

export const runtime = "nodejs";

const SOURCE = "https://api.frankfurter.app/latest?from=EUR";
let memo: { at: number; body: unknown } | null = null;
const MEMO_MS = 6 * 60 * 60 * 1000;

export async function GET() {
  if (!memo || Date.now() - memo.at > MEMO_MS) {
    try {
      const res = await fetch(SOURCE, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
      if (!data.rates) throw new Error("no rates");
      memo = { at: Date.now(), body: { base: "EUR", date: data.date ?? null, rates: { EUR: 1, ...data.rates } } };
    } catch (err) {
      console.error("exchange rates unavailable", err);
      if (!memo) return NextResponse.json({ error: "Exchange rates are unavailable right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json(memo.body, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=43200, stale-while-revalidate=86400" } });
}
