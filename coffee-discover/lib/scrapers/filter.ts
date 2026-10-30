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
}

// Words that mean "not a bag of coffee" wherever they appear in a title.
const NON_COFFEE_TITLE = [
  // gift cards, subscriptions, services
  "gift card", "giftcard", "e-gift", "gift certificate", "subscription", "subscribe", "membership",
  "class", "workshop", "ticket", "donation", "tip jar", "shipping protection", "route package", "wholesale inquiry",
  // brewing gear
  "grinder", "dripper", "kettle", "scale", "filter", "filters", "carafe", "decanter", "brewer", "chemex", "aeropress",
  "v60", "kalita", "origami", "french press", "moka", "espresso machine", "tamper", "portafilter", "puck screen",
  "screen", "distribution tool", "distributor", "wdt", "leveler", "dosing cup", "dosing ring", "funnel", "knock box",
  "milk pitcher", "pitcher", "thermometer", "timer", "brush", "towel", "cleaner", "cleaning", "descaler", "cafiza",
  "urnex", "canister", "airscape", "bag clip", "scoop", "spoon", "stand", "tray",
  // water and minerals
  "aquacode", "third wave water", "lotus water", "water packet", "water packets", "mineral", "minerals", "brewing water",
  // drinkware and merch
  "mug", "tumbler", "glass", "glasses", "cups", "shirt", "tee", "t-shirt", "hoodie", "sweatshirt", "crewneck", "hat",
  "beanie", "cap", "tote", "sticker", "stickers", "poster", "print", "pin", "patch", "keychain", "postcard", "socks",
  "apron", "candle",
  // reading
  "book", "books", "atlas", "handbook", "magazine", "zine",
  // other drinks and food
  "capsule", "capsules", "pods", "nespresso", "concentrate", "syrup", "tea", "chai", "matcha", "cocoa", "chocolate bar",
];

const NON_COFFEE_TYPE = [
  "merch", "apparel", "equipment", "gear", "accessor", "tool", "brew", "ware", "book", "water", "gift", "subscription",
  "tea", "kitchen", "supplies", "cleaning", "service", "class", "drink",
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
  "batian", "landrace",
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

const WEIGHT = /(^|[^a-z0-9])\d+(\.\d+)?\s?(oz|ounce|ounces|g|gr|gram|grams|lb|lbs|pound|pounds|kg|kilo)([^a-z]|$)/i;
const GRIND = /whole bean|ground|grind|espresso grind|drip grind|pour over grind/i;

function hasPhrase(haystack: string, phrase: string): boolean {
  // Letter boundaries, so "tee" doesn't match "toffee" and "cap" doesn't match "Capucas".
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z\\u00c0-\\u024f])${escaped}([^a-z\\u00c0-\\u024f]|$)`, "i").test(haystack);
}

const anyPhrase = (text: string, phrases: string[]) => phrases.some((p) => hasPhrase(text, p));

export function looksLikeCoffee(input: ProductSignals | string): boolean {
  const s: ProductSignals = typeof input === "string" ? { title: input } : input;
  const title = s.title.toLowerCase();
  const type = (s.productType ?? "").toLowerCase();
  const tags = (s.tags ?? []).join(" | ").toLowerCase();
  const description = (s.description ?? "").toLowerCase();
  const options = (s.options ?? []).join(" | ");

  // Coffee phrases that contain gear words ("Cup of Excellence", "Filter Roast") shouldn't trip the blocklist.
  const titleForBlocklist = title.replace(/cup of excellence|filter roast|for filter|espresso roast|omni roast/g, " ");

  // Hard no: the title names a non-coffee thing, or the store files it under gear/merch/books/etc.
  if (anyPhrase(titleForBlocklist, NON_COFFEE_TITLE) || hasPhrase(titleForBlocklist, "cup")) return false;
  const typeSaysCoffee = type !== "" && anyPhrase(type, COFFEE_TYPE);
  if (!typeSaysCoffee && type !== "" && NON_COFFEE_TYPE.some((w) => type.includes(w))) return false;
  if (/(^|\|\s*)(merch|merchandise|gear|equipment|accessories|apparel|books?|water|tools?|brew gear)(\s*\||$)/.test(tags)) return false;

  // Yes if anything positively says coffee.
  if (typeSaysCoffee) return true;
  if (WEIGHT.test(options) || GRIND.test(options)) return true;
  if (anyPhrase(title, ORIGINS) || anyPhrase(title, COFFEE_WORDS) || hasPhrase(title, "coffee")) return true;
  if (anyPhrase(tags, ORIGINS) || anyPhrase(tags, COFFEE_WORDS)) return true;
  if (anyPhrase(description, DESCRIPTION_WORDS) || anyPhrase(description, ORIGINS)) return true;

  // No evidence either way: leave it out rather than show gear.
  return false;
}

// Titles the filter rejected during the current request, so visitors can see
// what was left out (and tell us when a real coffee was dropped by mistake).
const skippedLog = new AsyncLocalStorage<Set<string>>();

export async function collectSkipped<T>(fn: () => Promise<T>): Promise<[T, string[]]> {
  const skipped = new Set<string>();
  const result = await skippedLog.run(skipped, fn);
  return [result, [...skipped].slice(0, 150)];
}

/** looksLikeCoffee, noting rejected titles for the current request. */
export function keepCoffee(input: ProductSignals): boolean {
  const ok = looksLikeCoffee(input);
  if (!ok) skippedLog.getStore()?.add(input.title);
  return ok;
}
