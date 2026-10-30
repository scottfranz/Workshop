// Roasters sell a lot more than beans. This keeps the feed to coffee by
// dropping things that are clearly gear, merch, subscriptions or gift cards.

const NON_COFFEE_WORDS = [
  "gift card", "giftcard", "e-gift", "gift certificate", "subscription", "subscribe",
  "grinder", "dripper", "kettle", "scale", "filters", "filter paper", "carafe", "server",
  "brewer", "chemex", "aeropress", "v60", "kalita", "french press", "moka", "espresso machine",
  "tamper", "portafilter", "mug", "cup ", "tumbler", "glass", "shirt", "tee", "hoodie",
  "sweatshirt", "hat", "beanie", "cap", "tote", "sticker", "poster", "pin", "apron",
  "candle", "book", "class", "workshop", "ticket", "gift box", "donation", "tip jar",
  "capsule", "pods", "nespresso", "cold brew concentrate", "syrup", "tea", "chai",
  "matcha", "cocoa", "chocolate bar", "shipping protection", "route package",
];

const COFFEE_TYPE_WORDS = ["coffee", "bean", "espresso", "single origin", "blend", "decaf", "green", "roast"];
const NON_COFFEE_TYPE_WORDS = ["merch", "merchandise", "equipment", "gear", "accessor", "apparel", "brew", "gift", "subscription", "tea", "ware"];

function hasWord(haystack: string, word: string): boolean {
  // Word-ish boundary so "tee" doesn't match "toffee" and "pin" doesn't match "pink".
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(haystack);
}

export function looksLikeCoffee(title: string, productType?: string | null, tags?: string[]): boolean {
  const t = title.toLowerCase();
  const type = (productType ?? "").toLowerCase();
  const tagText = (tags ?? []).join(" ").toLowerCase();

  // An explicit coffee product type wins over title noise ("Espresso Server Blend").
  if (type && COFFEE_TYPE_WORDS.some((w) => type.includes(w)) && !NON_COFFEE_TYPE_WORDS.some((w) => type.includes(w))) {
    return !hasWord(t, "gift card") && !hasWord(t, "subscription");
  }
  if (type && NON_COFFEE_TYPE_WORDS.some((w) => type.includes(w))) return false;
  if (NON_COFFEE_WORDS.some((w) => hasWord(t, w))) return false;
  if (tagText && /(^|\s)(merch|gear|equipment|brew gear|apparel)(\s|$)/.test(tagText)) return false;
  return true;
}
