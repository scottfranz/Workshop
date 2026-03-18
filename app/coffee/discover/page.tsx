"use client";

import { useState, useEffect, useCallback } from "react";

interface CoffeeProduct {
  title: string; price: number | null; available: boolean;
  url: string; image: string | null; roaster: string;
  roasterColor: string; type: "roasted" | "green";
}

interface Roaster {
  id: string; name: string; url: string; color: string;
  type: "roasted" | "green"; platform: string;
}

export default function DiscoverPage() {
  const [products, setProducts] = useState<CoffeeProduct[]>([]);
  const [roasters, setRoasters] = useState<Roaster[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roasterFilter, setRoasterFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addedToLog, setAddedToLog] = useState(new Set<string>());
  const [deletingRoaster, setDeletingRoaster] = useState<string | null>(null);

  const fetchProducts = useCallback(async (bust = false) => {
    const url = bust ? "/api/coffees?refresh=1" : "/api/coffees";
    const res = await fetch(url);
    const data = await res.json();
    setProducts(data.products ?? []);
  }, []);

  const fetchRoasters = useCallback(async () => {
    const res = await fetch("/api/roasters");
    const data = await res.json();
    setRoasters(data);
  }, []);

  const fetchHidden = useCallback(async () => {
    const res = await fetch("/api/hidden");
    const data = await res.json();
    setHidden(new Set(data.keys ?? []));
  }, []);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchRoasters(), fetchHidden()]).finally(() => setLoading(false));
  }, [fetchProducts, fetchRoasters, fetchHidden]);

  async function handleHide(coffee: CoffeeProduct) {
    const key = `${coffee.roaster}::${coffee.title}`;
    setHidden(prev => new Set(Array.from(prev).concat(key)));
    await fetch("/api/hidden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchProducts(true);
    setRefreshing(false);
  }

  async function handleDeleteRoaster(name: string) {
    if (!confirm(`Remove "${name}" from your roasters?`)) return;
    setDeletingRoaster(name);
    await fetch("/api/roasters", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (roasterFilter === name) setRoasterFilter("All");
    await Promise.all([fetchRoasters(), fetchProducts(true)]);
    setDeletingRoaster(null);
  }

  const filtered = products.filter(c => {
    if (!c.available) return false;
    const key = `${c.roaster}::${c.title}`;
    if (hidden.has(key)) return false;
    if (roasterFilter !== "All" && c.roaster !== roasterFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.roaster.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });



  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--warm-white)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }} className="discover-topbar">
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26 }}>Discover</div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 300 }}>Available coffees from your roasters</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            {(["grid", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "7px 12px", background: view === v ? "var(--ink)" : "var(--warm-white)", color: view === v ? "var(--cream)" : "var(--ink-faint)", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "'Lato', sans-serif" }}>
                {v === "grid" ? "⊞" : "☰"}
              </button>
            ))}
          </div>
          <button onClick={handleRefresh} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, color: "var(--ink-faint)", cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>
            {refreshing ? "↻ Refreshing…" : "↻ Refresh"}
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ padding: "8px 16px", background: "var(--ink)", color: "var(--cream)", border: "none", borderRadius: 4, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>
            + Add Roaster
          </button>
        </div>
      </div>

      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--cream)", display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap", flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
        {roasters.map(r => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", borderRadius: 20, border: `1px solid ${roasterFilter === r.name ? "var(--coffee)" : "var(--border)"}`, background: roasterFilter === r.name ? "var(--coffee)" : "var(--warm-white)", overflow: "hidden" }}>
            <button onClick={() => setRoasterFilter(roasterFilter === r.name ? "All" : r.name)}
              style={{ padding: "5px 10px 5px 14px", background: "transparent", border: "none", color: roasterFilter === r.name ? "var(--cream)" : "var(--ink-light)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Lato', sans-serif" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: roasterFilter === r.name ? "rgba(255,255,255,0.6)" : r.color, flexShrink: 0 }} />
              {r.name}
            </button>
            <button onClick={() => handleDeleteRoaster(r.name)} disabled={deletingRoaster === r.name}
              style={{ padding: "5px 10px 5px 4px", background: "transparent", border: "none", color: roasterFilter === r.name ? "rgba(255,255,255,0.6)" : "var(--ink-faint)", fontSize: 13, cursor: "pointer", lineHeight: 1, fontFamily: "'Lato', sans-serif" }}
              title={`Remove ${r.name}`}>
              {deletingRoaster === r.name ? "…" : "×"}
            </button>
          </div>
        ))}
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, background: "var(--warm-white)", color: "var(--ink)", outline: "none", width: 140, fontFamily: "'Lato', sans-serif", flexShrink: 0 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px" }}>
        <style>{`
          @media (min-width: 769px) {
            .discover-pad { padding: 28px 48px !important; }
            .discover-topbar { padding: 24px 48px !important; }
            .discover-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)) !important; }
          }
        `}</style>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)", fontSize: 14 }}>
            {roasters.length === 0 ? "Add a roaster to get started." : "No available coffees found."}
          </div>
        ) : (
          <div className="discover-grid" style={view === "grid" ? { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 } : {}}>
            {filtered.map(c => view === "grid"
              ? <GridCard key={c.title + c.roaster} coffee={c} added={addedToLog.has(c.title)} onAdd={() => setAddedToLog(p => new Set(Array.from(p).concat(c.title)))} onHide={() => handleHide(c)} />
              : <ListRow key={c.title + c.roaster} coffee={c} added={addedToLog.has(c.title)} onAdd={() => setAddedToLog(p => new Set(Array.from(p).concat(c.title)))} onHide={() => handleHide(c)} />
            )}
          </div>
        )}
      </div>

      {showAddModal && <AddRoasterModal onClose={() => setShowAddModal(false)} onSuccess={() => { fetchRoasters(); fetchProducts(true); setShowAddModal(false); }} />}
    </div>
  );
}

