import { describe, expect, it } from "vitest";
import { buildItems, filterAndSort, markSeen, sizedImage } from "@/lib/feed";
import { DEFAULT_PREFS, decodeShare, encodeShare, hasShareLink, pruneSeen, sameRoasterUrl, type SavedRoaster, type SavedState } from "@/lib/storage";
import type { Product } from "@/lib/scrapers/types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 30);
const roaster: SavedRoaster = { id: "https://r.example", name: "R", platform: "woocommerce", feedUrl: "https://r.example", addedAt: NOW - 30 * DAY };
const product = (id: string, extra: Partial<Product> = {}): Product => ({
  id, title: id, url: `https://r.example/${id}`, image: null, price: 20, currency: "USD", available: true, publishedAt: null, description: null, ...extra,
});

describe("new-arrival logic", () => {
  it("treats the catalogue at follow time as not new, later arrivals as new", () => {
    const seen = { old: roaster.addedAt, fresh: NOW - 2 * DAY };
    const items = buildItems(roaster, [product("old"), product("fresh")], seen, NOW - 3 * DAY, NOW);
    expect(items.find((i) => i.id === "old")).toMatchObject({ isNew: false, sinceLastVisit: false });
    expect(items.find((i) => i.id === "fresh")).toMatchObject({ isNew: true, sinceLastVisit: true });
  });

  it("uses store publish dates when available, even right after following", () => {
    const justFollowed = { ...roaster, addedAt: NOW };
    const items = buildItems(justFollowed, [product("a", { publishedAt: new Date(NOW - 3 * DAY).toISOString() })], {}, null, NOW);
    expect(items[0].isNew).toBe(true);
  });

  it("stops calling things new after two weeks", () => {
    const items = buildItems(roaster, [product("x")], { x: NOW - 20 * DAY }, null, NOW);
    expect(items[0].isNew).toBe(false);
  });

  it("markSeen only records first sightings", () => {
    const seen = markSeen({}, "r", [product("a")], 1);
    expect(markSeen(seen, "r", [product("a")], 2)).toBe(seen);
    expect(markSeen(seen, "r", [product("a"), product("b")], 3).r).toEqual({ a: 1, b: 3 });
  });
});

describe("filterAndSort", () => {
  const items = buildItems(roaster, [
    product("cheap", { price: 12 }), product("sold", { available: false }), product("pricey", { price: 40 }),
  ], { cheap: NOW - DAY, sold: NOW, pricey: roaster.addedAt }, null, NOW);
  const opts = { roasterId: null, query: "", hidden: new Set<string>() };

  it("hides sold out by default and sorts newest first", () => {
    expect(filterAndSort(items, DEFAULT_PREFS, opts).map((i) => i.id)).toEqual(["cheap", "pricey"]);
  });
  it("sorts by price and respects hidden keys", () => {
    const prefs = { ...DEFAULT_PREFS, sort: "price-desc" as const };
    expect(filterAndSort(items, prefs, { ...opts, hidden: new Set(["https://r.example::sold"]) }).map((i) => i.id)).toEqual(["pricey", "cheap"]);
  });
});

describe("storage helpers", () => {
  it("makes short share links from roaster addresses", () => {
    const list = [{ ...roaster, name: "Café Señor" }];
    const list2 = [...list, { ...roaster, id: "https://hex.coffee/collections/coffee", feedUrl: "https://hex.coffee/collections/coffee" }];
    const link = encodeShare(list2);
    expect(link).toBe("r=r.example,hex.coffee/collections/coffee");
    expect(decodeShare("#" + link)).toEqual([{ url: "https://r.example" }, { url: "https://hex.coffee/collections/coffee" }]);
  });
  it("ignores malformed or unsafe share data", () => {
    expect(decodeShare("#follow=not-base64!!")).toEqual([]);
    expect(hasShareLink("#follow=not-base64!!")).toBe(true);
    expect(hasShareLink("#top")).toBe(false);
    const evil = btoa(JSON.stringify([["x", "shopify", "javascript:alert(1)"], ["y", "nope", "https://a.example"]]));
    expect(decodeShare("#follow=" + evil)).toEqual([]);
    expect(decodeShare("#r=javascript:alert(1),ftp.example")).toEqual([{ url: "https://ftp.example" }]);
  });
  it("still opens old long links, keeping names and platforms", () => {
    const legacy = btoa(JSON.stringify([["Regalia Coffee", "shopify", "https://regaliacoffee.com"], ["Hex", "shopify", "https://hex.coffee/collections/cofefve"]]))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShare("#follow=" + legacy)).toEqual([
      { url: "https://regaliacoffee.com", name: "Regalia Coffee", platform: "shopify" },
      { url: "https://hex.coffee/collections/cofefve", name: "Hex", platform: "shopify" },
    ]);
  });

  it("treats www, scheme, case and trailing slashes as the same roaster", () => {
    expect(sameRoasterUrl("https://www.Tandemcoffee.com/", "tandemcoffee.com")).toBe(true);
    expect(sameRoasterUrl("https://hex.coffee/collections/a", "https://hex.coffee/collections/b")).toBe(false);
  });

  it("prunes seen entries for removed roasters and old products", () => {
    const state: SavedState = {
      version: 1 as const, roasters: [roaster], hidden: ["gone::1", `${roaster.id}::2`], lastVisit: null, prevVisit: null, prefs: DEFAULT_PREFS,
      seen: { [roaster.id]: { keep: NOW - DAY, drop: NOW - 400 * DAY }, gone: { a: NOW } },
    };
    const pruned = pruneSeen(state, NOW);
    expect(pruned.seen).toEqual({ [roaster.id]: { keep: NOW - DAY } });
    expect(pruned.hidden).toEqual([`${roaster.id}::2`]);
  });
  it("requests smaller CDN images", () => {
    expect(sizedImage("https://cdn.shopify.com/s/files/a.jpg?v=1")).toBe("https://cdn.shopify.com/s/files/a.jpg?v=1&width=600");
  });
});

