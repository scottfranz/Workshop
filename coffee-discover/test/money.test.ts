import { describe, expect, it } from "vitest";
import { buildItems, filterAndSort } from "@/lib/feed";
import { convert, formatMoney, type Rates } from "@/lib/money";
import { DEFAULT_PREFS, type SavedRoaster } from "@/lib/storage";
import type { Product } from "@/lib/scrapers/types";

const rates: Rates = { base: "EUR", date: "2026-10-30", rates: { EUR: 1, USD: 1.08, CAD: 1.56, JPY: 175.68 } };

describe("currency", () => {
  it("converts through the base currency", () => {
    expect(convert(30, "CAD", "USD", rates)).toBeCloseTo(20.77, 2);
    expect(convert(30, "CAD", "CAD", rates)).toBe(30);
    expect(convert(30, "XYZ", "USD", rates)).toBeNull();
  });

  it("formats converted prices as estimates and keeps the original", () => {
    const m = formatMoney(30, "CAD", "USD", rates);
    expect(m?.text).toMatch(/^≈ .*21$/);
    expect(m?.original).toMatch(/30/);
    expect(formatMoney(22, "USD", "USD", rates)).toEqual({ text: expect.stringMatching(/22/) });
    expect(formatMoney(22, "USD", null, rates)?.original).toBeUndefined();
    expect(formatMoney(0.97, "CAD", "USD", rates, 2)?.text).toMatch(/0\.67$/);
  });

  it("falls back to the store's currency when there is no rate", () => {
    expect(formatMoney(30, "CAD", "USD", null)).toEqual({ text: expect.stringMatching(/30/) });
  });

  it("sorts by price across currencies when given a converter", () => {
    const roaster: SavedRoaster = { id: "r", name: "R", platform: "shopify", feedUrl: "https://r.example", addedAt: 0 };
    const p = (id: string, price: number, currency: string): Product => ({ id, title: id, url: id, image: null, price, currency, available: true, publishedAt: null, description: null });
    const items = buildItems(roaster, [p("cad30", 30, "CAD"), p("usd25", 25, "USD"), p("jpy3000", 3000, "JPY")], {}, null, 0);
    const toCommon = (amount: number, currency: string | null) => convert(amount, currency ?? "USD", "USD", rates) ?? amount;
    const sorted = filterAndSort(items, { ...DEFAULT_PREFS, sort: "price-asc" }, { roasterId: null, query: "", hidden: new Set(), toCommon });
    // ¥3000 ≈ $18.44, CA$30 ≈ $20.77, $25.
    expect(sorted.map((i) => i.id)).toEqual(["jpy3000", "cad30", "usd25"]);
  });
});
