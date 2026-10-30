import { NextResponse } from "next/server";
import { PLATFORMS, detectFeed, fetchFeed, normalizeUrl } from "@/lib/scrapers";
import { FetchError } from "@/lib/scrapers/safeFetch";
import type { Platform, RoasterFeed } from "@/lib/scrapers/types";

// GET /api/roaster?url=<store link>                → detect platform + products
// GET /api/roaster?url=<feedUrl>&platform=shopify  → products for a known roaster
//
// Responses are public and identical for everyone, so the CDN caches them. That
// keeps load on roasters' sites low no matter how many people follow them.

export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_HEADER = "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";
const memo = new Map<string, { at: number; feed: RoasterFeed }>();
const MEMO_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawUrl = params.get("url");
  const platform = params.get("platform") as Platform | null;
  if (!rawUrl) return NextResponse.json({ error: "Add a link to a roaster's website." }, { status: 400 });
  if (platform && !PLATFORMS.includes(platform)) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });

  let url: string;
  try {
    url = normalizeUrl(rawUrl);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid web address." }, { status: 400 });
  }

  const key = `${platform ?? "detect"}|${url}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return NextResponse.json(hit.feed, { headers: { "Cache-Control": CACHE_HEADER } });

  try {
    const feed = platform ? await fetchFeed({ platform, feedUrl: url }) : await detectFeed(url);
    memo.set(key, { at: Date.now(), feed });
    if (memo.size > 500) memo.delete(memo.keys().next().value!);
    return NextResponse.json(feed, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (err) {
    const message = err instanceof FetchError ? err.message : "Something went wrong reading that store. Try again in a bit.";
    if (!(err instanceof FetchError)) console.error("roaster fetch failed", url, err);
    // Short cache on errors so a flaky store recovers quickly.
    return NextResponse.json({ error: message }, { status: 422, headers: { "Cache-Control": "public, s-maxage=120" } });
  }
}