function GridCard({ coffee, added, onAdd, onHide }: { coffee: CoffeeProduct; added: boolean; onAdd: () => void; onHide: () => void }) {
  const color = coffee.roasterColor;
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--warm-white)", display: "flex", flexDirection: "column", position: "relative" }}>
      <button onClick={onHide} title="Hide this product"
        style={{ position: "absolute", top: 6, right: 6, zIndex: 2, width: 22, height: 22, borderRadius: "50%", background: "rgba(30,26,20,0.55)", border: "none", color: "white", fontSize: 15, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lato', sans-serif" }}>
        ×
      </button>
      <div style={{ width: "100%", aspectRatio: "4/5", background: color + "18", position: "relative", overflow: "hidden" }}>
        {coffee.image ? <img src={coffee.image} alt={coffee.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BagPlaceholder color={color} />}
        {coffee.type === "green" && <div style={{ position: "absolute", top: 8, left: 8, background: "var(--sage)", color: "white", fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 3 }}>Green</div>}        <div style={{ position: "absolute", bottom: 8, left: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, background: color + "dd", color: "white", padding: "2px 7px", borderRadius: 3 }}>{coffee.roaster}</span>
        </div>
      </div>
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{coffee.title}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: "var(--coffee)" }}>
            {coffee.price ? `$${coffee.price.toFixed(2)}` : "—"}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onAdd} style={{ padding: "4px 9px", fontSize: 11, border: `1px solid ${added ? "var(--sage)" : "var(--border)"}`, borderRadius: 4, background: added ? "rgba(122,158,126,0.1)" : "transparent", color: added ? "var(--sage)" : "var(--ink-faint)", cursor: added ? "default" : "pointer", fontFamily: "'Lato', sans-serif" }}>
              {added ? "✓" : "+ Log"}
            </button>
            <a href={coffee.url} target="_blank" rel="noreferrer" style={{ padding: "4px 9px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, color: "var(--ink-faint)", textDecoration: "none", fontFamily: "'Lato', sans-serif" }}>Buy →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListRow({ coffee, added, onAdd, onHide }: { coffee: CoffeeProduct; added: boolean; onAdd: () => void; onHide: () => void }) {
  const color = coffee.roasterColor;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 40, height: 52, borderRadius: 4, flexShrink: 0, overflow: "hidden", background: color + "18" }}>
        {coffee.image ? <img src={coffee.image} alt={coffee.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BagPlaceholder color={color} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600 }}>{coffee.title}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
          <span style={{ color, fontWeight: 700 }}>{coffee.roaster}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: "var(--coffee)" }}>{coffee.price ? `$${coffee.price.toFixed(2)}` : "—"}</div>
        <button onClick={onAdd} style={{ padding: "5px 10px", fontSize: 12, border: `1px solid ${added ? "var(--sage)" : "var(--border)"}`, borderRadius: 4, background: added ? "rgba(122,158,126,0.1)" : "transparent", color: added ? "var(--sage)" : "var(--ink-faint)", cursor: added ? "default" : "pointer", fontFamily: "'Lato', sans-serif" }}>
          {added ? "✓ Logged" : "+ Log"}
        </button>
        <a href={coffee.url} target="_blank" rel="noreferrer" style={{ padding: "5px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, color: "var(--ink-faint)", textDecoration: "none", fontFamily: "'Lato', sans-serif" }}>Buy →</a>
        <button onClick={onHide} title="Hide" style={{ padding: "5px 8px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 4, color: "var(--ink-faint)", background: "transparent", cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>×</button>
      </div>
    </div>
  );
}

function BagPlaceholder({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 100" fill="none" style={{ width: "100%", height: "100%" }}>
      <rect width="80" height="100" fill={color + "18"} />
      <rect x="10" y="15" width="60" height="70" rx="4" fill={color + "28"} />
      <rect x="10" y="15" width="60" height="18" rx="4" fill={color + "45"} />
      <rect x="18" y="42" width="44" height="3" rx="1.5" fill={color + "55"} />
      <rect x="18" y="50" width="34" height="3" rx="1.5" fill={color + "38"} />
      <circle cx="40" cy="76" r="7" fill={color + "28"} stroke={color + "55"} strokeWidth="1.5" />
    </svg>
  );
}

function AddRoasterModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name || !url) { setError("Both fields are required."); setStatus("error"); return; }
    setStatus("loading");
    try {
      const res = await fetch("/api/roasters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      onSuccess();
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }

  const inp: React.CSSProperties = { padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, fontFamily: "'Lato', sans-serif", color: "var(--ink)", background: "var(--warm-white)", outline: "none", width: "100%" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: "var(--warm-white)", borderRadius: 8, padding: 32, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 6 }}>Add a Roaster</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 24 }}>Must be a Shopify-based store. You can paste a collection URL to limit which products are fetched.</div>
        {status === "error" && <div style={{ background: "rgba(181,98,42,0.08)", border: "1px solid var(--terracotta-light)", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "var(--terracotta)", marginBottom: 16 }}>⚠ {error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)" }}>Roaster Name</div>
            <input type="text" style={inp} placeholder="e.g. Onyx Coffee" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)" }}>Website URL</div>
            <input type="text" style={inp} placeholder="e.g. onyxcoffeelab.com/collections/coffee" value={url} onChange={e => setUrl(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={handleSubmit} disabled={status === "loading"} style={{ padding: "10px 24px", background: "var(--ink)", color: "var(--cream)", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>
            {status === "loading" ? "Checking…" : "Add Roaster"}
          </button>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "transparent", color: "var(--ink-faint)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
