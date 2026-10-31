// Trimmed-down responses in the shape each platform actually returns.

export const shopifyProducts = {
  products: [
    {
      id: 7001, title: "Ethiopia Guji Hambela", handle: "ethiopia-guji-hambela", product_type: "Coffee",
      tags: ["single origin", "washed"], published_at: "2026-10-20T09:00:00-04:00", created_at: "2026-10-18T09:00:00-04:00",
      body_html: "<p>A washed heirloom lot.</p><p><strong>Tasting notes:</strong> peach, jasmine &amp; bergamot.</p>",
      variants: [{ price: "22.00", available: true }, { price: "19.50", available: false }],
      images: [{ src: "//cdn.shopify.com/s/files/1/guji.jpg" }],
    },
    {
      id: 7002, title: "Comandante C40 Grinder", handle: "c40", product_type: "Equipment", tags: [],
      published_at: "2026-10-01T00:00:00Z", body_html: "", variants: [{ price: "300.00", available: true }], images: [],
    },
    {
      id: 7003, title: "Digital Gift Card", handle: "gift-card", product_type: "", tags: "",
      published_at: "2026-01-01T00:00:00Z", variants: [{ price: "25.00", available: true }], images: [],
    },
    {
      id: 7004, title: "Colombia Decaf", handle: "colombia-decaf", product_type: "", tags: "decaf, sugarcane",
      published_at: "2026-09-01T00:00:00Z", body_html: "<p>Sugarcane decaf.</p>",
      variants: [{ price: "18.00", available: false }], images: [{ src: "https://cdn.shopify.com/decaf.jpg" }],
    },
  ],
};

export const wooProducts = [
  {
    id: 41, name: "Kenya Kiambu AA &#8211; Natural", permalink: "https://showroomcoffee.com/product/kenya-kiambu/",
    short_description: "<p>Notes of blackcurrant and tomato.</p>", is_in_stock: true,
    images: [{ src: "https://showroomcoffee.com/wp-content/uploads/kiambu.jpg" }],
    categories: [{ slug: "green-coffee", name: "Green Coffee" }],
    prices: { price: "1250", currency_code: "USD", currency_minor_unit: 2 },
  },
  {
    id: 42, name: "Showroom Tote Bag", permalink: "https://showroomcoffee.com/product/tote/", is_in_stock: true,
    images: [], categories: [{ slug: "merch", name: "Merch" }], prices: { price: "2000", currency_code: "USD", currency_minor_unit: 2 },
  },
  {
    id: 43, name: "House Espresso", permalink: "https://showroomcoffee.com/product/house-espresso/", is_in_stock: false,
    images: [], categories: [{ slug: "roasted-coffee", name: "Roasted Coffee" }],
    prices: { price: "1600", currency_code: "USD", currency_minor_unit: 2 },
  },
];

export const squarespaceLegacyPage = {
  website: { siteTitle: "Little Roaster Co.", baseCurrency: "USD" },
  collection: { typeName: "products" },
  items: [
    {
      id: "abc", title: "Burundi Kayanza", fullUrl: "/shop/p/burundi-kayanza", assetUrl: "https://images.squarespace-cdn.com/burundi.jpg",
      publishOn: 1761000000000, excerpt: "<p>We taste red grape, hibiscus and cane sugar.</p>",
      structuredContent: { productType: 1, variants: [{ price: 2100, onSale: false, qtyInStock: 0, unlimited: true }] },
    },
    {
      id: "def", title: "Sticker Pack", fullUrl: "/shop/p/stickers", assetUrl: "https://images.squarespace-cdn.com/s.jpg",
      publishOn: 1761000000000, structuredContent: { variants: [{ price: 500, qtyInStock: 10 }] },
    },
  ],
  pagination: { nextPage: false },
};

export const squarespace71Page = {
  website: { siteTitle: "Modern Roasters" },
  collection: { typeName: "products-v2" },
  items: [
    {
      id: "x1", title: "Peru Cajamarca", fullUrl: "/store/p/peru", assetUrl: "https://images.squarespace-cdn.com/peru.png",
      addedOn: 1760000000000,
      variants: [
        { priceMoney: { currency: "CAD", value: "24.00" }, salePriceMoney: { currency: "CAD", value: "20.00" }, onSale: true, stock: { quantity: 0, unlimited: false } },
        { priceMoney: { currency: "CAD", value: "40.00" }, onSale: false, stock: { quantity: 3, unlimited: false } },
      ],
    },
  ],
};

