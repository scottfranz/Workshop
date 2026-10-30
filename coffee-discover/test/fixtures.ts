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
