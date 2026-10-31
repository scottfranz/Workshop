import { AsyncLocalStorage } from "node:async_hooks";

// Roasters sell a lot more than beans: gear, books, water minerals, merch.
// Blocklists alone can't keep up, so a product has to show positive evidence
// of being coffee (a coffee category, bag-size or grind options, an origin,
// variety or process, tasting notes...) and must not look like gear or merch.

export interface ProductSignals {
  title: string;
  /** Shopify product_type, WooCommerce/Big Cartel categories, JSON-LD category. */
  productType?: string | null;
  tags?: string[];
  /** Plain-text description. */
  description?: string | null;
  /** Option names and values, variant titles, e.g. ["Size", "12oz", "Grind", "Whole Bean"]. */
  options?: string[];
  /** Brand/vendor the store files the product under, e.g. "Onyx Coffee Lab (WHOLESALE)". */
  vendor?: string | null;
}

// Words that mean "not a bag of coffee" wherever they appear in a title.
const NON_COFFEE_TITLE = [
  // gift cards, subscriptions, services
  "gift card", "giftcard", "e-gift", "gift certificate", "subscription", "subscribe", "sub", "membership", "coffee club",
  "abonnement", "abonnemang", "abo", "gaveabonnement", "gavekort", "presentkort", "gutschein", "geschenkkarte", "carte cadeau",
  "class", "workshop", "ticket", "donation", "tip jar", "shipping protection", "route package", "wholesale",
  // not sold to the public: café, staff and partner products
  "cafe only", "café only", "cafes only", "staff only", "employee", "case pack", "white label",
  // brewing gear
  "grinder", "grinders", "dripper", "drippers", "kettle", "scale", "filter", "filters", "carafe", "decanter", "brewer", "chemex", "aeropress",
  "v60", "kalita", "origami", "french press", "moka", "espresso machine", "tamper", "portafilter", "puck screen",
  "screen", "distribution tool", "distributor", "wdt", "leveler", "dosing cup", "dosing ring", "funnel", "knock box",
  "shaker", "cellar", "cellars", "coffee maker", "espresso maker", "maker", "water drops", "mypressi",
  // the same in French, German and Scandinavian shops
  "moulin", "moulins", "meules", "bouilloire", "tasse", "tasses", "soucoupe", "théière", "cafetière", "pichet",
  "verre", "cuillère", "brosse", "filtres", "casquette", "tablier", "mühle", "kaffeemühle", "wasserkocher", "waage",
  "tasse", "kværn", "kvarn", "vægt", "våg", "kop", "kopp",
  "milk pitcher", "pitcher", "thermometer", "timer", "brush", "towel", "cleaner", "cleaning", "descaler", "cafiza",
  "urnex", "canister", "airscape", "bag clip", "scoop", "spoon", "stand", "tray",
  // water and minerals
  "aquacode", "third wave water", "lotus water", "water packet", "water packets", "mineral", "minerals", "brewing water",
  // drinkware and merch
  "mug", "mugs", "tumbler", "tumblers", "glass", "glasses", "cups", "shirt", "shirts", "tee", "tees", "t-shirt", "t-shirts",
  "hoodie", "hoodies", "sweatshirt", "sweatshirts", "crewneck", "hat", "hats", "beanie", "beanies", "cap", "caps", "tote",
  "totes", "sticker", "stickers", "poster", "posters", "print", "prints", "pin", "pins", "patch", "patches", "keychain",
  "postcard", "postcards", "info card", "info cards", "card set", "socks", "apron", "aprons", "candle", "candles",
  // reading
  "book", "books", "atlas", "handbook", "magazine", "zine",
  // other drinks and food
  "beer", "ipa", "bock", "lager", "mocktail", "mocktails", "kombucha", "soda", "oatside", "oat milk", "milk", "cans",
  "local only", "pickup only", "pick-up only", "in-store only", "capsule", "capsules", "pods", "nespresso", "cometeer", "rtd", "ready to drink", "concentrate", "syrup", "tea", "chai",
  "matcha", "cocoa", "chocolate bar", "chocolate covered", "chocolate collection", "sipping chocolate", "drinking chocolate",
  "hot chocolate", "powder", "toddy", "instant", "sample only",
];

const NON_COFFEE_TYPE = [
  "matériel", "accessoire", "vaisselle", "zubehör", "udstyr", "utrustning",
  "merch", "apparel", "equipment", "gear", "accessor", "tool", "brewer", "brewing", "ware", "book", "water", "gift",
  "subscription", "tea", "kitchen", "supplies", "cleaning", "service", "class", "workshop", "course", "event", "ticket",
  "experience", "drink", "grinder", "machine",
  "dripper", "kettle", "scale", "music", "vinyl", "record", "rtd", "capsule", "cometeer", "chocolate", "cacao",
];

const COFFEE_TYPE = ["coffee", "bean", "espresso", "single origin", "blend", "decaf", "green", "roast", "microlot", "sample"];

