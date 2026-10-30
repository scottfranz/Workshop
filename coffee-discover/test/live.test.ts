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
      `\n  products=${feed.products.length} in_stock=${inStock.length} skipped=${feed.skipped?.length ?? 0}` +
      inStock.slice(0, 8).map((p) => `\n   + ${p.title} | ${p.price} ${p.currency} | ${p.url} | img=${p.image ? "yes" : "no"}`).join("") +
      `\n   skipped: ${JSON.stringify(feed.skipped?.slice(0, 15))}`,
    );
    expect(feed.products.length).toBeGreaterThan(0);
  }, 120_000);
});
