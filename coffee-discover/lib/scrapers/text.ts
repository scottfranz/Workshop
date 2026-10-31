const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", eacute: "é",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** First ~maxLen chars of plain text, cut at a word boundary. */
export function summarize(html: string | null | undefined, maxLen = 180): string | null {
  const text = stripHtml(html);
  if (!text) return null;
  // Prefer an explicit tasting-notes phrase if the roaster wrote one.
  const notes = text.match(/(?:tasting notes?|notes of|we taste|cup notes?|flavou?r notes?)\s*[:\-–]?\s*([^.]{6,120})/i);
  const base = notes ? notes[1].trim() : text;
  if (base.length <= maxLen) return base;
  const cut = base.slice(0, maxLen);
  return cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : maxLen).trim() + "…";
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** "40g", "2 oz", "Sample" — sizes too small to be the bag someone is shopping for. */
export function isSampleSize(label: string | null | undefined): boolean {
  if (!label) return false;
  if (/\bsample|\btaster|\btrial size/i.test(label)) return true;
  // Under 100 g, or under 3 oz, using the same size reader as everything else.
  const size = parseBagSize(label);
  return size ? size.grams < (size.label.endsWith("oz") ? 85 : 100) : false;
}

export function minPrice(values: unknown[]): number | null {
  const nums = values.map(toNumber).filter((n): n is number => n !== null && n > 0);
  return nums.length ? Math.min(...nums) : null;
}

export function absoluteUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.startsWith("//") ? "https:" + href : href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uff66-\uff9f]/;

/**
 * Some roasters write bilingual titles, e.g. "SCAJ - El Espejo. フィンカ・エル・エスペホ".
 * When there's enough Latin-script text to stand on its own, drop the CJK words.
 * Text that is only in Japanese/Chinese/Korean is left alone.
 */
export function preferLatin(text: string): string;
export function preferLatin(text: string | null): string | null;
export function preferLatin(text: string | null): string | null {
  if (!text || !CJK.test(text)) return text;
  const kept = text.split(/\s+/).filter((word) => !CJK.test(word)).join(" ");
  const cleaned = kept.replace(/[\s.,:;\-\u2013\u2014|/]+$/, "").replace(/^[\s.,:;\-|/]+/, "").trim();
  return (cleaned.match(/[A-Za-z\u00c0-\u024f]/g)?.length ?? 0) >= 4 ? cleaned : text;
}

export interface BagSize {
  grams: number;
  /** As the roaster wrote it, tidied: "12 oz", "250 g", "2 lb", "1 kg". */
  label: string;
}

const UNIT_GRAMS: Record<string, [number, string]> = {
  g: [1, "g"], gr: [1, "g"], gram: [1, "g"], grams: [1, "g"], gm: [1, "g"], gms: [1, "g"], grm: [1, "g"], grms: [1, "g"],
  kg: [1000, "kg"], kgs: [1000, "kg"], kilo: [1000, "kg"], kilos: [1000, "kg"],
  oz: [28.3495, "oz"], ounce: [28.3495, "oz"], ounces: [28.3495, "oz"],
  lb: [453.592, "lb"], lbs: [453.592, "lb"], pound: [453.592, "lb"], pounds: [453.592, "lb"],
};

/** "12oz", "250 g", "2lbs", "1kg / Whole Bean" → bag size, or null if there isn't one. */
export function parseBagSize(text: string | null | undefined): BagSize | null {
  if (!text) return null;
  // "250gms" (Proud Mary), "250 g", "12oz", "1KGs"...
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(kilos?|kgs?|grams?|grms?|grm|gms?|gr|g|ounces?|oz|pounds?|lbs?)(?![a-z])/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  const [factor, unit] = UNIT_GRAMS[m[2].toLowerCase()];
  const grams = Math.round(n * factor);
  // Anything outside this range isn't a retail bag (or isn't a weight at all).
  if (grams < 30 || grams > 30000) return null;
  return { grams, label: `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, "")} ${unit}` };
}

export interface PricedOption {
  price: unknown;
  /** Variant/option name(s), where the bag size usually is. */
  label: string;
  available?: boolean;
}

/** "10oz Case Pack (6)", "Pack of 3", "3 x 250 g": several bags sold together. */
export function isMultiPack(label: string): boolean {
  return /case\s*pack|\bcase of\b|\bpack of\b|\(\s*\d+\s*\)|\b\d+\s*[x×]\s*\d|\b[x×]\s*\d+\b|\b\d+[- ]?pack\b/i.test(label);
}

/**
 * The bag a shopper would actually buy: in stock if any are, not a tiny sample
 * if bigger sizes exist, then the cheapest. Its price and size go together so
 * price-per-cup is computed from the same bag.
 */
export function pickBag(options: PricedOption[], fallbackLabel?: string): { price: number | null; size: BagSize | null } {
  const positive = options.map((o) => ({ ...o, value: toNumber(o.price) })).filter((o) => o.value !== null && o.value > 0);
  // Case packs (Onyx's "10oz Case Pack (6)") aren't the bag; use them only if nothing else is sold.
  const single = positive.filter((o) => !isMultiPack(o.label));
  const priced = single.length ? single : positive;
  if (priced.length === 0) return { price: null, size: parseBagSize(fallbackLabel) };
  const inStock = priced.filter((o) => o.available !== false);
  let pool = (inStock.length ? inStock : priced).map((o) => ({ ...o, size: parseBagSize(o.label) }));
  // A bag with a known weight beats a bundle or "set" without one.
  const weighed = pool.filter((o) => o.size);
  if (weighed.length) pool = weighed;
  // Explicit samples ("Sample", "Taster") go, and so do tiny bags, but only when a
  // bigger bag of the same coffee is on offer: some roasters sell rare lots in 75 g bags.
  const biggest = Math.max(0, ...pool.map((o) => o.size?.grams ?? 0));
  const full = pool.filter((o) => !/\bsample|\btaster|\btrial size/i.test(o.label) && !(o.size && o.size.grams < 100 && biggest >= 100));
  const best = (full.length ? full : pool).reduce((a, b) => (b.value! < a.value! ? b : a));
  return { price: best.value, size: best.size ?? parseBagSize(fallbackLabel) };
}

// Bags this size or bigger (2 lb, 1 kg, 5 lb...) are bulk/wholesale sizes.
const BULK_GRAMS = 900;

/**
 * Whether a coffee is really buyable. Some roasters leave bulk sizes marked
 * available after the retail bag sells out (leftover wholesale stock) while
 * their own site shows the coffee as sold out: Sweet Bloom's Hirwa had its
 * 10 oz sold out and only a 2 lb "available". So when a coffee has both a
 * regular bag size and bulk sizes, it counts as in stock only if a regular bag
 * is. Coffees sold only in bulk (green coffee) are judged on their own sizes.
 */
export function retailInStock(options: { label: string; available?: boolean }[]): boolean {
  if (options.length === 0) return true;
  const single = options.filter((o) => !isMultiPack(o.label));
  if (single.length) options = single;
  const sized = options.map((o) => ({ ...o, grams: parseBagSize(o.label)?.grams ?? null }));
  const retail = sized.filter((o) => o.grams !== null && o.grams < BULK_GRAMS);
  const bulk = sized.filter((o) => o.grams !== null && o.grams >= BULK_GRAMS);
  if (retail.length > 0 && bulk.length > 0) return retail.some((o) => o.available !== false);
  return options.some((o) => o.available !== false);
}
