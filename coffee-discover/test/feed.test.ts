import { describe, expect, it } from "vitest";
import { buildItems, filterAndSort, markSeen, sizedImage } from "@/lib/feed";
import { DEFAULT_PREFS, decodeShare, encodeShare, pruneSeen, type SavedRoaster, type SavedState } from "@/lib/storage";
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
  it("round-trips share links, including unicode names", () => {
    const list = [{ ...roaster, name: "Café Señor" }];
    expect(decodeShare(encodeShare(list))).toEqual([{ id: roaster.feedUrl, name: "Café Señor", platform: "woocommerce", feedUrl: roaster.feedUrl }]);
  });
  it("ignores malformed or unsafe share data", () => {
    expect(decodeShare("not-base64!!")).toEqual([]);
    const evil = btoa(JSON.stringify([["x", "shopify", "javascript:alert(1)"], ["y", "nope", "https://a.example"]]));
    expect(decodeShare(evil)).toEqual([]);
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