export const bigCartelProducts = [
  {
    id: 99, name: "Honduras Santa Barbara", permalink: "honduras-santa-barbara", url: "/product/honduras-santa-barbara",
    price: 17, status: "active", created_at: "2026-10-25T12:00:00.000-05:00", description: "Caramel, red apple.",
    images: [{ url: "https://assets.bigcartel.com/product_images/1/honduras.jpg" }], categories: [{ name: "Coffee" }],
    options: [{ price: 17, sold_out: false }, { price: 30, sold_out: true }],
  },
  {
    id: 100, name: "Logo Hoodie", permalink: "hoodie", url: "/product/hoodie", price: 45, status: "sold-out",
    images: [], categories: [{ name: "Apparel" }], options: [],
  },
];

export const jsonLdListingHtml = `<!doctype html><html><head>
<title>Shop | Riverbend Coffee</title>
<meta property="og:site_name" content="Riverbend Coffee">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[
  {"@type":"ListItem","position":1,"url":"https://riverbend.example/product/rwanda"},
  {"@type":"ListItem","position":2,"url":"/product/brazil"}
]}</script></head><body></body></html>`;

export const jsonLdProductHtml = (name: string, price: string, availability = "https://schema.org/InStock") => `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"WebPage","name":"x"},
  {"@type":"Product","name":"${name}","image":["/img/${name}.jpg"],"description":"Notes of plum &amp; cocoa.",
   "offers":{"@type":"AggregateOffer","lowPrice":"${price}","priceCurrency":"USD","offers":[{"@type":"Offer","price":"${price}","availability":"${availability}"}]}}
]}</script></head></html>`;

export const squarespaceHomeHtml = `<!doctype html><html><head><!-- This is Squarespace. -->
<title>Little Roaster Co.</title></head><body>
<nav><a href="/about">About</a><a href="/shop">Shop Coffee</a></nav></body></html>`;

// Square Online: page HTML embeds the IDs; products come from a JSON API.
export const squareHtml = `<!doctype html><html><head><title>Single Origin Coffees (lighter roasts) | S&amp;W Craft Roasting</title>
<script>window.__BOOTSTRAP_STATE__ = {"siteData":{"currency":"USD"}}; var config = { user_id: '144301722', site_id: '609617072503030687' };</script>
<link rel="preconnect" href="https://cdn6.editmysite.com"></head><body><div id="app"></div></body></html>`;

const sq = (id: string, name: string, cats: string[], price: number, oos: boolean, desc: string) => ({
  id, name, visibility: "visible", short_description: `<p>${desc}</p>`, site_link: `product/${id}/1`,
  absolute_site_link: `https://sw.example/product/${id}/1`, created_date: "2026-10-01T00:00:00+00:00",
  badges: { out_of_stock: oos }, price: { low: price, high: price }, categoryIds: cats,
  images: { data: [{ absolute_url: `https://1.cdn6.editmysite.com/uploads/${id}.jpeg` }] },
  categories: { data: cats.map((c) => ({ name: c === "4" ? "Archive" : "Single Origin Coffees (lighter roasts)" })) },
});

export const squareProductsPage1 = {
  data: [
    sq("kenya-kii", "Kenya Kii AB", ["X1", "2"], 17.1, false, "Blackcurrant and grapefruit."),
    sq("brazil", "Brazil Daterra Summer Solstice", ["X2", "4"], 11.05, true, "Lemon, lavender, rose tea."),
    sq("sample", "Add a Sample", ["2"], 0.01, false, "Where have all the samples gone?"),
    sq("tip", "Thank the fellas!", ["2"], 1, false, "How can I leave a tip?"),
    { ...sq("hidden", "Hidden Peru", ["2"], 15, false, "Peru"), visibility: "hidden" },
  ],
  meta: { pagination: { total: 6, total_pages: 2 } },
};

export const squareProductsPage2 = {
  data: [sq("rwanda", "Rwanda Kinini Village Lot 5-28", ["2"], 15.65, false, "Red currant, black tea.")],
  meta: { pagination: { total: 6, total_pages: 2 } },
};

