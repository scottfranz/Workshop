import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fx from "./fixtures";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => (host.endsWith(".evil") ? [{ address: "10.0.0.5" }] : [{ address: "93.184.216.34" }])),
}));

const { detectFeed, normalizeUrl } = await import("@/lib/scrapers");
const { assertPublicUrl, isPrivateAddress } = await import("@/lib/scrapers/safeFetch");

type Routes = Record<string, { status?: number; body: unknown; type?: string; location?: string }>;

function mockSite(routes: Routes) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: URL | string) => {
    const url = String(input);
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response("Not found", { status: 404, headers: { "content-type": "text/html" } });
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    const headers: Record<string, string> = { "content-type": r.type ?? (typeof r.body === "string" ? "text/html" : "application/json") };
    if (r.location) headers.location = r.location;
    return new Response(body, { status: r.status ?? 200, headers });
  }));
  return calls;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("detectFeed", () => {
  it("detects Shopify and picks up name + currency from meta.json", async () => {
    mockSite({
      "https://roaster.example/products.json?limit=250": { body: fx.shopifyProducts },
      "https://roaster.example/meta.json": { body: { name: "Roaster Co", currency: "USD" } },
    });
    const feed = await detectFeed("roaster.example/?utm_source=ig");
    expect(feed.source).toEqual({ platform: "shopify", feedUrl: "https://roaster.example" });
    expect(feed.siteName).toBe("Roaster Co");
    expect(feed.products).toHaveLength(2);
    expect(feed.skipped).toEqual(["Comandante C40 Grinder", "Digital Gift Card"]);
  });

  it("detects Big Cartel's array-shaped products.json", async () => {
    mockSite({
      "https://tiny.example/products.json?limit=250": { body: fx.bigCartelProducts },
      "https://tiny.example/products.json": { body: fx.bigCartelProducts },
      "https://tiny.example/store.json": { body: { name: "Tiny Roast", currency: { code: "USD" } } },
    });
    const feed = await detectFeed("https://tiny.example");
    expect(feed.source.platform).toBe("bigcartel");
    expect(feed.siteName).toBe("Tiny Roast");
  });

  it("detects WooCommerce via the public Store API", async () => {
    mockSite({
      "https://woo.example/wp-json/wc/store/v1/products?per_page=1": { body: fx.wooProducts.slice(0, 1) },
      "https://woo.example/wp-json/wc/store/v1/products?per_page=100&page=1&orderby=date&order=desc": { body: fx.wooProducts },
      "https://woo.example/wp-json/": { body: { name: "Woo Roasters" } },
    });
    const feed = await detectFeed("https://woo.example/product-category/green-coffee/");
    expect(feed.source).toEqual({ platform: "woocommerce", feedUrl: "https://woo.example/product-category/green-coffee" });
    expect(feed.products.map((p) => p.id)).toEqual(["41"]);
  });

  it("finds a Squarespace shop from the homepage navigation", async () => {
    mockSite({
      "https://little.example/": { body: fx.squarespaceHomeHtml },
      "https://little.example/shop?format=json": { body: fx.squarespaceLegacyPage },
    });
    const feed = await detectFeed("little.example");
    expect(feed.source).toEqual({ platform: "squarespace", feedUrl: "https://little.example/shop" });
    expect(feed.products[0].title).toBe("Burundi Kayanza");
  });

  it("falls back to JSON-LD and crawls listed product pages", async () => {
    mockSite({
      "https://riverbend.example/shop": { body: fx.jsonLdListingHtml },
      "https://riverbend.example/product/rwanda": { body: fx.jsonLdProductHtml("Rwanda", "21") },
      "https://riverbend.example/product/brazil": { body: fx.jsonLdProductHtml("Brazil", "16") },
    });
    const feed = await detectFeed("https://riverbend.example/shop");
    expect(feed.source.platform).toBe("jsonld");
    expect(feed.siteName).toBe("Riverbend Coffee");
    expect(feed.products.map((p) => p.title).sort()).toEqual(["Brazil", "Rwanda"]);
  });

  it("explains when nothing can be found", async () => {
    mockSite({ "https://empty.example/": { body: "<html><title>Hi</title></html>" } });
    await expect(detectFeed("empty.example")).rejects.toThrow(/couldn't find any coffees/i);
  });

  it("refuses redirects into private networks", async () => {
    mockSite({
      "https://roaster.example/products.json?limit=250": { status: 302, body: "", location: "http://169.254.169.254/latest" },
      "https://roaster.example/wp-json/wc/store/v1/products?per_page=1": { status: 302, body: "", location: "http://127.0.0.1/" },
      "https://roaster.example/": { status: 302, body: "", location: "http://10.1.2.3/" },
    });
    await expect(detectFeed("roaster.example")).rejects.toThrow(/public internet/);
  });
});

describe("resilience", () => {
  it("retries a Shopify store whose products.json hiccupped", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: URL | string) => {
      const url = String(input);
      if (url.startsWith("https://flaky.example/products.json")) {
        attempts++;
        return attempts <= 2
          ? new Response("slow down", { status: 429 })
          : new Response(JSON.stringify(fx.shopifyProducts), { headers: { "content-type": "application/json" } });
      }
      if (url === "https://flaky.example/") return new Response('<script src="//cdn.shopify.com/x.js"></script>', { headers: { "content-type": "text/html" } });
      return new Response("nope", { status: 404 });
    }));
    const feed = await detectFeed("flaky.example");
    expect(feed.source.platform).toBe("shopify");
    expect(feed.products).toHaveLength(2);
  });

  it("cleans bilingual titles in the final feed", async () => {
    mockSite({
      "https://jp.example/products.json?limit=250": { body: { products: [{ ...fx.shopifyProducts.products[0], title: "SCAJ - El Espejo. フィンカ・エル・エスペホ" }] } },
    });
    expect((await detectFeed("jp.example")).products[0].title).toBe("SCAJ - El Espejo");
  });
});

describe("url safety", () => {
  it.each(["127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"])(
    "%s is private", (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "172.32.0.1", "2606:4700::1111"])("%s is public", (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it("rejects internal hostnames and odd ports", async () => {
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toThrow();
    await expect(assertPublicUrl("https://shop.evil")).rejects.toThrow(/public internet/);
    await expect(assertPublicUrl("https://roaster.example:8080")).rejects.toThrow(/ports/);
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
  });

  it("normalises pasted links", () => {
    expect(normalizeUrl("  Roaster.example/collections/coffee/?utm_source=x#top ")).toBe("https://roaster.example/collections/coffee");
  });
});
