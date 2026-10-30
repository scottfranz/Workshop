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

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uff66-\uff9f]/;

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
