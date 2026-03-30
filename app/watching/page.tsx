"use client";
import { useState, useEffect } from "react";

interface WatchEntry {
  id: string; title: string; type: "movie" | "tv"; year: number;
  director: string; runtime: number | null; seasons: number | null;
  season_from: number | null; season_to: number | null;
  tv_status: string | null; rating: number; date_watched: string;
  genre: string; poster: string | null; tmdb_id: number | null;
  watchlist: boolean; notes: string | null;
}

interface TmdbResult {
  id: number; title: string; year: number; director: string;
  runtime: number | null; seasons: number | null; genre: string;
  poster: string | null;
}

const TV_STATUSES = ["Watching", "Finished", "Dropped", "On Hold"];
const inp: React.CSSProperties = { padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, fontFamily: "'Lato', sans-serif", color: "var(--ink)", background: "var(--warm-white)", outline: "none" };

function Stars({ n }: { n: number }) {
  return <span style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 1 }}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3, background: type === "tv" ? "rgba(91,127,166,0.12)" : "rgba(201,150,58,0.12)", color: type === "tv" ? "var(--slate)" : "var(--gold)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {type === "tv" ? "TV" : "Film"}
    </span>
  );
}

function Poster({ entry, size = "md" }: { entry: Partial<WatchEntry>; size?: "sm"|"md"|"lg" }) {
  const [err, setErr] = useState(false);
  const dims: Record<string, [number,number]> = { sm:[48,72], md:[80,120], lg:[100,150] };
  const [w,h] = dims[size];
  const colors = ["#5a6a8a","#6b5a8a","#8a5a6b","#5a8a6b","#8a7a5a"];
  const color = colors[((entry.title?.charCodeAt(0) ?? 0) + (entry.tmdb_id ?? 0)) % colors.length];
  return entry.poster && !err
    ? <img src={entry.poster} alt={entry.title} onError={() => setErr(true)} style={{ width:w, height:h, objectFit:"cover", borderRadius:4, flexShrink:0, boxShadow:"2px 3px 10px rgba(30,26,20,0.2)" }} />
    : <div style={{ width:w, height:h, borderRadius:4, background:color, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:"2px 3px 10px rgba(30,26,20,0.15)" }}>
        {entry.type === "tv" ? "📺" : "🎬"}
      </div>;
}

