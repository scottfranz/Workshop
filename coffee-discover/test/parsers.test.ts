import { describe, expect, it } from "vitest";
import { parseBigCartel } from "@/lib/scrapers/bigcartel";
import { looksLikeCoffee } from "@/lib/scrapers/filter";
import { productLinksFromHtml, productsFromHtml, siteNameFromHtml } from "@/lib/scrapers/jsonld";
import { isPrivateLabel, parseShopify, shopifyProductsEndpoint } from "@/lib/scrapers/shopify";
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
    ["Non-alcoholic German Bock", {}],
    ["Mocktails - Espresso Martini", {}],
    ["**LOCAL ONLY** Oatside Barista Blend (case)", {}],
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
    ["Bekele Honey, 1kg", { productType: "Coffee", tags: ["custom-badge:Wholesale Exclusive"] }],
    ["Iced Coffee - 2.5 Kilos", { productType: "Coffee", tags: ["b2bonly"] }],
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
    ["House Blend", { productType: "Coffee", tags: ["b2b"], options: ["10oz (285g)", "5lb (2270g)"] }],
    ["Milkbread", { productType: "Coffee", tags: ["All Coffee", "Blend", "Wholesale"], options: ["10oz", "5lbs"] }],
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

describe("bulk-only products", () => {
  const p = (id: string, grams: number | null) => ({
    id, title: id, url: id, image: null, price: 20, currency: "USD", available: true, publishedAt: null, description: null,
    size: grams ? { grams, label: `${grams} g` } : null,
  });
  it("drops bulk-only items from a roaster that mostly sells regular bags", async () => {
    const { dropBulkOnly } = await import("@/lib/scrapers");
    expect(dropBulkOnly([p("a", 250), p("b", 300), p("tin", 4000), p("kilo", 1000), p("set", null)]).map((x) => x.id)).toEqual(["a", "b", "set"]);
  });
  it("leaves roasters that mostly sell in bulk alone (green coffee)", async () => {
    const { dropBulkOnly } = await import("@/lib/scrapers");
    const green = [p("x", 907), p("y", 4536), p("z", 250)];
    expect(dropBulkOnly(green)).toBe(green);
  });
});