describe("roaster colors", () => {
  it("hands out unused colors first, then the least-used", async () => {
    const { pickColor, withColors, ROASTER_COLORS } = await import("@/lib/storage");
    expect(pickColor([])).toBe(ROASTER_COLORS[0]);
    expect(pickColor([ROASTER_COLORS[0]])).toBe(ROASTER_COLORS[1]);
    const colored = withColors<{ color?: string }>([{ color: ROASTER_COLORS[1] }, {}, {}]);
    expect(colored.map((r) => r.color)).toEqual([ROASTER_COLORS[1], ROASTER_COLORS[0], ROASTER_COLORS[2]]);
    expect(new Set(withColors(Array.from({ length: 15 }, (): { color?: string } => ({}))).map((r) => r.color)).size).toBe(15);
  });
});

describe("visits", () => {
  it("only rolls the previous visit forward after a gap", async () => {
    const { beginVisit, emptyState } = await import("@/lib/storage");
    const first = beginVisit(emptyState(), 1_000);
    expect(first).toMatchObject({ lastVisit: 1_000, prevVisit: null });
    expect(beginVisit(first, 1_000 + 60_000)).toBe(first);
    expect(beginVisit(first, 1_000 + 2 * 60 * 60 * 1000)).toMatchObject({ prevVisit: 1_000 });
  });
});

describe("search", () => {
  const items = buildItems(roaster, [
    product("a", { title: "Kenya Kiambu", description: "Blackcurrant, tomato", searchText: "coffee washed sl28 grown at 1,800 masl" }),
    product("b", { title: "Ethiopia Guji", description: "Peach, jasmine", searchText: "coffee natural heirloom" }),
    product("c", { title: "Washed Colombia", description: "Caramel" }),
  ], {}, null, NOW);
  const find = (q: string) => filterAndSort(items, DEFAULT_PREFS, { roasterId: null, query: q, hidden: new Set() }).map((i) => i.id).sort();

  it("matches process details that only appear in the full description", () => {
    expect(find("washed")).toEqual(["a", "c"]);
  });
  it("requires every word, in any order", () => {
    expect(find("washed kenya")).toEqual(["a"]);
    expect(find("kenya natural")).toEqual([]);
  });
});

describe("price per cup", () => {
  it("divides the bag price by the cups in it", async () => {
    const { pricePerCup } = await import("@/lib/feed");
    expect(pricePerCup({ price: 22.5, size: { grams: 340, label: "12 oz" } }, 15)).toBeCloseTo(0.993, 3);
    expect(pricePerCup({ price: 28, size: { grams: 250, label: "250 g" } }, 20)).toBeCloseTo(2.24, 2);
    expect(pricePerCup({ price: 22, size: null }, 15)).toBeNull();
    expect(pricePerCup({ price: null, size: { grams: 250, label: "250 g" } }, 15)).toBeNull();
  });

  it("sorts cheapest per cup first, unknown sizes last", () => {
    const items = buildItems(roaster, [
      product("pricey-small", { price: 30, size: { grams: 250, label: "250 g" } }),   // $1.80/cup
      product("cheap-big", { price: 40, size: { grams: 1000, label: "1 kg" } }),      // $0.60/cup
      product("no-size", { price: 10 }),
    ], {}, null, NOW);
    const sorted = filterAndSort(items, { ...DEFAULT_PREFS, sort: "per-cup" }, { roasterId: null, query: "", hidden: new Set() });
    expect(sorted.map((i) => i.id)).toEqual(["cheap-big", "pricey-small", "no-size"]);
  });
});
