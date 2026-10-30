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
      price: 19.5,
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
    expect(peru).toMatchObject({ price: 20, currency: "CAD", available: true, publishedAt: new Date(1760000000000).toISOString() });
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
  ])("keeps %s", (title, extra) => {
    expect(coffee(title, extra)).toBe(true);
  });

  it("trusts an explicit coffee product type but not a gear one", () => {
    expect(coffee("Server Room", { productType: "Coffee" })).toBe(true);
    expect(coffee("Ethiopia", { productType: "Merchandise" })).toBe(false);
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
