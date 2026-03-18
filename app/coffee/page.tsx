"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalBags: number; avgRating: number; avgPrice: number; avgCupPrice: number;
  topRoasters: [string, number][]; topCountries: [string, number][];
  topProcesses: [string, number][]; ratingBuckets: { label: string; count: number }[];
  topRated: { name: string; roaster: string; rating: number }[];
  recentBags: { name: string; roaster: string; openDate: string; rating: number | null }[];
  ratingsOverTime: { date: string; rating: number; name: string; roaster: string }[];
}

const COLORS = ["#c0622a","#7a9e7e","#5b8fa8","#a0627a","#8a7ab8","#b8874a","#5b9e8a","#c05a5a","#6a8fb8","#9e7a3a","#b85a8a","#6aab6a"];

function BarChart({ data }: { data: [string, number][] }) {
  const max = Math.max(...data.map(d => Number(d[1])), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(([label, count], i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 110, fontSize: 12, color: "var(--ink-light)", textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ flex: 1, height: 22, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(Number(count) / max) * 100}%`, height: "100%", background: COLORS[i % COLORS.length], borderRadius: 3, transition: "width 0.6s ease", minWidth: 2 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 700, width: 20, flexShrink: 0 }}>{count}</div>
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


function LineChart({ data }: { data: { date: string; rating: number; name: string; roaster: string }[] }) {
  if (data.length === 0) return <div style={{ color: "var(--ink-faint)", fontSize: 13 }}>No data</div>;

  const W = 800, H = 160, PAD = { top: 16, right: 16, bottom: 32, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minR = 0, maxR = 10;
  const toY = (r: number) => PAD.top + innerH - ((r - minR) / (maxR - minR)) * innerH;
  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.rating), ...d }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

  // Y axis labels
  const yTicks = [0, 2, 4, 6, 8, 10];

  // X axis: show ~6 evenly spaced date labels
  const xTickCount = Math.min(6, data.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1)) * (data.length - 1));
    return { idx, label: new Date(data[idx].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }) };
  });

  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: typeof points[0] } | null>(null);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Grid lines */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={toY(t)} y2={toY(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 6} y={toY(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--ink-faint)">{t}</text>
          </g>
        ))}
        {/* X axis labels */}
        {xTicks.map(({ idx, label }) => (
          <text key={idx} x={toX(idx)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-faint)">{label}</text>
        ))}
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="var(--coffee)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--coffee)"
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, d: p })}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: "pointer" }} />
        ))}
      </svg>
      {tooltip && (
        <div style={{ position: "absolute", left: `${(tooltip.x / W) * 100}%`, top: `${(tooltip.y / H) * 100}%`, transform: "translate(-50%, -110%)", background: "var(--ink)", color: "var(--cream)", borderRadius: 6, padding: "6px 10px", fontSize: 11, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10 }}>
          <div style={{ fontWeight: 700 }}>{tooltip.d.rating} — {tooltip.d.name}</div>
          <div style={{ opacity: 0.75 }}>{tooltip.d.roaster} · {new Date(tooltip.d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
        </div>
      )}
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

      {/* Ratings over time */}
      <Card title="Ratings Over Time">
        <LineChart data={stats.ratingsOverTime} />
      </Card>
    </div>
  );
}
