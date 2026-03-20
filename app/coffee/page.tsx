"use client";

import { useEffect, useState } from "react";

interface BagRow { name: string; roaster: string; country: string; process: string; roastLevel: string; rating: number | null; openDate: string; price: string; }

interface Stats {
  totalBags: number; avgRating: number; avgPrice: number; avgCupPrice: number;
  topRoasters: [string, number][]; topCountries: [string, number][];
  topProcesses: [string, number][]; ratingBuckets: { label: string; count: number }[];
  topRated: { name: string; roaster: string; rating: number }[];
  recentBags: { name: string; roaster: string; openDate: string; rating: number | null }[];
  allBags: BagRow[];
}

const COLORS = ["#c0622a","#7a9e7e","#5b8fa8","#a0627a","#8a7ab8","#b8874a","#5b9e8a","#c05a5a","#6a8fb8","#9e7a3a","#b85a8a","#6aab6a"];

function BarChart({ data }: { data: [string, number][] }) {
  const max = Math.max(...data.map(d => Number(d[1])), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(([label, count], i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: "30%", fontSize: 11, color: "var(--ink-light)", textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ flex: 1, height: 20, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(Number(count) / max) * 100}%`, height: "100%", background: COLORS[i % COLORS.length], borderRadius: 3, transition: "width 0.6s ease", minWidth: 2 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 700, width: 18, flexShrink: 0, textAlign: "right" }}>{count}</div>
        </div>
      ))}
    </div>
  );
}

function RatingChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(({ label, count }, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, fontSize: 12, color: "var(--ink-light)", textAlign: "right", flexShrink: 0 }}>{label}</div>
          <div style={{ flex: 1, height: 22, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: COLORS[i % COLORS.length], borderRadius: 3, transition: "width 0.6s ease", minWidth: 2 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 700, width: 20, flexShrink: 0 }}>{count}</div>
        </div>
      ))}
    </div>
  );
}


function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--warm-white)", border: "1px solid var(--border)", borderRadius: 8, padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: "var(--coffee)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--ink-light)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function CoffeePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coffee-stats")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setStats(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: "60px 24px", color: "var(--ink-faint)", fontFamily: "'Lato', sans-serif" }}>Loading…</div>;
  if (error) return <div style={{ padding: "60px 24px", color: "var(--terracotta)", fontFamily: "'Lato', sans-serif" }}>Error: {error}</div>;
  if (!stats) return null;

  return (
    <div style={{ padding: "24px", overflowY: "auto", height: "100vh", fontFamily: "'Lato', sans-serif" }}>
      <style>{`
        @media (min-width: 769px) {
          .coffee-pad { padding: 32px 48px !important; }
          .grid-4 { grid-template-columns: repeat(4, 1fr) !important; }
          .grid-2 { grid-template-columns: 1fr 1fr !important; }
          .grid-4b { grid-template-columns: 1fr 1fr 1fr 1fr !important; }
        }
      `}</style>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, marginBottom: 4 }}>Coffee</div>
      <div style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 32 }}>Stats from your bag log</div>

      {/* Stats strip */}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
        <Card title="Bags Logged"><Stat label="total bags" value={stats.totalBags} /></Card>
        <Card title="Avg Rating"><Stat label="out of 10" value={stats.avgRating} /></Card>
        <Card title="Avg Bag Price"><Stat label="per bag" value={`$${stats.avgPrice}`} /></Card>
        <Card title="Avg Cup Price"><Stat label="at 15g per cup" value={`$${stats.avgCupPrice}`} /></Card>
      </div>

      {/* Two tables side by side */}
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 24 }}>
        <Card title="Highest Rated Bags">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.topRated.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: i < stats.topRated.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--coffee)", width: 36, flexShrink: 0 }}>{b.rating}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>{b.roaster}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Most Recently Opened">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.recentBags.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: i < stats.recentBags.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--coffee)", width: 36, flexShrink: 0 }}>{b.rating ?? "—"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>{b.roaster} · {new Date(b.openDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Roasters + Countries + Process + Rating dist */}
      <div className="grid-4b" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card title="Top Roasters"><BarChart data={stats.topRoasters} /></Card>
        <Card title="Top Origins"><BarChart data={stats.topCountries} /></Card>
        <Card title="Process"><BarChart data={stats.topProcesses} /></Card>
        <Card title="Rating Distribution"><RatingChart data={stats.ratingBuckets} /></Card>
      </div>

      {/* All bags table */}
      <Card title="All Bags">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Lato', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {["Rating","Name","Roaster","Country","Process","Opened"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.allBags.map((b, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--cream)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ""}>
                  <td style={{ padding: "8px 10px", fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "var(--coffee)", whiteSpace: "nowrap" }}>{b.rating ?? "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</td>
                  <td style={{ padding: "8px 10px", color: "var(--ink-light)", whiteSpace: "nowrap" }}>{b.roaster}</td>
                  <td style={{ padding: "8px 10px", color: "var(--ink-light)", whiteSpace: "nowrap" }}>{b.country?.split(" - ")[0]}</td>
                  <td style={{ padding: "8px 10px", color: "var(--ink-light)", whiteSpace: "nowrap" }}>{b.process}</td>
                  <td style={{ padding: "8px 10px", color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{b.openDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
