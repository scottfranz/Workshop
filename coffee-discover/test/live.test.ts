// Hits real roaster websites. Not part of `npm test`; run with `npm run test:live`.
// DNS is stubbed to a public address so this works behind sandbox proxies that
// resolve names themselves; every other part of the fetch path is real.
import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34" }]) }));
const { detectFeed } = await import("@/lib/scrapers");

const urls = (process.env.LIVE_URLS ?? "").split(",").filter(Boolean);

describe.skipIf(urls.length === 0)("live stores", () => {
  it.each(urls)("%s", async (url) => {
    const feed = await detectFeed(url);
    const inStock = feed.products.filter((p) => p.available);
    console.log(
      `\n### ${url}\n  platform=${feed.source.platform} feedUrl=${feed.source.feedUrl} name=${JSON.stringify(feed.siteName)}` +
      `\n  products=${feed.products.length} in_stock=${inStock.length} with_size=${inStock.filter((p) => p.size).length} skipped=${feed.skipped?.length ?? 0}` +
      inStock.slice(0, Number(process.env.LIVE_SHOW ?? 8)).map((p) => `\n   + ${p.title} | ${p.price} ${p.currency} | size=${p.size?.label ?? "?"} | ${p.url} | img=${p.image ? "yes" : "no"}`).join("") +
      `\n   skipped: ${JSON.stringify(feed.skipped?.slice(0, Number(process.env.LIVE_SKIPPED ?? 15)))}`,
    );
    const q = process.env.LIVE_SEARCH?.toLowerCase();
    if (q) {
      const inTitle = inStock.filter((p) => p.title.toLowerCase().includes(q)).length;
      const anywhere = inStock.filter((p) => `${p.title} ${p.description ?? ""} ${p.searchText ?? ""}`.toLowerCase().includes(q)).length;
      console.log(`  search "${q}": ${inTitle} in title only → ${anywhere} with full search`);
    }
    expect(feed.products.length).toBeGreaterThan(0);
  }, 120_000);
});
