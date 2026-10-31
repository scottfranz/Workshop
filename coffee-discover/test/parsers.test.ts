import { describe, expect, it } from "vitest";
import { parseBigCartel } from "@/lib/scrapers/bigcartel";
import { looksLikeCoffee } from "@/lib/scrapers/filter";
import { productLinksFromHtml, productsFromHtml, siteNameFromHtml } from "@/lib/scrapers/jsonld";
import { parseShopify, shopifyProductsEndpoint } from "@/lib/scrapers/shopify";
import { isSquarespaceProductPage, parseSquarespace } from "@/lib/scrapers/squarespace";
import { parseWooCommerce, wooCategoryFromUrl } from "@/lib/scrapers/woocommerce";
import * as fx from "./fixtures";

describe("shopify", () => {
  it("keeps coffee, drops gear and gift cards, normalises fields", () => {
    const products = parseShopify(fx.shopifyProducts, "https://roaster.example/collections/coffee", "USD");
    expect(products.map((p) => p.title)).toEqual(["Ethiopia Guji Hambela", "Colombia Decaf"]);
    const [guji, decaf] = products;
    expect(guji).toMatchObject({
      id: "7001",
      url: "https://roaster.example/products/ethiopia-guji-hambela",
      image: "https://cdn.shopify.com/s/files/1/guji.jpg",
      price: 22, // the 19.50 size is sold out
      currency: "USD",
      available: true,
      publishedAt: "2026-10-20T13:00:00.000Z",
      description: "peach, jasmine & bergamot",
    });
    expect(decaf.available).toBe(false);
  });

  it("builds collection-aware endpoints", () => {
    expect(shopifyProductsEndpoint("https://r.example")).toBe("https://r.example/products.json");
    expect(shopifyProductsEndpoint("https://r.example/collections/single-origin?page=2")).toBe(
      "https://r.example/collections/single-origin/products.json",
    );
  });
});

describe("woocommerce", () => {
  it("parses Store API prices in minor units and decodes entities", () => {
    const products = parseWooCommerce(fx.wooProducts, "https://showroomcoffee.com");
    expect(products.map((p) => p.title)).toEqual(["Kenya Kiambu AA – Natural", "House Espresso"]);
    expect(products[0]).toMatchObject({ price: 12.5, currency: "USD", available: true, description: "blackcurrant and tomato" });
    expect(products[1].available).toBe(false);
  });

  it("narrows to a category from a product-category link", () => {
    const url = "https://showroomcoffee.com/product-category/green-coffee/";
    expect(wooCategoryFromUrl(url)).toBe("green-coffee");
    expect(parseWooCommerce(fx.wooProducts, url).map((p) => p.id)).toEqual(["41"]);
  });
});

describe("squarespace", () => {
  it("parses legacy structuredContent variants (prices in cents)", () => {
    expect(isSquarespaceProductPage(fx.squarespaceLegacyPage)).toBe(true);
    const products = parseSquarespace(fx.squarespaceLegacyPage, "https://little.example/shop");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      title: "Burundi Kayanza",
      url: "https://little.example/shop/p/burundi-kayanza",
      price: 21,
      currency: "USD",
      available: true,
      description: "red grape, hibiscus and cane sugar",
    });
  });

  it("parses 7.1 priceMoney variants, sale prices and stock", () => {
    const [peru] = parseSquarespace(fx.squarespace71Page, "https://modern.example/store");
    // The $20 sale size is out of stock; the in-stock size is $40.
    expect(peru).toMatchObject({ price: 40, currency: "CAD", available: true, publishedAt: new Date(1760000000000).toISOString() });
  });

  it("does not treat a regular page as a shop", () => {
    expect(isSquarespaceProductPage({ collection: { typeName: "page" }, items: [{ title: "About" }] })).toBe(false);
  });
});

describe("big cartel", () => {
  it("parses products, options and sold-out state", () => {
    const products = parseBigCartel(fx.bigCartelProducts, "https://tiny.bigcartel.com", "USD");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      title: "Honduras Santa Barbara", url: "https://tiny.bigcartel.com/product/honduras-santa-barbara", price: 17, available: true,
    });
  });
});

