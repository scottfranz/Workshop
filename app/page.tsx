"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface CoffeeStats { totalBags: number; avgRating: number; topRated: { name: string; roaster: string; rating: number }[]; recentBags: { name: string; roaster: string; openDate: string; rating: number | null }[]; }interface BookItem { title: string; author: string; shelf: string; rating?: number | null; dateRead?: string | null; }
interface WatchItem { id: string; title: string; type: string; year: number; rating: number; date_watched: string; watchlist: boolean; }
interface WritingItem { id: string; title: string; type: string; word_count: number; created_at: string; }

export default function HomePage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const [coffeeStats, setCoffeeStats] = useState<CoffeeStats | null>(null);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [writings, setWritings] = useState<WritingItem[]>([]);

  useEffect(() => {
    fetch("/api/coffee-stats").then(r => r.json()).then(d => { if (!d.error) setCoffeeStats(d); }).catch(() => {});
    fetch("/api/books").then(r => r.json()).then(d => { if (Array.isArray(d)) setBooks(d); }).catch(() => {});
    fetch("/api/movies").then(r => r.json()).then(d => { if (Array.isArray(d)) setWatches(d); }).catch(() => {});
    fetch("/api/writing").then(r => r.json()).then(d => { if (Array.isArray(d)) setWritings(d); }).catch(() => {});
  }, []);

  const watched = watches.filter(w => !w.watchlist);
  const currentYear = new Date().getFullYear();
  const currentlyReading = books.filter(b => b.shelf === "currently-reading");
  const booksReadThisYear = books.filter(b => b.shelf === "read" && b.dateRead?.startsWith(String(currentYear)));
  const recentWatches = watched.slice(0, 2);
  const recentWriting = writings.slice(0, 1);

  const summaryCards = [
    { label: "Coffees Logged", value: coffeeStats ? String(coffeeStats.totalBags) : "—", detail: coffeeStats ? `avg rating ${coffeeStats.avgRating ?? ""}` : "loading…", color: "var(--coffee)", href: "/coffee" },
    { label: "Currently Reading", value: currentlyReading.length || "0", detail: `${booksReadThisYear.length} read this year`, color: "var(--slate)", href: "/books" },
    { label: "Films & Shows", value: watched.length || "—", detail: recentWatches[0] ? `Last: ${recentWatches[0].title}` : "nothing logged yet", color: "var(--gold)", href: "/watching" },
    { label: "Writing Entries", value: writings.length || "—", detail: recentWriting[0] ? `Last: ${recentWriting[0].title}` : "nothing yet", color: "var(--terracotta)", href: "/writing" },
  ] as const;

  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const stars = (n: number) => n ? `${"★".repeat(n)}${"☆".repeat(5 - n)}` : "";

  return (
    <div>
      <div style={{ padding: "24px 48px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--warm-white)", zIndex: 10 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26 }}>{greeting}</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 300 }}>Here's what's happening across your projects</div>
      </div>

      <div style={{ padding: "40px 48px", maxWidth: 1100 }}>

        {/* Summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 48 }}>
          {summaryCards.map((c) => (
            <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 6, padding: "20px 24px", transition: "border-color 0.15s, transform 0.15s", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--ink-faint)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ink-faint)" }}>{c.label}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: c.color, margin: "6px 0" }}>{c.value}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)", fontWeight: 300 }}>{c.detail}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Module grid */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16 }}>All Modules</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24, marginBottom: 48 }}>

          {/* Coffee */}
          <ModuleCard href="/coffee" icon="☕" name="Coffee" tagline="Bag log · Roaster feed" accent="rgba(107,66,38,0.1)" recentLabel="Recently Opened">
            {coffeeStats?.recentBags.slice(0, 2).map((b, i) => (
              <Item key={i} title={b.name} sub={b.roaster} right={b.rating ? String(b.rating) : "—"} date={fmtDate(b.openDate)} />
            )) ?? <Item title="Loading…" sub="" right="" date="" />}
          </ModuleCard>

          {/* Garden */}
          <ModuleCard href="/garden" icon="🌱" name="Garden" tagline="Bed planner · Harvest log" accent="rgba(122,158,126,0.1)" recentLabel="Beds">
            <Item title="Bed 1 · Brassica" sub="Brussels, Broccoli, Kale" right="" date="" />
            <Item title="Bed 3 · Warm Season" sub="Tomatillo, Cucumber, Jalapeño" right="" date="" />
          </ModuleCard>

          {/* Reading */}
          <ModuleCard href="/books" icon="📖" name="Reading" tagline="Book log · Goodreads sync" accent="rgba(91,127,166,0.1)" recentLabel="Recently Read">
            {books.filter(b => b.shelf === "read").slice(0, 2).map((b, i) => (
              <Item key={i} title={b.title} sub={b.author} right={b.rating ? "★".repeat(b.rating) : ""} date={b.dateRead ? new Date(b.dateRead + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""} />
            ))}
          </ModuleCard>

          {/* Movies */}
          <ModuleCard href="/watching" icon="🎬" name="Movies & TV" tagline="Watch log · Watchlist" accent="rgba(201,150,58,0.1)" recentLabel="Recent Watches">
            {recentWatches.length > 0
              ? recentWatches.map((w, i) => <Item key={i} title={w.title} sub={String(w.year)} right={stars(w.rating)} date={fmtDate(w.date_watched)} />)
              : <Item title="Nothing logged yet" sub="" right="" date="" />}
          </ModuleCard>

          {/* Writing */}
          <ModuleCard href="/writing" icon="✍︎" name="Writing" tagline="Journal · Drafts · Notes" accent="rgba(181,98,42,0.1)" recentLabel="Latest Entry">
            {recentWriting.length > 0
              ? recentWriting.map((w, i) => <Item key={i} title={w.title} sub={`${w.word_count} words · ${w.type}`} right="" date={fmtDate(w.created_at)} />)
              : <Item title="Nothing yet" sub="" right="" date="" />}
          </ModuleCard>

          {/* Projects placeholder */}
          <Link href="/projects" style={{ textDecoration: "none" }}>
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, opacity: 0.6, background: "var(--warm-white)", cursor: "pointer", height: "100%" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>◈</div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "var(--ink-faint)" }}>+ New Project</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Add a custom module</div>
                </div>
              </div>
              <div style={{ padding: "18px 24px", fontSize: 13, color: "var(--ink-faint)", lineHeight: 1.6 }}>
                This space grows with you. Add a tracker, a log, a planner — whatever your next project calls for.
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}

function ModuleCard({ href, icon, name, tagline, accent, recentLabel, children }: {
  href: string; icon: string; name: string; tagline: string; accent: string; recentLabel: string; children: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--warm-white)", cursor: "pointer", transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s" }}
        onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-3px)"; el.style.borderColor = "var(--ink-faint)"; el.style.boxShadow = "0 8px 24px rgba(30,26,20,0.06)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ""; el.style.borderColor = "var(--border)"; el.style.boxShadow = ""; }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", fontWeight: 300 }}>{tagline}</div>
          </div>
          <div style={{ marginLeft: "auto", color: "var(--ink-faint)", fontSize: 18 }}>›</div>
        </div>
        <div style={{ padding: "18px 24px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 12 }}>{recentLabel}</div>
          {children}
        </div>
      </div>
    </Link>
  );
}

function Item({ title, sub, right, date }: { title: string; sub: string; right: string; date: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 300 }}>{sub}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {right && <div style={{ color: "var(--gold)", fontSize: 11 }}>{right}</div>}
        {date && <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{date}</div>}
      </div>
    </div>
  );
}
