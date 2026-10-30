import { NextResponse } from "next/server";

// Daily exchange rates, fetched here rather than in the browser so visitors never
// contact a third party, and cached so upstreams are asked about twice a day.
//   1. European Central Bank reference rates via Frankfurter (free, no key): ~30 currencies.
//   2. ExchangeRate-API's open endpoint (free, no key, attribution required) fills in the
//      rest, e.g. UAE dirham for Archers Coffee, which the ECB doesn't publish.

export const runtime = "nodejs";

const ECB = "https://api.frankfurter.dev/v1/latest?base=EUR";
const OPEN = "https://open.er-api.com/v6/latest/EUR";
let memo: { at: number; body: unknown } | null = null;
const MEMO_MS = 6 * 60 * 60 * 1000;

type RateTable = Record<string, number>;

async function getRates(url: string, pick: (data: unknown) => { date: string | null; rates: RateTable } | null) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? pick(await res.json()) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (!memo || Date.now() - memo.at > MEMO_MS) {
    const [ecb, open] = await Promise.all([
      getRates(ECB, (d) => {
        const x = d as { date?: string; rates?: RateTable };
        return x.rates ? { date: x.date ?? null, rates: x.rates } : null;
      }),
      getRates(OPEN, (d) => {
        const x = d as { result?: string; rates?: RateTable; time_last_update_utc?: string };
        return x.result === "success" && x.rates
          ? { date: x.time_last_update_utc ? new Date(x.time_last_update_utc).toISOString().slice(0, 10) : null, rates: x.rates }
          : null;
      }),
    ]);
    if (ecb || open) {
      // Central bank rates win wherever they exist; the open source fills the gaps.
      const rates: RateTable = { ...(open?.rates ?? {}), ...(ecb?.rates ?? {}), EUR: 1 };
      const sources = [ecb && "European Central Bank", open && "ExchangeRate-API"].filter(Boolean);
      memo = { at: Date.now(), body: { base: "EUR", date: ecb?.date ?? open?.date ?? null, rates, sources } };
    } else {
      console.error("exchange rates unavailable from both sources");
      if (!memo) return NextResponse.json({ error: "Exchange rates are unavailable right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json(memo.body, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=43200, stale-while-revalidate=86400" } });
}