describe("json-ld", () => {
  it("collects ItemList links when the listing has no inline products", () => {
    const { products, listUrls } = productsFromHtml(fx.jsonLdListingHtml, "https://riverbend.example/shop");
    expect(products).toEqual([]);
    expect(listUrls).toEqual(["https://riverbend.example/product/rwanda", "https://riverbend.example/product/brazil"]);
    expect(siteNameFromHtml(fx.jsonLdListingHtml)).toBe("Riverbend Coffee");
  });

  it("reads Product nodes inside @graph with AggregateOffer", () => {
    const { products } = productsFromHtml(fx.jsonLdProductHtml("Rwanda Nyamasheke", "21.00"), "https://riverbend.example/product/rwanda");
    expect(products[0]).toMatchObject({
      title: "Rwanda Nyamasheke", price: 21, currency: "USD", available: true,
      image: "https://riverbend.example/img/Rwanda%20Nyamasheke.jpg", description: "plum & cocoa",
    });
  });

  it("marks OutOfStock offers unavailable", () => {
    const { products } = productsFromHtml(fx.jsonLdProductHtml("Brazil", "15", "https://schema.org/OutOfStock"), "https://r.example/p/b");
    expect(products[0].available).toBe(false);
  });

  it("finds same-site product links as a last resort", () => {
    const html = `<a href="/product/one">1</a><a href="https://other.example/product/x">x</a><a href="/about">a</a><a href="/shop/p/two?v=1">2</a>`;
    expect(productLinksFromHtml(html, "https://r.example/shop")).toEqual(["https://r.example/product/one", "https://r.example/shop/p/two"]);
  });

  it("falls back to the last <title> segment for the site name", () => {
    expect(siteNameFromHtml("<title>Coffee — Onyx Coffee Lab</title>")).toBe("Onyx Coffee Lab");
  });
});

describe("coffee filter", () => {
  const coffee = (title: string, extra: Partial<Parameters<typeof looksLikeCoffee>[0] & object> = {}) => looksLikeCoffee({ title, ...extra });

  it.each([
    // the kinds of things that were slipping through
    ["Aquacode Water Minerals", {}],
    ["Aquacode", { options: ["12 pack"] }],
    ["The World Atlas of Coffee", { productType: "Books" }],
    ["Craft Coffee: A Manual", { productType: "Book" }],
    ["Normcore Puck Screen 58.5mm", { productType: "" }],
    ["Third Wave Water Classic Profile", {}],
    ["Espresso Cup", {}],
    ["Mystery Item", { options: ["Small", "Large"] }],
    ["Hario V60 Dripper", {}],
    ["Logo Tee", {}],
    ["Coffee Subscription", {}],
    ["Ceramic Mug", {}],
    ["Barista Toolkit", { productType: "Tools", description: "Great for espresso" }],
    // found on live stores
    ["1ZPRESSO - Q", { productType: "Grinder" }],
    ["Ode Brew Grinder Gen 2", { productType: "Coffee Equipment" }],
    ["Rainbow Hopper Easy Sub", { options: ["12oz"] }],
    ["Monarch - Cometeer", { productType: "Coffee" }],
    ["Salted Mocha RTD", {}],
    ["Forhåndsbetalt gaveabonnement", { options: ["Filter / 1 pose"] }],
    ["Gavekort", {}],
    ["Tasse LUCID Blanche – Taille au choix", {}],
    ["FM Grinders – Moulin Yoda 120", {}],
    ["Bouilloire Stagg – Noir Mat", {}],
    ["Ethiopia Guji", { productType: "Matériel" }],
    ["Kaffeabonnement Ethiopia", { productType: "Coffee", options: ["250g"] }],
    ["Panama Kotowa Las Brujas Washed - Cafe Only", { productType: "Coffee" }],
    ["Smiley Coffee Ludlow Blend - 10oz Case Pack", { productType: "Coffee" }],
    ["Curio", { productType: "Coffee", tags: ["coffee", "type:collaboration", "white-label"] }],
    ["Costa Rica Volcan Azul SL28", { productType: "Coffee", tags: ["coffee", "utility-sku"] }],
    ["Ethiopia Guji", { productType: "Coffee", vendor: "Onyx Coffee Lab (WHOLESALE)" }],
    ["70% Tanzania | Dark & Lemon Crunch", { productType: "Chocolate", tags: ["chocolate"] }],
    ["Dark Chocolate Covered Espresso Beans", { productType: "Terroir" }],
    ["Golden Milk Latte Powder", {}],
    ["Instant Geometry", { productType: "Coffee" }],
    ["Decaf Espresso - Peru Norandino - Sample Only", {}],
  ])("drops %s", (title, extra) => {
    expect(coffee(title, extra)).toBe(false);
  });

  it.each([
    ["Ethiopia Yirgacheffe", {}],
    ["Toffee Bomb Espresso Blend", {}],
    ["Pink Bourbon", {}],
    ["Colombia Cup of Excellence #3", {}],
    ["Ethiopia Guji - Filter Roast", {}],
    ["Capucas Honduras", {}],
    ["Big Trouble", { options: ["Size", "12 oz", "5 lb"] }],
    ["Hambela", { description: "Tasting notes: peach, jasmine. Grown at 2,100 masl." }],
    ["SCAJ - El Espejo", { options: ["100g"] }],
    ["Holiday", { productType: "Coffee" }],
    ["Whole Bean Sampler", {}],
    ["Kenya Kiambu", { productType: "Coffee", tags: ["coffee", "wholesale", "single origin"] }],
    ["Finca la Riviera [Pink Bourbon]", { productType: "Cafés", options: ["200g"] }],
    ["Gicherori AA [Washed]", { options: ["200g", "1kg"] }],
    ["Geometry", { productType: "Coffee", tags: ["coffee", "type:blend", "wholesale-coffee"], options: ["10oz", "10oz Case Pack (6)"] }],
  ])("keeps %s", (title, extra) => {
    expect(coffee(title, extra)).toBe(true);
  });

  it("trusts an explicit coffee product type but not a gear one", () => {
    expect(coffee("Server Room", { productType: "Coffee" })).toBe(true);
    expect(coffee("Ethiopia", { productType: "Merchandise" })).toBe(false);
  });
});