const ORIGINS = [
  "ethiopia", "kenya", "colombia", "brazil", "guatemala", "honduras", "costa rica", "panama", "el salvador",
  "nicaragua", "mexico", "peru", "bolivia", "ecuador", "rwanda", "burundi", "uganda", "tanzania", "congo", "drc",
  "yemen", "indonesia", "sumatra", "java", "sulawesi", "papua", "timor", "india", "china", "yunnan", "myanmar",
  "thailand", "vietnam", "laos", "philippines", "hawaii", "kona", "jamaica", "haiti", "dominican", "puerto rico",
  "malawi", "zambia", "zimbabwe", "cameroon", "taiwan", "nepal", "guji", "yirgacheffe", "sidama", "sidamo", "huila",
  "nariño", "narino", "cauca", "tolima", "antioquia", "cajamarca", "kiambu", "nyeri", "kirinyaga", "boquete", "huehuetenango",
  "antigua", "acatenango", "kayanza", "ngozi", "nyamasheke",
];

const COFFEE_WORDS = [
  // varieties
  "gesha", "geisha", "bourbon", "typica", "caturra", "catuai", "pacamara", "sl28", "sl34", "sidra", "heirloom",
  "castillo", "maragogype", "wush wush", "74158", "mokka", "laurina", "eugenioides", "catimor", "parainema", "ruiru",
  "batian", "landrace", "sydra", "chiroso", "fazenda", "finca", "hacienda",
  // processing
  "washed", "natural", "honey", "anaerobic", "carbonic", "wet hulled", "wet-hulled", "semi-washed", "pulped",
  "co-ferment", "coferment", "thermal shock", "swiss water", "sugarcane", "mountain water", "decaf",
  // what roasters call their coffees
  "espresso", "blend", "single origin", "microlot", "micro-lot", "roast", "cup of excellence", "coe", "whole bean",
  "drip", "filter roast", "omni", "sampler", "tasting flight",
];

const DESCRIPTION_WORDS = [
  "tasting notes", "notes of", "we taste", "cup notes", "flavor notes", "flavour notes", "masl", "m.a.s.l", "altitude",
  "elevation", "varietal", "variety", "process", "producer", "washing station", "farm", "cooperative", "co-op",
  "light roast", "medium roast", "dark roast", "roast level", "roasted", "cup score",
];

// Equipment makers whose products roasters resell. Matched against the vendor/brand.
const GEAR_BRANDS = [
  "weber workshops", "fellow", "hario", "kalita", "origami", "comandante", "1zpresso", "baratza", "timemore", "acaia",
  "orea", "cafec", "normcore", "chemex", "aeropress", "bodum", "bonavita", "breville", "la marzocco", "lelit", "niche",
  "eureka", "mazzer", "pullman", "decent espresso", "kinu", "option-o", "miir", "kinto", "loveramics", "notneutral",
  "varia", "wilfa", "zerno", "mahlkönig", "mahlkonig", "ditting", "rhinowares",
];

// When the only hint of coffee is in the description, these mean it's gear or an event that talks about coffee.
const GEAR_DESCRIPTION = [
  "tool", "basket", "baskets", "paper filter", "filter paper", "filters", "grinder", "dripper", "brewer", "portafilter",
  "tamper", "distribution", "dosing", "kettle", "scale", "event", "class", "workshop", "ticket", "rsvp", "dishwasher",
  "stainless steel", "silicone", "made of", "compatible with",
];

const WEIGHT = /(^|[^a-z0-9])\d+(\.\d+)?\s?(oz|ounce|ounces|g|gr|gram|grams|lb|lbs|pound|pounds|kg|kilo)([^a-z]|$)/i;
const GRIND = /whole bean|ground|grind|espresso grind|drip grind|pour over grind/i;