describe("wholesale twins", () => {
  const p = (id: string, title: string, price: number, grams = 283) => ({
    id, title, url: id, image: null, price, currency: "USD", available: true, publishedAt: null, description: null, size: { grams, label: `${grams} g` },
  });
  it("drops the cheaper same-named copy (Hex's wholesale listings)", async () => {
    const { dropWholesaleTwins } = await import("@/lib/scrapers");
    const out = dropWholesaleTwins([p("r", "Gachatha • Washed", 26), p("w", "Gachatha  •  washed", 14.75), p("solo", "Function", 19)]);
    expect(out.map((x) => x.id)).toEqual(["r", "solo"]);
  });

  it("drops the rest of a wholesale-only vendor's catalogue too", async () => {
    const { dropWholesaleTwins } = await import("@/lib/scrapers");
    const v = (x: ReturnType<typeof p>, vendor: string) => ({ ...x, vendor });
    const out = dropWholesaleTwins([
      v(p("r1", "Gachatha", 26), "HEX Coffee"), v(p("w1", "Gachatha", 14.75), "HEX Coffee Roasters"),
      v(p("r2", "Function", 19), "HEX Coffee"), v(p("w2", "Function", 11.25), "HEX Coffee Roasters"),
      v(p("w3", "Milkbread", 10.25), "HEX Coffee Roasters"),   // wholesale-only, no retail twin
      v(p("r3", "Form", 19), "HEX Coffee"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["r1", "r2", "r3"]);
  });
  it("keeps same-named listings priced alike, or compares per gram", async () => {
    const { dropWholesaleTwins } = await import("@/lib/scrapers");
    const roasts = [p("f", "Volcan Azul", 22), p("e", "Volcan Azul", 21)];
    expect(dropWholesaleTwins(roasts)).toBe(roasts);
    // Different bag sizes aren't twins: a 1 kg bag is normally cheaper per gram.
    const sizes = [p("small", "Kenya", 22, 250), p("big", "Kenya", 70, 1000)];
    expect(dropWholesaleTwins(sizes)).toBe(sizes);
  });
});

describe("labelled sales channels", () => {
  const p = (id: string, channel?: "retail" | "wholesale") => ({
    id, title: id, url: id, image: null, price: 20, currency: "USD", available: true, publishedAt: null, description: null, channel,
  });
  it("drops wholesale listings when the store also labels retail ones (Blendin)", async () => {
    const { dropWholesaleChannel } = await import("@/lib/scrapers");
    expect(dropWholesaleChannel([p("r", "retail"), p("w", "wholesale"), p("haro-wachu", "wholesale"), p("collab")]).map((x) => x.id)).toEqual(["r", "collab"]);
  });
  it("ignores a wholesale label when nothing is labelled retail (Sweet Bloom)", async () => {
    const { dropWholesaleChannel } = await import("@/lib/scrapers");
    const list = [p("a", "wholesale"), p("b", "wholesale")];
    expect(dropWholesaleChannel(list)).toBe(list);
  });
});

describe("roast twins", () => {
  const p = (id: string, title: string, url: string) => ({ id, title, url, image: null, price: 16, currency: "EUR", available: true, publishedAt: null, description: null });
  it("adds Espresso / Filter from the address when names collide", async () => {
    const { labelRoastTwins } = await import("@/lib/scrapers");
    const out = labelRoastTwins([
      p("a", "Colombia - Chapata", "https://fathers.cz/en/coffee/espresso/colombia-chapata-espresso"),
      p("b", "Colombia – Chapata", "https://fathers.cz/en/coffee/filter/colombia-chapata"),
      p("c", "Kenya - Karatina AB", "https://fathers.cz/en/coffee/filter/karatina"),
    ]);
    expect(out.map((x) => x.title)).toEqual(["Colombia - Chapata (Espresso)", "Colombia – Chapata (Filter)", "Kenya - Karatina AB"]);
  });
});

describe("generic crawler", () => {
  it("follows /coffee/<category>/<name> product links and skips blog posts", async () => {
    const { productLinksFromHtml, listingLinks } = await import("@/lib/scrapers/jsonld");
    const html = `<a href="/en/coffee">All</a><a href="/en/coffee/espresso">Espresso</a><a href="/en/coffee/espresso/ethiopia-chelbesa">x</a>
      <a href="/en/blog/a-new-home-for-coffee">blog</a><a href="/en/coffee-subscription">sub</a><a href="https://other.example/coffee/a/b">ext</a>`;
    expect(productLinksFromHtml(html, "https://fathers.example/en")).toEqual([
      "https://fathers.example/en/coffee/espresso", "https://fathers.example/en/coffee/espresso/ethiopia-chelbesa",
    ]);
    expect(listingLinks(html, "https://fathers.example/en")).toEqual(["https://fathers.example/en/coffee"]);
  });

  it("prices a ProductGroup from its in-stock retail size", async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "ProductGroup", name: "Ethiopia - Chelbesa", url: "https://fathers.example/en/coffee/espresso/chelbesa", description: "Washed.",
      hasVariant: [
        { "@type": "Product", name: "Ethiopia - Chelbesa", weight: { value: 250, unitCode: "GRM" }, offers: { price: 17.36, priceCurrency: "EUR", availability: "https://schema.org/InStock" } },
        { "@type": "Product", name: "Ethiopia - Chelbesa", weight: { value: 1000, unitCode: "GRM" }, offers: { price: 60.38, priceCurrency: "EUR", availability: "https://schema.org/InStock" } },
        { "@type": "Product", name: "Ethiopia - Chelbesa", weight: { value: 2000, unitCode: "GRM" }, offers: { price: 120.76, priceCurrency: "EUR", availability: "https://schema.org/OutOfStock" } },
      ] })}</script>`;
    const { products } = productsFromHtml(html, "https://fathers.example/en/coffee/espresso/chelbesa");
    expect(products[0]).toMatchObject({ price: 17.36, currency: "EUR", size: { grams: 250, label: "250 g" }, available: true });
  });
});

describe("bag choice: case packs and archived products", () => {
  it("picks the cheapest full-size bag", async () => {
    const { pickBag } = await import("@/lib/scrapers/text");
    expect(pickBag([{ label: "40g", price: "7.00" }, { label: "250g", price: "28.00" }, { label: "1kg", price: "98.00" }]).price).toBe(28);
    expect(pickBag([{ label: "10 oz", price: "21.50" }, { label: "2 lb", price: "56.50" }]).price).toBe(21.5);
  });
  it("ignores case packs when choosing the bag (Onyx)", async () => {
    const { pickBag, retailInStock } = await import("@/lib/scrapers/text");
    const sizes = [
      { label: "2oz", price: "6.00" }, { label: "10oz", price: "22.50" }, { label: "2lbs", price: "59.50" },
      { label: "5lbs", price: "124.00" }, { label: "10oz Case Pack (6)", price: "120.00" }, { label: "5lbs Case Pack (8)", price: "960.00" },
    ];
    expect(pickBag(sizes)).toEqual({ price: 22.5, size: { grams: 283, label: "10 oz" } });
    expect(retailInStock(sizes.map((s) => ({ ...s, available: true })))).toBe(true);
  });
  it("treats Archived Shopify products as sold out", () => {
    const data = { products: [{ ...fx.shopifyProducts.products[0], tags: ["Archived", "Reserve Lot"] }] };
    expect(parseShopify(data, "https://r.example")[0].available).toBe(false);
  });
});

describe("Hydrogen storefronts (sizes the site actually offers)", () => {
  // Remix's turbo-stream: a flat array, objects as {"_<key index>": <value index>}.
  function encode(value: unknown): string {
    const flat: unknown[] = [];
    const put = (v: unknown): number => {
      const i = flat.length;
      flat.push(null);
      if (Array.isArray(v)) flat[i] = v.map(put);
      else if (v && typeof v === "object") {
        const o: Record<string, number> = {};
        for (const [k, val] of Object.entries(v)) { const key = put(k); o[`_${key}`] = val === null ? -5 : put(val); }
        flat[i] = o;
      } else flat[i] = v;
      return i;
    };
    put(value);
    const chunk = JSON.stringify(JSON.stringify(flat) + "\n");
    return `<script>window.__reactRouterContext.streamController.enqueue(${chunk});</script><img src="https://cdn.shopify.com/x.png">`;
  }
  const page = encode({
    loaderData: {
      "routes/_page.collections.$handle": {
        collection: { products: { nodes: [
          { id: "gid://shopify/Product/1", handle: "agaro", title: "Agaro", variants: { nodes: [{ title: "250 g" }, { title: "2 lb" }] } },
          { id: "gid://shopify/Product/2", handle: "coe-lot", title: "CoE Lot", variants: { nodes: [{ title: "125 g" }] } },
        ] } },
      },
    },
  });

  it("reads the sizes listed in the page data", async () => {
    const { shownVariantTitles, turboStreamData } = await import("@/lib/scrapers/hydrogen");
    const shown = shownVariantTitles(turboStreamData(page));
    expect([...shown.get("agaro")!]).toEqual(["250 g", "2 lb"]);
    expect([...shown.get("coe-lot")!]).toEqual(["125 g"]);
  });

  it("prices only the sizes the site sells", async () => {
    const { shownVariantTitles, turboStreamData } = await import("@/lib/scrapers/hydrogen");
    const shown = shownVariantTitles(turboStreamData(page));
    shown.set("holiday", new Set());
    shown.set("burundi", new Set(["310 g", "2 lb"]));
    const coffee = (handle: string, variants: [string, string][]) => ({
      id: handle, handle, title: handle, product_type: "Coffee", tags: ["coffee"],
      variants: variants.map(([title, price]) => ({ title, price, available: true })),
    });
    const data = { products: [
      coffee("agaro", [["125 g", "10.00"], ["250 g", "19.80"], ["2 lb", "52.00"]]),
      coffee("coe-lot", [["125 g", "35.00"], ["2 lb", "159.75"]]),
      coffee("holiday", [["125 g", "10.00"], ["310 g", "20.00"]]),
      // The 310 g bag is cheaper per gram than the 2 lb: still the bag.
      coffee("burundi", [["125 g", "10.00"], ["310 g", "19.00"], ["2 lb", "62.00"]]),
    ] };
    const byHandle = Object.fromEntries(parseShopify(data, "https://r.example", "USD", null, shown).map((p) => [p.url.split("/").pop(), p]));
    expect(byHandle.agaro).toMatchObject({ price: 19.8, size: { label: "250 g" }, available: true });
    expect(byHandle["coe-lot"]).toMatchObject({ price: 35, size: { label: "125 g" } });
    // Its page won't show it: not on sale.
    expect(byHandle.holiday.available).toBe(false);
    expect(byHandle.burundi).toMatchObject({ price: 19, size: { label: "310 g" }, available: true });
  });

  it("only treats Remix pages with Shopify content as Hydrogen", async () => {
    const { isHydrogenHome } = await import("@/lib/scrapers/hydrogen");
    const res = (body: string) => ({ url: "https://r.example/", status: 200, contentType: "text/html", body });
    expect(isHydrogenHome(res(page))).toBe(true);
    expect(isHydrogenHome(res("<html>cdn.shopify.com</html>"))).toBe(false);
  });
});

describe("private-label wholesale coffees", () => {
  it("drops coffees roasted for a named wholesale customer (H&S for Java Moon)", () => {
    expect(isPrivateLabel(["b2b-java-moon"], "Java Moon Bighorn Medium")).toBe(true);
    expect(isPrivateLabel(["Wholesale: Café Olé"], "Cafe Ole House Blend")).toBe(true);
    const data = { products: [
      { id: 1, handle: "java-moon-bighorn-medium", title: "Java Moon Bighorn Medium", product_type: "Coffee", tags: ["b2b-java-moon"], variants: [{ title: "250g (8.8oz)", price: "11.00", available: true }] },
      { id: 2, handle: "downtown-blend", title: "Downtown Blend", product_type: "Coffee", tags: ["blend", "coffee"], variants: [{ title: "250g (8.8oz)", price: "21.00", available: true }] },
    ] };
    expect(parseShopify(data, "https://r.example").map((p) => p.title)).toEqual(["Downtown Blend"]);
  });
  it("keeps coffees with generic wholesale tags", () => {
    expect(isPrivateLabel(["wholesale-coffee"], "Bedessa")).toBe(false);
    expect(isPrivateLabel(["wholesale-coffee"], "Holiday Coffee")).toBe(false);
    expect(isPrivateLabel(["b2b"], "Java Moon Bighorn Medium")).toBe(false);
    expect(isPrivateLabel(["b2b-java-moon"], "Ethiopia Guji")).toBe(false);
  });
});

describe("gift subscriptions, classes and $0 listings", () => {
  it("leaves out subscriptions named by their schedule", () => {
    expect(looksLikeCoffee({ title: "Gift - 6 Months - Espresso - Every 2 Weeks", options: ["Grind Type", "Whole Bean"] })).toBe(false);
    expect(looksLikeCoffee({ title: "Gift / Prepaid 12 months", options: ["Roast Style", "Espresso / Whole Bean"] })).toBe(false);
    expect(looksLikeCoffee({ title: "Ethiopia Guji", options: ["Size", "250g"] })).toBe(true);
  });
  it("leaves out classes and events", () => {
    expect(looksLikeCoffee({ title: "Coffee Cupping with Subtext", tags: ["classes and experience"] })).toBe(false);
    expect(looksLikeCoffee({ title: "Coffee Brewing Basics", productType: "Workshop", options: ["Date", "Nov 4 2026"] })).toBe(false);
    expect(looksLikeCoffee({ title: "Kenya Kiambu", tags: ["coffee", "single origin", "seasonal"] })).toBe(true);
  });
  it("leaves out products priced $0 everywhere", () => {
    const data = { products: [
      { id: 1, handle: "el-diviso", title: "Colombia El Diviso", product_type: "Coffee", tags: [], variants: [{ title: "10 OZ. / Whole Bean", price: "0.00", available: true }] },
      { id: 2, handle: "el-puente", title: "Finca El Puente", product_type: "Coffee", tags: [], variants: [{ title: "12 oz", price: "25.00", available: true }] },
    ] };
    expect(parseShopify(data, "https://r.example").map((p) => p.title)).toEqual(["Finca El Puente"]);
  });
});