describe("shopify sitemap", () => {
  it("leaves out unlisted products only when the name doesn't say coffee", () => {
    const base = fx.shopifyProducts.products[0];
    const data = { products: [
      { ...base, id: 1, handle: "vinka", title: "Vinka Washed Sidra" },      // hidden from search, but clearly coffee
      { ...base, id: 2, handle: "likes-you", title: "Onyx Likes You" },      // private partner product
      { ...base, id: 3, handle: "io-e-23", title: "IO-E-23" },               // internal code
      { ...base, id: 4, handle: "listed", title: "Big Trouble" },            // in the sitemap: kept
    ] };
    const products = parseShopify(data, "https://r.example", "USD", new Set(["listed"]));
    expect(products.map((p) => p.title)).toEqual(["Vinka Washed Sidra", "Big Trouble"]);
  });
  it("filters nothing when the sitemap couldn't be read", () => {
    expect(parseShopify(fx.shopifyProducts, "https://r.example", "USD", null)).toHaveLength(2);
  });
});

describe("bag pricing", () => {
  it("ignores sample sizes when a real bag size exists", async () => {
    const { isSampleSize } = await import("@/lib/scrapers/text");
    expect(["40g", "2 oz", "Sample", "50 grams"].map(isSampleSize)).toEqual([true, true, true, true]);
    expect(["250g", "12oz", "1kg", "5 lb", "Default Title"].map(isSampleSize)).toEqual([false, false, false, false, false]);
    const data = { products: [{ ...fx.shopifyProducts.products[0], variants: [
      { title: "250g", price: "28.00", available: true }, { title: "40g", price: "7.00", available: true }, { title: "1kg", price: "98.00", available: true },
    ] }] };
    expect(parseShopify(data, "https://r.example")[0].price).toBe(28);
  });

  it("prices from in-stock sizes when some are sold out", () => {
    const data = { products: [{ ...fx.shopifyProducts.products[0], variants: [
      { title: "250g", price: "20.00", available: false }, { title: "1kg", price: "70.00", available: true },
    ] }] };
    expect(parseShopify(data, "https://r.example")[0].price).toBe(70);
  });
});

describe("json-ld aggregate availability", () => {
  it("is unavailable when every child offer is out of stock", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Kenya","offers":{"@type":"AggregateOffer","priceCurrency":"USD","lowPrice":"20",
      "offers":[{"@type":"Offer","price":"20","availability":"OutOfStock"},{"@type":"Offer","price":"35","availability":"https://schema.org/SoldOut"}]}}</script>`;
    const { products } = productsFromHtml(html, "https://r.example/p/kenya");
    expect(products[0]).toMatchObject({ available: false, currency: "USD", price: 20 });
  });
});

describe("bilingual text", () => {
  it.each([
    ["SCAJ - El Espejo. フィンカ・エル・エスペホ", "SCAJ - El Espejo"],
    ["SCAJ - Fabio Caballero COE Washed Gesha ラ•サルバヘ. ウォッシュド. ゲシャ", "SCAJ - Fabio Caballero COE Washed Gesha"],
    ["SCAJ - Red Honey Sidra. ヴィンカ　レッドハニー　シドラ", "SCAJ - Red Honey Sidra"],
    ["mulled wine, pineapple juice, nectarine テイスティングノート: マルドワイン、パイナップル", "mulled wine, pineapple juice, nectarine"],
    ["エチオピア グジ", "エチオピア グジ"],
    ["Ethiopia Guji", "Ethiopia Guji"],
  ])("%s", async (input, expected) => {
    const { preferLatin } = await import("@/lib/scrapers/text");
    expect(preferLatin(input)).toBe(expected);
  });
});

describe("other-market listings", () => {
  const p = (id: string, title: string) => ({
    id, title, url: `https://r.example/${id}`, image: null, price: 20, currency: "USD", available: true, publishedAt: null, description: null,
  });

  it("drops CJK-titled listings from a mostly English catalogue", async () => {
    const { dropOtherMarketListings } = await import("@/lib/scrapers");
    const out = dropOtherMarketListings([
      p("1", "Ethiopia Guji"),
      p("2", "SCAJ - El Espejo. フィンカ・エル・エスペホ"),
      p("3", "Kenya Kiambu"),
      p("4", "SCAJ - Vinka Washed Sidra ヴィンカ. ウォッシュド. シドラ"),
      p("5", "Colombia Huila"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["1", "3", "5"]);
  });

  it("leaves mostly-Japanese roasters alone", async () => {
    const { dropOtherMarketListings } = await import("@/lib/scrapers");
    const list = [p("1", "エチオピア グジ"), p("2", "Kenya ケニア"), p("3", "Seasonal Blend")];
    expect(dropOtherMarketListings(list)).toBe(list);
  });
});

