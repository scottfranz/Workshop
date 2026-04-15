// lib/regalia.ts
// Scrapes the Regalia Easy Subscription page and parses the schedule.

export interface RegaliaEntry {
  raw: string;          // original line e.g. "3/9 - 3/21 Rubirizi Washed Bourbon (Burundi)"
  startDate: string;    // ISO date e.g. "2026-03-09"
  endDate: string;      // ISO date e.g. "2026-03-21"
  name: string;         // e.g. "Rubirizi Washed Bourbon"
  origin: string | null; // e.g. "Burundi"
  productUrl: string | null; // link to individual product page if found
  tastingNotes: string | null; // scraped from product page, null if not found
}

const SUBSCRIPTION_URL = "https://regaliacoffee.com/products/the-easy-subscription.json";

// Parse "1/26 - 2/7 Ibisi Site Red Bourbon (Rwanda)" into structured data
function parseLine(line: string, year: number): RegaliaEntry | null {
  // Match: date range + name + optional (origin)
  const match = line.match(
    /^(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\s+(.+?)(?:\s*\(([^)]+)\))?$/
  );
  if (!match) return null;

  const [, startMonth, startDay, endMonth, endDay, name, origin] = match;

  // Infer year — if end month < start month, end is next year
  const startYear = year;
  const endYear = parseInt(endMonth) < parseInt(startMonth) ? year + 1 : year;

  const pad = (n: string) => n.padStart(2, "0");
  const startDate = `${startYear}-${pad(startMonth)}-${pad(startDay)}`;
  const endDate = `${endYear}-${pad(endMonth)}-${pad(endDay)}`;

  return {
    raw: line.trim(),
    startDate,
    endDate,
    name: name.trim(),
    origin: origin?.trim() ?? null,
    productUrl: null,
    tastingNotes: null,
  };
}

// Extract schedule text from the raw HTML of the subscription page
function extractScheduleLines(html: string): string[] {
  // The schedule appears as plain text after "Subscription Schedule:"
  const marker = "Subscription Schedule:";
  const idx = html.indexOf(marker);
  if (idx === -1) return [];

  // Grab the next ~2000 chars and look for date-prefixed lines
  const chunk = html.slice(idx, idx + 2000);

  // Strip HTML tags for easier parsing
  const text = chunk.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");

  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

  const results: string[] = [];
  for (const line of lines) {
    if (/^\d{1,2}\/\d{1,2}/.test(line)) {
      results.push(line);
    }
  }
  return results;
}

// Try to scrape tasting notes from an individual product page
// Returns null if not found rather than throwing
async function scrapeProductNotes(productHandle: string): Promise<string | null> {
  try {
    const url = `https://regaliacoffee.com/products/${productHandle}.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const body: string = data?.product?.body_html ?? "";
    if (!body) return null;

    // Strip HTML
    const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    // Look for a tasting notes section — common patterns Regalia uses
    const patterns = [
      /(?:tasting notes?|notes?|flavou?rs?)[:\s]+([^.]{10,120})/i,
      /(?:cup profile|profile)[:\s]+([^.]{10,120})/i,
    ];
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) return m[1].trim();
    }

    // Fallback: return first 120 chars of meaningful text
    const clean = text.replace(/add to cart|sold out|subscribe/gi, "").trim();
    if (clean.length > 30) return clean.substring(0, 120) + (clean.length > 120 ? "…" : "");

    return null;
  } catch {
    return null;
  }
}

// Guess a product handle from a coffee name
// e.g. "Gitwe Honey Bourbon" -> "gitwe-honey-bourbon"
function nameToHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Main export: fetch and parse the full schedule
export async function fetchRegaliaSchedule(): Promise<{
  entries: RegaliaEntry[];
  fetchedAt: string;
  shopifyUpdatedAt: string | null;
  error: string | null;
}> {
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetch(SUBSCRIPTION_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return { entries: [], fetchedAt, shopifyUpdatedAt: null, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    const html: string = json?.product?.body_html ?? "";
    const shopifyUpdatedAt: string | null = json?.product?.updated_at ?? null;
    if (!html) {
      return { entries: [], fetchedAt, shopifyUpdatedAt, error: "No product body found in JSON response" };
    }
    const lines = extractScheduleLines(html);

    if (lines.length === 0) {
      return { entries: [], fetchedAt, shopifyUpdatedAt, error: "No schedule found on page — layout may have changed" };
    }

    const currentYear = new Date().getFullYear();
    const entries: RegaliaEntry[] = [];

    for (const line of lines) {
      const entry = parseLine(line, currentYear);
      if (!entry) continue;

      // Try to get tasting notes from the product page
      const handle = nameToHandle(entry.name);
      const notes = await scrapeProductNotes(handle);
      entry.tastingNotes = notes; // null if not found — we don't fake it
      if (notes) {
        entry.productUrl = `https://regaliacoffee.com/products/${handle}`;
      }

      entries.push(entry);
    }

    return { entries, fetchedAt, shopifyUpdatedAt, error: null };
  } catch (err) {
    return { entries: [], fetchedAt, shopifyUpdatedAt: null, error: String(err) };
  }
}