function groupByMonth(items: WatchEntry[]) {
  const groups: Record<string, WatchEntry[]> = {};
  for (const item of items) {
    const key = new Date(item.date_watched + "T12:00:00").toLocaleDateString("en-US", { month:"long", year:"numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups);
}

async function searchTmdb(query: string, type: string): Promise<TmdbResult[]> {
  const res = await fetch(`/api/tmdb?q=${encodeURIComponent(query)}&type=${type}`);
  const data = await res.json();
  return data.results ?? [];
}

async function saveEntry(body: Partial<WatchEntry>) {
  await fetch("/api/movies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// ── Log Modal ─────────────────────────────────────────────────────────────────
function LogModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"movie"|"tv">("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [dateWatched, setDateWatched] = useState(new Date().toISOString().split("T")[0]);
  const [tvStatus, setTvStatus] = useState("Finished");
  const [seasonFrom, setSeasonFrom] = useState("1");
  const [seasonTo, setSeasonTo] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"search"|"details"|"success">("search");

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const r = await searchTmdb(query, type);
    setResults(r);
    setSearching(false);
  }

  function handleSelect(item: TmdbResult) {
    setSelected(item);
    setSeasonTo(item.seasons ? String(item.seasons) : "");
    setStep("details");
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    await saveEntry({
      title: selected.title, type, year: selected.year, director: selected.director,
      runtime: selected.runtime, seasons: selected.seasons ?? null,
      season_from: selected.seasons ? parseInt(seasonFrom) : null,
      season_to: selected.seasons ? parseInt(seasonTo) : null,
      tv_status: selected.seasons ? tvStatus : null,
      rating, date_watched: dateWatched, genre: selected.genre,
      poster: selected.poster, tmdb_id: selected.id, watchlist: false,
    });
    setSaving(false);
    setStep("success");
    onSaved();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(30,26,20,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }} onClick={onClose}>
      <div style={{ background:"var(--warm-white)", borderRadius:10, width:500, boxShadow:"0 24px 64px rgba(0,0,0,0.28)", overflow:"hidden", maxHeight:"88vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding:"24px 28px 20px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom: step === "search" ? 14 : 0 }}>
            {step === "success" ? "Logged!" : "Log a Film or Show"}
          </div>
          {step === "search" && (
            <div style={{ display:"flex", gap:0, border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", width:"fit-content" }}>
              {[{key:"movie" as const, label:"🎬 Movie"},{key:"tv" as const, label:"📺 TV Show"}].map(t => (
                <button key={t.key} onClick={() => { setType(t.key); setResults([]); setQuery(""); }}
                  style={{ padding:"7px 18px", fontSize:13, fontFamily:"'Lato', sans-serif", border:"none", background:type===t.key?"var(--ink)":"var(--warm-white)", color:type===t.key?"var(--cream)":"var(--ink-faint)", fontWeight:type===t.key?700:400, cursor:"pointer" }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {step === "details" && selected && (
            <div style={{ display:"flex", gap:14, alignItems:"center", background:"var(--cream)", borderRadius:7, padding:"12px 14px", border:"1px solid var(--border)", marginTop:14 }}>
              <Poster entry={{ title: selected.title, type, tmdb_id: selected.id, poster: selected.poster }} size="sm" />
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:600 }}>{selected.title}</div>
                <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:3 }}>
                  {selected.year} · {selected.director}
                  {selected.runtime ? ` · ${selected.runtime} min` : ""}
                  {selected.seasons ? ` · ${selected.seasons} seasons` : ""}
                </div>
              </div>
              <button onClick={() => { setStep("search"); setSelected(null); setResults([]); }} style={{ background:"transparent", border:"none", color:"var(--ink-faint)", cursor:"pointer", fontSize:20, alignSelf:"flex-start" }}>×</button>
            </div>
          )}
        </div>

        <div style={{ padding:"22px 28px" }}>
          {step === "search" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...inp, flex:1 }} placeholder={type==="movie" ? "Search for a film…" : "Search for a TV show…"}
                  value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSearch()} />
                <button onClick={handleSearch} style={{ padding:"9px 16px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif", fontWeight:700, minWidth:72 }}>
                  {searching ? "…" : "Search"}
                </button>
              </div>
              {results.map(r => (
                <div key={r.id} onClick={() => handleSelect(r)}
                  style={{ display:"flex", gap:12, padding:"10px 14px", borderRadius:7, border:"1px solid var(--border)", cursor:"pointer", alignItems:"center", transition:"all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--gold)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}>
                  <Poster entry={{ title: r.title, type, tmdb_id: r.id, poster: r.poster }} size="sm" />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{r.title}</div>
                    <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:2 }}>
                      {r.year} · {r.director}
                      {r.runtime ? ` · ${r.runtime} min` : ""}
                      {r.seasons ? ` · ${r.seasons} seasons` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize:12, color:"var(--gold)", fontWeight:700 }}>Select →</span>
                </div>
              ))}
            </div>
          )}

          {step === "details" && selected && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)" }}>Your Rating</div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  {[1,2,3,4,5].map(i => (
                    <button key={i} onMouseEnter={() => setHoveredStar(i)} onMouseLeave={() => setHoveredStar(0)} onClick={() => setRating(rating===i ? 0 : i)}
                      style={{ width:38, height:38, borderRadius:6, border:`1px solid ${(hoveredStar||rating)>=i?"var(--gold)":"var(--border)"}`, background:(hoveredStar||rating)>=i?"var(--gold-light)":"var(--warm-white)", color:(hoveredStar||rating)>=i?"var(--gold)":"var(--ink-faint)", fontSize:18, cursor:"pointer", transition:"all 0.1s", fontFamily:"'Lato', sans-serif" }}>★</button>
                  ))}
                  {rating > 0 && <span style={{ fontSize:13, color:"var(--gold)", marginLeft:4, fontWeight:700 }}>{rating} / 5</span>}
                </div>
              </div>

              {selected.seasons && (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)" }}>Status</div>
                    <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                      {TV_STATUSES.map(s => (
                        <button key={s} onClick={() => setTvStatus(s)}
                          style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${tvStatus===s?"var(--slate)":"var(--border)"}`, background:tvStatus===s?"var(--slate-light)":"var(--warm-white)", color:tvStatus===s?"var(--slate)":"var(--ink-faint)", fontSize:12, fontWeight:tvStatus===s?700:400, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)" }}>Seasons Watched</div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      {[{label:"From",val:seasonFrom,set:setSeasonFrom},{label:"To",val:seasonTo,set:setSeasonTo}].map((f,i) => (
                        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ fontSize:11, color:"var(--ink-faint)" }}>{f.label}</div>
                          <input type="number" min={1} max={selected.seasons ?? 99} style={{ ...inp, width:"100%" }} value={f.val} onChange={e => f.set(e.target.value)} />
                        </div>
                      ))}
                      <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:16 }}>of {selected.seasons}</div>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)" }}>{selected.seasons ? "Date Finished" : "Date Watched"}</div>
                <input type="date" style={{ ...inp, width:"100%" }} value={dateWatched} onChange={e => setDateWatched(e.target.value)} />
              </div>

              <div style={{ display:"flex", gap:10, paddingTop:4 }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding:"10px 28px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  {saving ? "Saving…" : `Log ${selected.seasons ? "Show" : "Film"} →`}
                </button>
                <button onClick={() => { setStep("search"); setSelected(null); setResults([]); }}
                  style={{ padding:"10px 18px", background:"transparent", color:"var(--ink-faint)", border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  ← Back
                </button>
              </div>
            </div>
          )}

          {step === "success" && selected && (
            <div style={{ textAlign:"center", padding:"16px 0 8px" }}>
              <div style={{ fontSize:44, marginBottom:16 }}>{selected.seasons ? "📺" : "🎬"}</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, marginBottom:8 }}>Logged!</div>
              <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:28 }}>
                <strong>{selected.title}</strong> added to your diary.
                {rating > 0 && <span> Rated {"★".repeat(rating)}.</span>}
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={() => { setStep("search"); setSelected(null); setResults([]); setRating(0); }}
                  style={{ padding:"9px 22px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Log another
                </button>
                <button onClick={onClose} style={{ padding:"9px 22px", background:"transparent", color:"var(--ink-faint)", border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Watchlist Modal ────────────────────────────────────────────────────────────
function WatchlistModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"movie"|"tv">("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number[]>([]);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const r = await searchTmdb(query, type);
    setResults(r);
    setSearching(false);
  }

  async function handleAdd(item: TmdbResult) {
    setSaving(item.id);
    await saveEntry({
      title: item.title, type, year: item.year, director: item.director,
      runtime: item.runtime, seasons: item.seasons ?? null,
      genre: item.genre, poster: item.poster, tmdb_id: item.id, watchlist: true,
      rating: 0,
    });
    setSaved(prev => [...prev, item.id]);
    setSaving(null);
    onSaved();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(30,26,20,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }} onClick={onClose}>
      <div style={{ background:"var(--warm-white)", borderRadius:10, width:500, boxShadow:"0 24px 64px rgba(0,0,0,0.28)", overflow:"hidden", maxHeight:"88vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding:"24px 28px 20px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom:14 }}>Add to Watchlist</div>
          <div style={{ display:"flex", gap:0, border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", width:"fit-content" }}>
            {[{key:"movie" as const, label:"🎬 Movie"},{key:"tv" as const, label:"📺 TV Show"}].map(t => (
              <button key={t.key} onClick={() => { setType(t.key); setResults([]); setQuery(""); }}
                style={{ padding:"7px 18px", fontSize:13, fontFamily:"'Lato', sans-serif", border:"none", background:type===t.key?"var(--ink)":"var(--warm-white)", color:type===t.key?"var(--cream)":"var(--ink-faint)", fontWeight:type===t.key?700:400, cursor:"pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding:"22px 28px", display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...inp, flex:1 }} placeholder={type==="movie" ? "Search for a film…" : "Search for a TV show…"}
              value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSearch()} />
            <button onClick={handleSearch} style={{ padding:"9px 16px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif", fontWeight:700, minWidth:72 }}>
              {searching ? "…" : "Search"}
            </button>
          </div>
          {results.map(r => (
            <div key={r.id} style={{ display:"flex", gap:12, padding:"10px 14px", borderRadius:7, border:"1px solid var(--border)", alignItems:"center" }}>
              <Poster entry={{ title: r.title, type, tmdb_id: r.id, poster: r.poster }} size="sm" />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{r.title}</div>
                <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:2 }}>
                  {r.year} · {r.director}
                  {r.runtime ? ` · ${r.runtime} min` : ""}
                  {r.seasons ? ` · ${r.seasons} seasons` : ""}
                </div>
              </div>
              <button onClick={() => handleAdd(r)} disabled={saved.includes(r.id) || saving === r.id}
                style={{ padding:"6px 14px", background:saved.includes(r.id)?"var(--sage)":"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:12, cursor:saved.includes(r.id)?"default":"pointer", fontFamily:"'Lato', sans-serif", fontWeight:700, flexShrink:0 }}>
                {saving === r.id ? "…" : saved.includes(r.id) ? "✓ Added" : "+ Add"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WatchingPage() {
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"timeline"|"watchlist">("timeline");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showLog, setShowLog] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);

  function loadEntries() {
    fetch("/api/movies").then(r => r.json()).then(d => { setEntries(d); setLoading(false); });
  }

  useEffect(() => { loadEntries(); }, []);

  const watched = entries.filter(e => !e.watchlist);
  const watchlist = entries.filter(e => e.watchlist);
  const filtered = watched.filter(e => typeFilter === "all" || e.type === typeFilter);
  const months = groupByMonth(filtered);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>
      <div style={{ padding:"24px 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:26 }}>Movies & TV</div>
          <div style={{ fontSize:13, color:"var(--ink-faint)", fontWeight:300 }}>Your film diary · posters from TMDb</div>
        </div>
        {tab === "timeline" && (
          <button onClick={() => setShowLog(true)} style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
            + Log Film or Show
          </button>
        )}
        {tab === "watchlist" && (
          <button onClick={() => setShowWatchlist(true)} style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
            + Add to Watchlist
          </button>
        )}
      </div>

      <div style={{ padding:"14px 48px", borderBottom:"1px solid var(--border)", background:"var(--cream)", display:"flex", gap:44, flexShrink:0 }}>
        {[
          { label:"Watched in "+new Date().getFullYear(), value: watched.filter(e => e.date_watched?.startsWith(String(new Date().getFullYear()))).length },
          { label:"Films", value: watched.filter(e => e.type==="movie").length },
          { label:"Shows", value: watched.filter(e => e.type==="tv").length },
          { label:"Watchlist", value: watchlist.length },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-faint)" }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:600, color:"var(--gold)", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:"0 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex" }}>
          {([{key:"timeline",label:`Watched (${watched.length})`},{key:"watchlist",label:`Watchlist (${watchlist.length})`}] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:"13px 20px", fontSize:13, fontFamily:"'Lato', sans-serif", border:"none", borderBottom:tab===t.key?"2px solid var(--gold)":"2px solid transparent", background:"transparent", color:tab===t.key?"var(--gold)":"var(--ink-faint)", fontWeight:tab===t.key?700:400, cursor:"pointer", marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:7 }}>
          {[{key:"all",label:"All"},{key:"movie",label:"🎬 Films"},{key:"tv",label:"📺 Shows"}].map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)} style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${typeFilter===f.key?"var(--gold)":"var(--border)"}`, background:typeFilter===f.key?"var(--gold-light)":"transparent", color:typeFilter===f.key?"var(--ink)":"var(--ink-faint)", fontSize:12, fontWeight:typeFilter===f.key?700:400, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"32px 48px" }}>
        {loading && <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-faint)" }}>Loading…</div>}

        {!loading && tab === "timeline" && months.map(([month, items]) => (
          <div key={month} style={{ marginBottom:48 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:19 }}>{month}</div>
              <div style={{ flex:1, height:1, background:"var(--border)" }} />
              <div style={{ fontSize:12, color:"var(--ink-faint)" }}>{items.length} title{items.length!==1?"s":""}</div>
            </div>
            {items.map(item => (
              <div key={item.id} style={{ display:"flex", gap:20, padding:"14px 18px", borderRadius:8, border:"1px solid transparent", cursor:"pointer", transition:"all 0.15s", marginBottom:2 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="transparent"; }}>
                <Poster entry={item} size="md" />
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontFamily:"'Playfair Display', serif", fontSize:19, fontWeight:600 }}>{item.title}</span>
                    <TypeBadge type={item.type} />
                  </div>
                  <div style={{ fontSize:13, color:"var(--ink-faint)" }}>
                    {item.director} · {item.year}
                    {item.runtime ? ` · ${item.runtime} min` : ""}
                    {item.seasons ? ` · S${item.season_from}–S${item.season_to} · ${item.tv_status}` : ""}
                    {item.genre ? ` · ${item.genre}` : ""}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    {item.rating > 0 && <Stars n={item.rating} />}
                    <span style={{ fontSize:12, color:"var(--ink-faint)" }}>
                      {new Date(item.date_watched+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {!loading && tab === "watchlist" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px, 1fr))", gap:28 }}>
            {watchlist.filter(e => typeFilter==="all"||e.type===typeFilter).map(item => (
              <div key={item.id} style={{ display:"flex", flexDirection:"column", gap:9, cursor:"pointer" }}>
                <Poster entry={item} size="lg" />
                <div>
                  <TypeBadge type={item.type} />
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--ink)", lineHeight:1.35, marginTop:4 }}>{item.title}</div>
                  <div style={{ fontSize:11, color:"var(--ink-faint)", marginTop:2 }}>{item.year}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLog && <LogModal onClose={() => setShowLog(false)} onSaved={() => loadEntries()} />}
      {showWatchlist && <WatchlistModal onClose={() => setShowWatchlist(false)} onSaved={() => loadEntries()} />}
    </div>
  );
}