describe("search text", () => {
  it("captures process words from deep in the description", async () => {
    const { searchTextFor } = await import("@/lib/scrapers/filter");
    const long = "Tasting notes: peach and jasmine. " + "Lorem ipsum about the farm. ".repeat(40) + "This lot is Washed and dried on raised beds.";
    const text = searchTextFor({ title: "Hambela", productType: "Coffee", tags: ["Single Origin"], description: long, options: ["12oz"] });
    expect(text).toContain("washed");
    expect(text).toContain("single origin");
    expect(text).toContain("12oz");
    expect(text.length).toBeLessThan(700);
  });
});

describe("bag size", () => {
  it.each([
    ["250g", 250, "250 g"], ["12oz", 340, "12 oz"], ["2lbs", 907, "2 lb"], ["1kg / Whole Bean", 1000, "1 kg"],
    ["200G", 200, "200 g"], ["8oz / Decaf", 227, "8 oz"], ["2.5kg", 2500, "2.5 kg"], ["10 ounces", 283, "10 oz"],
    ["250gms / Whole Bean", 250, "250 g"], ["500gm", 500, "500 g"], ["1kgs", 1000, "1 kg"], ["250 grms", 250, "250 g"],
  ])("%s → %ig", async (label, grams, nice) => {
    const { parseBagSize } = await import("@/lib/scrapers/text");
    expect(parseBagSize(label)).toEqual({ grams, label: nice });
  });

  it.each(["Default Title", "58mm", "Whole Bean", "Pack of 6", "5g", "Natural"])("%s has no bag size", async (label) => {
    const { parseBagSize } = await import("@/lib/scrapers/text");
    expect(parseBagSize(label)).toBeNull();
  });

  it("prices and sizes the same bag: in stock, not a sample, cheapest", async () => {
    const { pickBag } = await import("@/lib/scrapers/text");
    expect(pickBag([
      { price: "7.00", label: "40g" }, { price: "28.00", label: "250g" }, { price: "98.00", label: "1kg" }, { price: "20", label: "200g", available: false },
    ])).toEqual({ price: 28, size: { grams: 250, label: "250 g" } });
    expect(pickBag([{ price: "18", label: "Default Title" }], "Kenya Kiambu 12oz")).toEqual({ price: 18, size: { grams: 340, label: "12 oz" } });
  });

  it("is read from Shopify variants", () => {
    const data = { products: [{ ...fx.shopifyProducts.products[0], variants: [
      { title: "250g", price: "28.00", available: true }, { title: "40g", price: "7.00", available: true },
    ] }] };
    expect(parseShopify(data, "https://r.example")[0]).toMatchObject({ price: 28, size: { grams: 250, label: "250 g" } });
  });
});

describe("retail vs bulk stock", () => {
  it("treats a coffee as sold out when only bulk sizes remain", async () => {
    const { retailInStock } = await import("@/lib/scrapers/text");
    // Sweet Bloom's Hirwa: 10 oz sold out, 2 lb "available", 5 lb sold out.
    expect(retailInStock([{ label: "10oz Whole Bean", available: false }, { label: "2lb Whole Bean", available: true }, { label: "5lb Whole Bean", available: false }])).toBe(false);
    expect(retailInStock([{ label: "10 oz", available: true }, { label: "5 lb", available: false }])).toBe(true);
    // Green coffee sold only in bulk: judged on its own sizes.
    expect(retailInStock([{ label: "2 lb", available: false }, { label: "10 lb", available: true }])).toBe(true);
    // No sizes at all: any available option counts.
    expect(retailInStock([{ label: "Default Title", available: true }])).toBe(true);
    expect(retailInStock([])).toBe(true);
  });

  it("is applied to Shopify products", () => {
    const data = { products: [{ ...fx.shopifyProducts.products[0], variants: [
      { title: "10oz Whole Bean", price: "20.25", available: false }, { title: "2lb Whole Bean", price: "58.00", available: true },
    ] }] };
    expect(parseShopify(data, "https://r.example")[0].available).toBe(false);
  });
});
