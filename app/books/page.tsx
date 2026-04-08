"use client";
import { useState, useEffect } from "react";

interface Book {
  title: string;
  author: string;
  cover: string | null;
  rating: number | null;
  dateRead: string | null;
  shelf: "read" | "currently-reading" | "to-read";
  link: string;
}

function Stars({ n }: { n: number }) {
  return (
    <span style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}

function Cover({ book, size = "md" }: { book: Book; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  const dims: Record<string, [number, number]> = { sm: [48, 68], md: [72, 104], lg: [96, 138] };
  const [w, h] = dims[size];
  const colors = ["#5a6a8a", "#6b5a8a", "#8a5a6b", "#5a7a6a", "#7a6a5a"];
  const color = colors[(book.title.charCodeAt(0) ?? 0) % colors.length];
  return book.cover && !err
    ? <img src={book.cover} alt={book.title} onError={() => setErr(true)}
        style={{ width: w, height: h, objectFit: "cover", borderRadius: 3, flexShrink: 0, boxShadow: "2px 3px 10px rgba(30,26,20,0.18)" }} />
    : <div style={{ width: w, height: h, borderRadius: 3, background: color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "2px 3px 10px rgba(30,26,20,0.12)" }}>📖</div>;
}

function groupByMonth(books: Book[]) {
  const groups: Record<string, Book[]> = {};
  for (const book of books) {
    if (!book.dateRead) continue;
    const key = new Date(book.dateRead + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(book);
  }
  return Object.entries(groups);
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"read" | "currently-reading" | "to-read">("read");

  useEffect(() => {
    fetch("/api/books")
      .then(r => r.json())
      .then(d => { setBooks(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const read = books.filter(b => b.shelf === "read");
  const current = books.filter(b => b.shelf === "currently-reading");
  const toRead = books.filter(b => b.shelf === "to-read");
  const months = groupByMonth(read);

  const avgRating = read.filter(b => b.rating).reduce((s, b, _, a) =>
    s + (b.rating ?? 0) / a.filter(x => x.rating).length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "24px 48px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26 }}>Reading</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 300 }}>
          Synced from Goodreads
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: "14px 48px", borderBottom: "1px solid var(--border)", background: "var(--cream)", display: "flex", gap: 44, flexShrink: 0 }}>
        {[
          { label: "Books read", value: read.length },
          { label: "Currently reading", value: current.length },
          { label: "Want to read", value: toRead.length },
          { label: "Avg rating", value: avgRating ? avgRating.toFixed(2) : "—" },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)" }}>{s.label}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--slate)", marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 48px", borderBottom: "1px solid var(--border)", display: "flex", flexShrink: 0 }}>
        {([
          { key: "read", label: `Read (${read.length})` },
          { key: "currently-reading", label: `Reading (${current.length})` },
          { key: "to-read", label: `Want to Read (${toRead.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "13px 20px", fontSize: 13, fontFamily: "'Lato', sans-serif", border: "none", borderBottom: tab === t.key ? "2px solid var(--slate)" : "2px solid transparent", background: "transparent", color: tab === t.key ? "var(--slate)" : "var(--ink-faint)", fontWeight: tab === t.key ? 700 : 400, cursor: "pointer", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 48px" }}>
        {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>Loading from Goodreads…</div>}
        {error && <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>Couldn't load books — check your GOODREADS_USER_ID in .env.local</div>}

        {/* Read — timeline grouped by month */}
        {!loading && tab === "read" && months.map(([month, items]) => (
          <div key={month} style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19 }}>{month}</div>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{items.length} book{items.length !== 1 ? "s" : ""}</div>
            </div>
            {items.map((book, i) => (
              <a key={i} href={book.link} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", gap: 18, padding: "12px 16px", borderRadius: 8, border: "1px solid transparent", marginBottom: 2, cursor: "pointer", transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
                  <Cover book={book} size="sm" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{book.title}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>{book.author}</div>
                    {book.rating ? <Stars n={book.rating} /> : null}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0, paddingTop: 4 }}>
                    {book.dateRead ? new Date(book.dateRead + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ))}

        {/* Currently reading */}
        {!loading && tab === "currently-reading" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
            {current.length === 0 && <div style={{ color: "var(--ink-faint)", fontSize: 14 }}>Nothing marked as currently reading on Goodreads.</div>}
            {current.map((book, i) => (
              <a key={i} href={book.link} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", gap: 20, padding: "20px 24px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--cream)", cursor: "pointer" }}>
                  <Cover book={book} size="lg" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: "var(--ink)", lineHeight: 1.25 }}>{book.title}</div>
                    <div style={{ fontSize: 14, color: "var(--ink-faint)" }}>{book.author}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: "rgba(91,127,166,0.12)", color: "var(--slate)", width: "fit-content" }}>Currently reading</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Want to read — grid */}
        {!loading && tab === "to-read" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 24 }}>
            {toRead.map((book, i) => (
              <a key={i} href={book.link} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                  <Cover book={book} size="lg" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{book.title}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>{book.author}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