// Check if two schedules are meaningfully different
export function schedulesAreDifferent(
  a: RegaliaEntry[],
  b: RegaliaEntry[]
): boolean {
  if (a.length !== b.length) return true;
  return a.some((entry, i) => entry.raw !== b[i]?.raw);
}

// Find the currently active entry
export function getCurrentEntry(entries: RegaliaEntry[]): RegaliaEntry | null {
  const today = new Date().toISOString().split("T")[0];
  return entries.find(e => e.startDate <= today && e.endDate >= today) ?? null;
}

// Find entry whose window starts tomorrow
export function getEntryStartingTomorrow(entries: RegaliaEntry[]): RegaliaEntry | null {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  return entries.find(e => e.startDate === tomorrowStr) ?? null;
}

// ─── Tandem Sampler Scraper ───────────────────────────────────────────────────

export interface TandemEntry {
  name: string;
  origin: string | null;
}

// Use Shopify's product JSON endpoint — reliable, no HTML parsing, no JS rendering issues
const TANDEM_JSON_URL = "https://www.tandemcoffee.com/products/tandem-sampler.json";

export async function fetchTandemSampler(): Promise<{
  entries: TandemEntry[];
  fetchedAt: string;
  error: string | null;
}> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(TANDEM_JSON_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { entries: [], fetchedAt, error: `HTTP ${res.status}` };

    const json = await res.json();
    const body: string = json?.product?.body_html ?? "";
    if (!body) return { entries: [], fetchedAt, error: "No product body found in JSON response" };

    // Strip HTML tags and normalise whitespace
    const text = body
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");

    // Match coffee entries like "Faver Ninco Gesha (Huila, Colombia)"
    // The body_html uses <strong> tags for each coffee name, but after stripping we
    // can rely on the "(origin)" pattern that Tandem consistently uses.
    const matches = Array.from(text.matchAll(/([A-Z][^()]{3,60}?)\s*\(([^)]+)\)/g));

    const NOISE_WORDS = ["sampler", "typography", "font", "today", "following", "order", "bag", "bean"];

    const entries: TandemEntry[] = matches
      .map(m => ({ name: m[1].trim(), origin: m[2].trim() }))
      .filter(e =>
        e.name.length > 3 &&
        !NOISE_WORDS.some(w => e.name.toLowerCase().includes(w))
      );

    if (entries.length === 0) return { entries: [], fetchedAt, error: "No coffees found in sampler body_html" };

    return { entries, fetchedAt, error: null };
  } catch (err) {
    return { entries: [], fetchedAt, error: String(err) };
  }
}

export function tandemSamplersAreDifferent(a: TandemEntry[], b: TandemEntry[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((entry, i) => entry.name !== b[i]?.name);
}

// ─── Showroom Coffee Green Coffee Scraper ────────────────────────────────────

export interface ShowroomEntry {
  name: string;
  slug: string;
  url: string;
}

const SHOWROOM_BASE = "https://showroomcoffee.com/category/green-coffee";

function parseShowroomPage(html: string): ShowroomEntry[] {
  const entries: ShowroomEntry[] = [];
  // WooCommerce product cards have <a href="https://showroomcoffee.com/product/SLUG/" ...>NAME</a>
  const productRegex = /<a\s+href="(https:\/\/showroomcoffee\.com\/product\/([^/"]+)\/)"/g;
  let match;
  while ((match = productRegex.exec(html)) !== null) {
    const [, url, slug] = match;
    if (entries.some(e => e.slug === slug)) continue;
    // Extract name from the nearby <h3> or title attribute if present
    const titleMatch = html.slice(match.index, match.index + 400).match(/title="([^"]+)"/);
    const name = titleMatch ? titleMatch[1] : slug.replace(/-/g, " ");
    entries.push({ name, slug, url });
  }
  return entries;
}

export async function fetchShowroomGreenCoffee(): Promise<{
  entries: ShowroomEntry[];
  error: string | null;
}> {
  try {
    const allEntries: ShowroomEntry[] = [];
    for (let page = 1; page <= 5; page++) {
      const url = page === 1
        ? `${SHOWROOM_BASE}/`
        : `${SHOWROOM_BASE}/page/${page}/`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        if (page === 1) return { entries: [], error: `HTTP ${res.status}` };
        break; // No more pages
      }
      const html = await res.text();
      const pageEntries = parseShowroomPage(html);
      if (pageEntries.length === 0) break;
      for (const entry of pageEntries) {
        if (!allEntries.some(e => e.slug === entry.slug)) {
          allEntries.push(entry);
        }
      }
    }
    return { entries: allEntries, error: null };
  } catch (err) {
    return { entries: [], error: String(err) };
  }
}

// Returns only slugs that are in `fresh` but not in `stored` (new additions only)
export function showroomNewProducts(stored: ShowroomEntry[], fresh: ShowroomEntry[]): ShowroomEntry[] {
  const storedSlugs = new Set(stored.map(e => e.slug));
  return fresh.filter(e => !storedSlugs.has(e.slug));
}
