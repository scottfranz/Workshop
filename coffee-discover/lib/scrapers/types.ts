import type { BagSize } from "./text";

export type Platform = "shopify" | "storefront" | "woocommerce" | "squarespace" | "square" | "subbly" | "wix" | "bigcartel" | "jsonld";

export const PLATFORM_LABELS: Record<Platform, string> = {
  shopify: "Shopify",
  storefront: "Shopify (custom site)",
  woocommerce: "WooCommerce",
  squarespace: "Squarespace",
  square: "Square Online",
  subbly: "Subbly",
  wix: "Wix",
  bigcartel: "Big Cartel",
  jsonld: "Web page",
};

export interface Product {
  /** Stable per-roaster id (platform id or URL). */
  id: string;
  title: string;
  url: string;
  image: string | null;
  /** Price of the bag a shopper would buy (see pickBag), in major units (e.g. 19.5). */
  price: number | null;
  /** Size of that same bag, when the store says. */
  size?: BagSize | null;
  currency: string | null;
  available: boolean;
  /** ISO timestamp when the store says the product was published, if known. */
  publishedAt: string | null;
  /** Short plain-text blurb, usually containing tasting notes. */
  description: string | null;
  /** Brand the store files the product under (Shopify "vendor"); used server-side only. */
  vendor?: string;
  /** Which sales channel the store's own tags/category say this is for; used server-side only. */
  channel?: "retail" | "wholesale";
  /** Extra text search matches against: fuller description, category, tags, sizes, origin/process/variety words. */
  searchText?: string;
}

/** Where and how to read a roaster's catalogue. Returned by detection, stored client-side. */
export interface FeedSource {
  platform: Platform;
  /** URL the adapter reads (shop page, collection, or site root). */
  feedUrl: string;
}

export interface RoasterFeed {
  source: FeedSource;
  /** Display name guessed from the site, if we could find one. */
  siteName: string | null;
  products: Product[];
  /** Titles left out because they didn't look like coffee. */
  skipped?: string[];
}
