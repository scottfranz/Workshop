import { NextResponse } from "next/server";

const USER_ID = process.env.GOODREADS_USER_ID ?? "38583676";
const SHELVES = ["read", "currently-reading", "to-read"] as const;
type Shelf = typeof SHELVES[number];

interface Book {
  title: string;
  author: string;
  cover: string | null;
  rating: number | null;
  dateRead: string | null;
  shelf: Shelf;
  link: string;
}

function rssUrl(shelf: Shelf) {
  return `https://www.goodreads.com/review/list_rss/${USER_ID}?shelf=${shelf}&per_page=200`;
}

function parseRating(str: string): number | null {
  const n = parseInt(str);
  return !isNaN(n) && n > 0 ? n : null;
}

function parseDate(str: string): string | null {
  if (!str || str.trim() === "") return null;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch { return null; }
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function extractImageSrc(html: string): string | null {
  const m = html.match(/src="([^"]+)"/);
  return m?.[1] ?? null;
}

async function fetchShelf(shelf: Shelf): Promise<Book[]> {
  try {
    const res = await fetch(rssUrl(shelf), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 }, // cache 24 hours
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items = xml.split("<item>").slice(1);
    return items.map(item => {
      const title = extractTag(item, "title");
      const author = extractTag(item, "author_name");
      const link = extractTag(item, "link");
      const ratingStr = extractTag(item, "user_rating");
      const dateStr = extractTag(item, "user_read_at") || extractTag(item, "user_date_added");
      const imgHtml = extractTag(item, "book_large_image_url") || extractTag(item, "book_medium_image_url");
      const cover = imgHtml.startsWith("http") ? imgHtml : extractImageSrc(imgHtml);

      return {
        title,
        author,
        cover: cover ?? null,
        rating: parseRating(ratingStr),
        dateRead: parseDate(dateStr),
        shelf,
        link,
      };
    }).filter(b => b.title);
  } catch {
    return [];
  }
}

export async function GET() {
  const [read, current, toRead] = await Promise.all(SHELVES.map(fetchShelf));
  const all = [...current, ...read, ...toRead];
  return NextResponse.json(all);
}