function hasPhrase(haystack: string, phrase: string): boolean {
  // Letter boundaries, so "tee" doesn't match "toffee" and "cap" doesn't match "Capucas".
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z\\u00c0-\\u024f])${escaped}([^a-z\\u00c0-\\u024f]|$)`, "i").test(haystack);
}

const anyPhrase = (text: string, phrases: string[]) => phrases.some((p) => hasPhrase(text, p));

/** The name alone says it's coffee: an origin, variety, process, "blend", "espresso"... */
export function titleSaysCoffee(title: string): boolean {
  const t = title.toLowerCase();
  return anyPhrase(t, ORIGINS) || anyPhrase(t, COFFEE_WORDS) || hasPhrase(t, "coffee");
}

export type CoffeeVerdict = "coffee" | "not" | "unknown";

export function looksLikeCoffee(input: ProductSignals | string): boolean {
  return coffeeVerdict(input) === "coffee";
}

/** "unknown" means nothing pointed either way, so a closer look (e.g. the product page) can decide. */
export function coffeeVerdict(input: ProductSignals | string): CoffeeVerdict {
  const s: ProductSignals = typeof input === "string" ? { title: input } : input;
  const title = s.title.toLowerCase();
  const type = (s.productType ?? "").toLowerCase();
  const tags = (s.tags ?? []).join(" | ").toLowerCase();
  const description = (s.description ?? "").toLowerCase();
  const options = (s.options ?? []).join(" | ");

  // Coffee phrases that contain gear words ("Cup of Excellence", "Filter Roast") shouldn't trip the blocklist.
  const titleForBlocklist = title.replace(/cup of excellence|filter roast|for filter|espresso roast|omni roast/g, " ");

  // Hard no: the title names a non-coffee thing, or the store files it under gear/merch/books/etc.
  if (anyPhrase(titleForBlocklist, NON_COFFEE_TITLE) || hasPhrase(titleForBlocklist, "cup")) return "not";
  // Compound words (Norwegian/Danish/Swedish/German) hide these inside longer words: "kaffeabonnement".
  if (/abonnement|abonnemang|gavekort|presentkort|gutschein/.test(title)) return "not";
  // Subscriptions named by their schedule: Calendar's "Gift - 6 Months - Espresso - Every 2 Weeks".
  if (/\bprepaid\b|\bevery\s+(\d+\s+)?(weeks?|months?)\b|\bgift\b.*\b\d+\s*months?\b/.test(title)) return "not";
  // A gear word in the category wins, so "Coffee Equipment" or "Coffee Grinders" isn't coffee.
  if (type !== "" && NON_COFFEE_TYPE.some((w) => type.includes(w))) return "not";
  const typeSaysCoffee = type !== "" && anyPhrase(type, COFFEE_TYPE);
  if (/(^|\|\s*)(merch|merchandise|gear|equipment|accessories|apparel|books?|water|tools?|brew gear)(\s*\||$)/.test(tags)) return "not";
  // Classes and events ("Coffee Cupping with Subtext", tagged "classes and experience").
  if (/(^|\|\s*)[^|]*\b(class(es)?|workshops?|courses?|events?|tickets?)\b[^|]*(\s*\||$)/.test(tags)) return "not";
  // Tags or vendor marking wholesale, café-only, partner or hidden products.
  // Tags marking café-only, partner or hidden products. ("wholesale" alone isn't enough:
  // many roasters tag retail coffees that way so they also appear in a wholesale portal.)
  if (/(^|\|\s*)(white[- ]label|cafe[- ]only|café[- ]only|utility[- ]sku|private|unlisted|hidden)(\s*\||$)/.test(tags)) return "not";
  // Explicitly wholesale-only. A plain "wholesale"/"b2b" tag usually means "also sold
  // to wholesale customers" (Helm, Hex, Sweet Bloom retail bags carry it), so it isn't enough.
  if (/wholesale[\s_-]*(only|exclusive)|b2b[\s_-]*only|trade[\s_-]*only/.test(tags)) return "not";
  if (/wholesale/i.test(s.vendor ?? "")) return "not";
  if (s.vendor && anyPhrase(s.vendor.toLowerCase(), GEAR_BRANDS)) return "not";

  // Yes if anything positively says coffee.
  if (typeSaysCoffee) return "coffee";
  if (WEIGHT.test(options) || GRIND.test(options)) return "coffee";
  if (anyPhrase(title, ORIGINS) || anyPhrase(title, COFFEE_WORDS) || hasPhrase(title, "coffee")) return "coffee";
  if (anyPhrase(tags, ORIGINS) || anyPhrase(tags, COFFEE_WORDS)) return "coffee";
  if (anyPhrase(description, DESCRIPTION_WORDS) || anyPhrase(description, ORIGINS)) return anyPhrase(description, GEAR_DESCRIPTION) ? "not" : "coffee";

  // No evidence either way: leave it out rather than show gear, unless a closer look finds some.
  return "unknown";
}

// Titles the filter rejected during the current request, so visitors can see
// what was left out (and tell us when a real coffee was dropped by mistake).
const skippedLog = new AsyncLocalStorage<Set<string>>();

export async function collectSkipped<T>(fn: () => Promise<T>): Promise<[T, string[]]> {
  const skipped = new Set<string>();
  const result = await skippedLog.run(skipped, fn);
  return [result, [...skipped].slice(0, 150)];
}

export function noteSkipped(title: string) {
  skippedLog.getStore()?.add(title);
}

/** looksLikeCoffee, noting rejected titles for the current request. */
export function keepCoffee(input: ProductSignals): boolean {
  const ok = looksLikeCoffee(input);
  if (!ok) skippedLog.getStore()?.add(input.title);
  return ok;
}

const SEARCH_DESCRIPTION_CHARS = 500;

/**
 * Text the feed's search looks through. The card only shows a short snippet
 * (usually tasting notes), so details like "washed" further down the
 * description would otherwise be unsearchable. Kept compact because it's
 * cached in the visitor's browser: the start of the description, plus any
 * origin, variety or process words found anywhere in it.
 */
export function searchTextFor(s: ProductSignals): string {
  const description = (s.description ?? "").replace(/\s+/g, " ").trim();
  const keywords = [...ORIGINS, ...COFFEE_WORDS].filter((w) => hasPhrase(description, w));
  return [s.productType, ...(s.tags ?? []), ...(s.options ?? []), description.slice(0, SEARCH_DESCRIPTION_CHARS), ...keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
