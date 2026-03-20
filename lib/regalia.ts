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
  error: string | null;
}> {
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetch(SUBSCRIPTION_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return { entries: [], fetchedAt, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    const html: string = json?.product?.body_html ?? "";
    if (!html) {
      return { entries: [], fetchedAt, error: "No product body found in JSON response" };
    }
    const lines = extractScheduleLines(html);

    if (lines.length === 0) {
      return { entries: [], fetchedAt, error: "No schedule found on page — layout may have changed" };
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

    return { entries, fetchedAt, error: null };
  } catch (err) {
    return { entries: [], fetchedAt, error: String(err) };
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

const TANDEM_URL = "https://www.tandemcoffee.com/products/tandem-sampler";

export async function fetchTandemSampler(): Promise<{
  entries: TandemEntry[];
  fetchedAt: string;
  error: string | null;
}> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(TANDEM_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { entries: [], fetchedAt, error: `HTTP ${res.status}` };

    const html = await res.text();

    // Find the section after "Today's sampler includes"
    const marker = "Today's sampler includes";
    const idx = html.indexOf(marker);
    if (idx === -1) return { entries: [], fetchedAt, error: "Could not find sampler section on page" };

    // Grab the next 1500 chars and strip tags
    const chunk = html.slice(idx, idx + 1500);
    const text = chunk.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

    // Match lines like: "Faver Ninco Gesha (Huila, Colombia)"
    const matches = Array.from(text.matchAll(/([A-Z][^()]{3,60}?)\s*\(([^)]+)\)/g));

    const entries: TandemEntry[] = matches
      .map(m => ({ name: m[1].trim(), origin: m[2].trim() }))
      .filter(e => e.name.length > 3 && !e.name.toLowerCase().includes("sampler") && !e.name.toLowerCase().includes("typography") && !e.name.toLowerCase().includes("font"));

    if (entries.length === 0) return { entries: [], fetchedAt, error: "No coffees found in sampler section" };

    return { entries, fetchedAt, error: null };
  } catch (err) {
    return { entries: [], fetchedAt, error: String(err) };
  }
}

export function tandemSamplersAreDifferent(a: TandemEntry[], b: TandemEntry[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((entry, i) => entry.name !== b[i]?.name);
}