// Headless Shopify (Next.js Commerce): products embedded in the App Router's streamed page data.
const sfProduct = (id: number, handle: string, title: string, tags: string[], variants: [string, string, boolean][]) => ({
  id: `gid://shopify/Product/${id}`, handle, availableForSale: true, title, description: "Varietal: SL28 Processing: Washed",
  descriptionHtml: "<p>Varietal: SL28</p>", tags, options: [{ name: "Size", values: variants.map((v) => v[0]) }],
  priceRange: { minVariantPrice: { amount: variants[0][1], currencyCode: "DKK" } },
  featuredImage: { url: `https://cdn.shopify.com/s/files/${handle}.jpg` },
  variants: variants.map(([t, amount, available]) => ({ title: t, availableForSale: available, selectedOptions: [{ name: "Size", value: t }], price: { amount, currencyCode: "DKK" } })),
});
const rsc = (data: unknown) => `<script>self.__next_f.push([1,${JSON.stringify(`3:["$","div",null,${JSON.stringify(data)}]`)}])</script>`;

export const storefrontCollectionHtml = `<!doctype html><html><head><title>Filter Coffee | april coffee roasters</title>
<link rel="preload" href="https://cdn.shopify.com/s/files/x.jpg"></head><body>
<a href="/product/volcan-azul">Volcan Azul</a><a href="/product/volcan-azul-espresso">Volcan Azul</a>
${rsc({ products: [
  sfProduct(1, "volcan-azul", "Volcan Azul - Costa Rica", ["Filter Beans"], [["125g", "168.0", true], ["250g", "249.0", true], ["1kg", "816.0", true]]),
  sfProduct(2, "volcan-azul-espresso", "Volcan Azul - Costa Rica", ["Espresso Beans"], [["250g", "249.0", true], ["1kg", "816.0", false]]),
  sfProduct(3, "filter-cup-kit", "The April Filter Cup Kit", ["Brewers"], [["Default Title", "450.0", true]]),
] })}</body></html>`;

export const storefrontHomeHtml = `<!doctype html><html><head><title>april coffee roasters</title>
<script>self.__next_f.push([1,"0:{}"])</script><img src="https://cdn.shopify.com/s/files/hero.jpg"></head><body><a href="/collections/everything">Shop</a></body></html>`;

// Subbly storefront (Hatch Coffee): product records in the App Router stream, description as a text row.
const subblyRecord = (id: number, slug: string, name: string, description: string, variants: [string, number, number | null][]) => ({
  product: { id, slug, type: "one_time", name, description, giftCard: false, digital: false, images: [{ url: `https://cdn.filestackcontent.com/${slug}` }],
    variants: variants.map(([n, price, stockCount]) => ({ name: n, price, stockCount })), createdAt: "2026-09-30T15:53:11.000000Z" },
});
const descriptionText = "<p>Washed Bourbon from Ngozi.<br><br>300g<br>Process: Washed</p>";
export const subblyShopHtml = `<!doctype html><html lang="en"><head><title>Shop Coffee | Hatch Coffee</title>
<link rel="icon" href="https://assets.subbly.co/icon.png"></head><body><span>All Pricing in CAD</span>
<script>self.__next_f.push([1,${JSON.stringify(`5a:T${Buffer.byteLength(descriptionText).toString(16)},${descriptionText}3a:["$","div","p",${JSON.stringify(subblyRecord(1, "bahire-washed", "Bahire Washed", "$5a", [["Bahire Washed", 2800, 231]]))}]
3b:["$","div","p",${JSON.stringify(subblyRecord(2, "gamma", "Gamma", "Bright and sweet.", [["300g", 2200, 1766], ["2kg", 12500, 461]]))}]
3c:["$","div","p",${JSON.stringify(subblyRecord(3, "hiflux", "HIFLUX PURITY Filters", "Paper filters.", [["Flat Bottom Wave 155", 2000, 58]]))}]
3d:["$","div","p",${JSON.stringify(subblyRecord(4, "sold", "Rumudamo Washed", "Natural process lot.", [["300g", 3400, 0], ["2kg", 15000, 5]]))}]`)}])</script></body></html>`;
